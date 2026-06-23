const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const PROFILE_VERSION = 1;
const CREDENTIAL_PREFIX = 'enc:v1:';
const QUOTA_URLS = [
  'https://open.bigmodel.cn/api/monitor/usage/quota/limit',
  'https://api.z.ai/api/monitor/usage/quota/limit'
];

const TARGETS = [
  { id: 'credentials', type: 'file', source: ['home', '.zcode', 'v2', 'credentials.json'], required: true }
];

let mainWindow;

function basePath(kind) {
  if (kind === 'home') return os.homedir();
  if (kind === 'appData') return app.getPath('appData');
  throw new Error(`Unknown path base: ${kind}`);
}

function resolveSource(target) {
  const [kind, ...parts] = target.source;
  return path.join(basePath(kind), ...parts);
}

function profilesRoot() {
  return path.join(app.getPath('userData'), 'profiles');
}

function backupsRoot() {
  return path.join(app.getPath('userData'), 'switch-backups');
}

function profileDir(profileId) {
  return path.join(profilesRoot(), profileId);
}

function safeId(name, stablePart = '') {
  const cleaned = name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-').replace(/^-+|-+$/g, '');
  const suffix = stablePart
    ? crypto.createHash('sha256').update(stablePart).digest('hex').slice(0, 8)
    : Date.now();
  return `${cleaned || 'profile'}-${suffix}`;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function pathInfo(p) {
  try {
    const stat = await fs.stat(p);
    return { exists: true, type: stat.isDirectory() ? 'dir' : 'file', size: stat.size, modifiedAt: stat.mtime.toISOString() };
  } catch {
    return { exists: false };
  }
}

async function copyPath(source, destination, expectedType) {
  if (!(await exists(source))) return false;
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  if (expectedType === 'dir') {
    await fs.cp(source, destination, {
      recursive: true,
      force: true,
      filter: (item) => !['LOCK', 'Cookies-journal'].includes(path.basename(item))
    });
  } else {
    await fs.copyFile(source, destination);
  }
  return true;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function credentialSecret(env = process.env) {
  if (env.ZCODE_CREDENTIAL_SECRET) return env.ZCODE_CREDENTIAL_SECRET;
  let username = 'unknown';
  try {
    username = os.userInfo().username;
  } catch {}
  return `zcode-credential-fallback:${os.platform()}:${os.homedir()}:${username}`;
}

function decryptCredential(value) {
  if (typeof value !== 'string' || !value.startsWith(CREDENTIAL_PREFIX)) return value;
  const key = crypto.createHash('sha256').update(credentialSecret()).digest();
  const parts = value.slice(CREDENTIAL_PREFIX.length).split('.');
  if (parts.length !== 3) throw new Error('ZCode 凭据密文格式不正确。');
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function readCredentialsPlain() {
  const file = path.join(os.homedir(), '.zcode', 'v2', 'credentials.json');
  const raw = await readJson(file, {});
  const plain = {};
  for (const [key, value] of Object.entries(raw)) {
    try {
      plain[key] = decryptCredential(value);
    } catch {
      plain[key] = null;
    }
  }
  return plain;
}

function tryParseJson(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function maskIdentity(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (/^\d{7,}$/.test(text)) return `${text.slice(0, 3)}****${text.slice(-4)}`;
  return text.length > 8 ? `${text.slice(0, 4)}...${text.slice(-4)}` : text;
}

function normalizeAccountProfile(provider, raw) {
  if (!raw) return null;
  const displayName = raw.displayName || raw.name || raw.nickname || raw.username || raw.email || raw.phone;
  const username = raw.username || raw.email || raw.phone || raw.id;
  return {
    provider,
    id: raw.id || raw.userId || raw.uid || null,
    username: username || null,
    displayName: displayName || null,
    avatarUrl: raw.avatarUrl || raw.avatar || null,
    identityMasked: maskIdentity(raw.email || raw.phone || raw.username || raw.id)
  };
}

async function readCurrentAccount() {
  const credentials = await readCredentialsPlain();
  const activeProvider = credentials['oauth:active_provider'] || 'bigmodel';
  const candidates = [
    normalizeAccountProfile('bigmodel', tryParseJson(credentials['oauth:bigmodel:user_info'])),
    normalizeAccountProfile('zai', tryParseJson(credentials['oauth:zai:user_info']))
  ].filter(Boolean);
  const active = candidates.find((item) => item.provider === activeProvider) || candidates[0] || null;
  return {
    authenticated: Boolean(active),
    activeProvider,
    profile: active,
    displayName: active?.displayName || active?.username || active?.id || '未识别账号',
    stableId: `${activeProvider}:${active?.id || active?.username || credentials.zcodefeedbackclientid || 'unknown'}`
  };
}

async function fetchQuotaSnapshot() {
  const config = await readJson(path.join(os.homedir(), '.zcode', 'v2', 'config.json'), {});
  const providers = Object.entries(config.provider || {})
    .map(([id, provider]) => ({
      id,
      name: provider.name || id,
      key: provider.options?.apiKey,
      enabled: provider.enabled !== false,
      url: id.includes('zai') ? QUOTA_URLS[1] : QUOTA_URLS[0]
    }))
    .filter((provider) => provider.enabled && typeof provider.key === 'string' && provider.key.trim().length > 0);

  for (const provider of providers) {
    for (const url of [provider.url, ...QUOTA_URLS]) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { authorization: provider.key, Authorization: provider.key },
          signal: AbortSignal.timeout(7000)
        });
        const body = await response.json().catch(() => null);
        if (body?.code === 200 && body?.success !== false && body.data) {
          return {
            available: true,
            provider: { id: provider.id, name: provider.name },
            quota: body.data,
            updatedAt: new Date().toISOString()
          };
        }
      } catch {}
    }
  }

  return {
    available: false,
    reason: providers.length ? 'quota_unauthorized_or_unavailable' : 'no_provider_api_key',
    updatedAt: new Date().toISOString()
  };
}

async function readAccountSnapshot() {
  const account = await readCurrentAccount();
  const quota = await fetchQuotaSnapshot();
  return { account, quota };
}

async function getZCodeProcesses() {
  if (process.platform !== 'win32') return [];
  const command = [
    'Get-Process | Where-Object { $_.ProcessName -match "^ZCode$|^zcode$" } |',
    'Select-Object Id,ProcessName,Path | ConvertTo-Json -Compress'
  ].join(' ');
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout.trim()) return resolve([]);
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch {
        resolve([]);
      }
    });
  });
}

async function findZCodeInstall() {
  const candidates = [
    path.join(app.getPath('home'), 'AppData', 'Local', 'Programs', 'ZCode', 'ZCode.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ZCode', 'ZCode.exe')
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }

  if (process.platform !== 'win32') return null;

  const script = [
    "$roots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall');",
    "foreach($r in $roots){if(Test-Path $r){Get-ChildItem $r|ForEach-Object{Get-ItemProperty $_.PsPath -ErrorAction SilentlyContinue}|Where-Object{$_.DisplayName -match 'ZCode'}|Select-Object -First 1 DisplayIcon|ConvertTo-Json -Compress}}"
  ].join('');
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true }, async (_error, stdout) => {
      const match = stdout.match(/[A-Z]:\\[^"]*ZCode\.exe/i);
      resolve(match && await exists(match[0]) ? match[0] : null);
    });
  });
}

async function detectState() {
  const targets = [];
  for (const target of TARGETS) {
    const source = resolveSource(target);
    targets.push({ ...target, path: source, info: await pathInfo(source) });
  }
  const processes = await getZCodeProcesses();
  return {
    zcodeExe: await findZCodeInstall(),
    running: processes.length > 0,
    processes,
    targets,
    accountSnapshot: await readAccountSnapshot()
  };
}

async function listProfiles() {
  await fs.mkdir(profilesRoot(), { recursive: true });
  const entries = await fs.readdir(profilesRoot(), { withFileTypes: true });
  const profiles = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = profileDir(entry.name);
    const manifest = await readJson(path.join(dir, 'manifest.json'), null);
    if (manifest) profiles.push({ ...manifest, id: entry.name });
  }
  const sorted = profiles.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const accountProfiles = sorted.filter((profile) => profile.account?.stableId);
  if (!accountProfiles.length) return sorted;

  const seen = new Set();
  return accountProfiles.filter((profile) => {
    const stableId = profile.account.stableId;
    if (seen.has(stableId)) return false;
    seen.add(stableId);
    return true;
  });
}

async function findProfileByStableId(stableId) {
  if (!stableId) return null;
  const profiles = await listProfiles();
  return profiles.find((profile) => profile.account?.stableId === stableId) || null;
}

function hasRequiredSnapshot(manifest) {
  const captured = manifest?.captured || [];
  return TARGETS.filter((target) => target.required).every((target) =>
    captured.some((item) => item.id === target.id && item.captured)
  );
}

async function saveCurrentProfileMetadata() {
  const accountSnapshot = await readAccountSnapshot();
  if (!accountSnapshot.account.authenticated) return null;

  const resolvedName = (accountSnapshot.account.displayName || 'ZCode 账号').trim();
  const existingProfile = await findProfileByStableId(accountSnapshot.account.stableId);
  const resolvedId = existingProfile?.id || safeId(resolvedName, accountSnapshot.account.stableId);
  const dir = profileDir(resolvedId);
  const existing = await readJson(path.join(dir, 'manifest.json'), {});
  const now = new Date().toISOString();
  const manifest = {
    ...existing,
    version: PROFILE_VERSION,
    name: existing.name || resolvedName,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    account: accountSnapshot.account,
    quota: accountSnapshot.quota,
    captured: existing.captured || [],
    snapshotReady: hasRequiredSnapshot(existing),
    pendingSnapshot: !hasRequiredSnapshot(existing)
  };
  await writeJson(path.join(dir, 'manifest.json'), manifest);
  return { ...manifest, id: resolvedId };
}

async function saveCurrentAsProfile(name = null, profileId = null) {
  const accountSnapshot = await readAccountSnapshot();
  const resolvedName = (name || accountSnapshot.account.displayName || 'ZCode 账号').trim();
  const existingProfile = profileId ? null : await findProfileByStableId(accountSnapshot.account.stableId);
  const resolvedId = profileId || existingProfile?.id || safeId(resolvedName, accountSnapshot.account.stableId);
  const dir = profileDir(resolvedId);
  const tempDir = path.join(profilesRoot(), `.tmp-${resolvedId}-${Date.now()}`);
  const captured = [];
  for (const target of TARGETS) {
    const source = resolveSource(target);
    const destination = path.join(tempDir, 'data', target.id);
    try {
      const ok = await copyPath(source, destination, target.type);
      captured.push({ id: target.id, type: target.type, captured: ok, required: target.required });
    } catch (error) {
      if (target.required) {
        await fs.rm(tempDir, { recursive: true, force: true });
        throw error;
      }
      captured.push({
        id: target.id,
        type: target.type,
        captured: false,
        required: target.required,
        error: error.message
      });
    }
  }
  if (captured.some((item) => item.required && !item.captured)) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw new Error('没有找到 ZCode 登录凭据文件，无法保存账号快照。');
  }
  const now = new Date().toISOString();
  const existing = await readJson(path.join(dir, 'manifest.json'), {});
  const manifest = {
    version: PROFILE_VERSION,
    name: resolvedName,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    account: accountSnapshot.account,
    quota: accountSnapshot.quota,
    captured,
    snapshotReady: true,
    pendingSnapshot: false
  };
  await writeJson(path.join(tempDir, 'manifest.json'), manifest);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.rename(tempDir, dir);
  return { ...manifest, id: resolvedId };
}

async function autoSyncCurrentProfile() {
  const account = await readCurrentAccount();
  if (!account.authenticated) return null;
  return saveCurrentAsProfile();
}

async function restoreProfile(profileId) {
  const dir = profileDir(profileId);
  const manifest = await readJson(path.join(dir, 'manifest.json'), null);
  if (!manifest) throw new Error('账号快照不存在。');
  if (!hasRequiredSnapshot(manifest)) {
    throw new Error('这个账号目前只有识别卡片，还没有 credentials.json 快照。请刷新后再试。');
  }

  await fs.mkdir(backupsRoot(), { recursive: true });
  const backupId = `before-${profileId}-${Date.now()}`;
  const backupDir = path.join(backupsRoot(), backupId);
  for (const target of TARGETS) {
    await copyPath(resolveSource(target), path.join(backupDir, 'data', target.id), target.type);
  }
  await writeJson(path.join(backupDir, 'manifest.json'), {
    name: `切换前自动备份 ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    targetProfile: profileId
  });

  for (const item of manifest.captured || []) {
    if (!item.captured) continue;
    const target = TARGETS.find((candidate) => candidate.id === item.id);
    if (!target) continue;
    await copyPath(path.join(dir, 'data', item.id), resolveSource(target), target.type);
  }

  return { restored: profileId, backupId };
}

async function deleteProfile(profileId) {
  await fs.rm(profileDir(profileId), { recursive: true, force: true });
  return true;
}

async function stopZCode() {
  if (process.platform !== 'win32') return false;
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', "Get-Process ZCode -ErrorAction SilentlyContinue | Stop-Process -Force"], { windowsHide: true }, () => resolve(true));
  });
}

async function launchZCode() {
  const exe = await findZCodeInstall();
  if (!exe) throw new Error('没有找到 ZCode.exe。');
  await shell.openPath(exe);
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'ZCode Account Switcher',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('state:get', detectState);
ipcMain.handle('profiles:list', listProfiles);
ipcMain.handle('profiles:create', async (_event, name) => saveCurrentAsProfile(String(name || '').trim()));
ipcMain.handle('profiles:auto-sync', autoSyncCurrentProfile);
ipcMain.handle('profiles:update', async (_event, id) => {
  const manifest = await readJson(path.join(profileDir(id), 'manifest.json'), null);
  if (!manifest) throw new Error('账号快照不存在。');
  return saveCurrentAsProfile(manifest.name, id);
});
ipcMain.handle('profiles:switch', async (_event, id, launchAfter) => {
  const result = await restoreProfile(id);
  if (launchAfter) await launchZCode();
  return result;
});
ipcMain.handle('profiles:delete', (_event, id) => deleteProfile(id));
ipcMain.handle('zcode:stop', stopZCode);
ipcMain.handle('zcode:launch', launchZCode);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', (error) => {
  dialog.showErrorBox('ZCode Account Switcher', error.message);
});
