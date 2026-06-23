const previewApi = {
  getState: async () => ({
    zcodeExe: 'C:\\Users\\jinpeng\\AppData\\Local\\Programs\\ZCode\\ZCode.exe',
    running: false,
    processes: [],
    targets: [],
    accountSnapshot: {
      account: {
        authenticated: true,
        activeProvider: 'bigmodel',
        displayName: 'tfjuhcb1',
        stableId: 'bigmodel:46701782051760310',
        profile: {
          provider: 'bigmodel',
          username: 'tfjuhcb1',
          identityMasked: 'tfjuhcb1'
        }
      },
      quota: { available: false, reason: 'no_provider_api_key' }
    }
  }),
  listProfiles: async () => ([
    {
      id: 'tfjuhcb1-92bbc877',
      name: 'tfjuhcb1',
      updatedAt: new Date().toISOString(),
      snapshotReady: true,
      account: { stableId: 'bigmodel:46701782051760310', activeProvider: 'bigmodel' },
      quota: { available: false },
      captured: [{ id: 'credentials', captured: true }]
    },
    {
      id: 'gmdhp952-73324985',
      name: 'gmdhp952',
      updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
      snapshotReady: true,
      account: { stableId: 'bigmodel:36491782073039735', activeProvider: 'bigmodel' },
      quota: { available: false },
      captured: [{ id: 'credentials', captured: true }]
    }
  ]),
  autoSyncProfile: async () => null,
  createProfile: async () => null,
  updateProfile: async () => null,
  switchProfile: async () => null,
  deleteProfile: async () => null,
  stopZCode: async () => null,
  launchZCode: async () => null
};

const api = window.zcodeSwitcher || previewApi;

const statusIndicator = document.querySelector('#statusIndicator');
const accountPanel = document.querySelector('#accountPanel');
const profilesEl = document.querySelector('#profiles');
const profileTemplate = document.querySelector('#profileTemplate');
const refreshBtnTop = document.querySelector('#refreshBtnTop');
const launchBtnTop = document.querySelector('#launchBtnTop');
const stopBtn = document.querySelector('#stopBtn');
const createBtn = document.querySelector('#createBtn');
const syncHint = document.querySelector('#syncHint');
const languageBtn = document.querySelector('#languageBtn');
const languageLabel = document.querySelector('#languageLabel');

let appState = null;
let currentProfiles = [];

const translations = {
  'zh-CN': {
    'nav.accountsTitle': '账号',
    'nav.accounts': '账号管理',
    'nav.overviewTitle': '概览',
    'nav.overview': '概览',
    'nav.statusTitle': '状态',
    'nav.status': '运行状态',
    'header.title': 'ZCode 账号管理',
    'tabs.accounts': '账号总览',
    'tabs.credentials': '凭据状态',
    'toolbar.search': '搜索账号...',
    'toolbar.language': '切换为 English',
    'toolbar.saveCurrent': '保存当前',
    'toolbar.refresh': '刷新',
    'toolbar.launch': '启动 ZCode',
    'toolbar.stop': '关闭 ZCode',
    'profiles.title': '账号池',
    'sync.auto': '自动同步',
    'sync.synced': '已自动同步',
    'sync.registered': '已登记账号',
    'sync.waiting': '等待识别账号',
    'account.current': '当前账号',
    'account.unrecognized': '未识别到登录账号',
    'account.currentState': 'ZCode 当前登录状态',
    'account.running': 'ZCode 运行中',
    'account.stopped': 'ZCode 未运行',
    'account.statusRunning': 'ZCode 运行中 · 切换后需重启生效',
    'account.statusStopped': 'ZCode 未运行 · 可以切换或保存凭据',
    'quota.read': '额度已读取',
    'quota.noKey': '未配置 API Key',
    'quota.unavailable': '额度暂不可用',
    'credential.recognized': '凭据已识别',
    'credential.waitingLogin': '等待登录',
    'credential.file': '凭据文件',
    'credential.saved': 'credentials.json 已保存',
    'credential.waitingSave': '等待保存凭据',
    'switch.status': '切换状态',
    'switch.ready': '就绪',
    'switch.pending': '待补全',
    'switch.direct': '可直接切换账号',
    'switch.refreshFirst': '刷新后补全快照',
    'profile.launchAfter': '切换后启动',
    'profile.switch': '切换',
    'profile.update': '更新',
    'profile.delete': '删除',
    'profile.current': '当前',
    'profile.quota': '额度',
    'profile.switchable': '可切换',
    'profile.pending': '待补全',
    'profile.emptyRunning': '正在等待当前账号凭据。',
    'profile.emptyStopped': '正在等待可同步的 ZCode 登录状态。',
    'profile.updatedReady': '更新于 {time}{provider}{quota}，凭据已保存',
    'profile.detectedPending': '已识别于 {time}{provider}{quota}，刷新后会补全凭据快照',
    'profile.providerPart': '，{provider}',
    'profile.quotaPart': '，已含额度快照',
    'title.switchReady': '如果 ZCode 正在运行，通常需要重启后生效',
    'title.switchPending': '刷新补全 credentials.json 后可切换',
    'confirm.update': '确定用当前 ZCode 登录状态覆盖这个账号快照？',
    'confirm.delete': '确定删除账号快照"{name}"？',
    'status.saved': '已保存当前账号凭据。',
    'status.updated': '已覆盖保存账号快照。',
    'status.switchedRunning': '账号凭据已切换，重启 ZCode 后生效。',
    'status.switched': '账号切换完成。',
    'status.deleted': '账号快照已删除。'
  },
  'en-US': {
    'nav.accountsTitle': 'Accounts',
    'nav.accounts': 'Accounts',
    'nav.overviewTitle': 'Overview',
    'nav.overview': 'Overview',
    'nav.statusTitle': 'Status',
    'nav.status': 'Runtime status',
    'header.title': 'ZCode Accounts',
    'tabs.accounts': 'Accounts',
    'tabs.credentials': 'Credentials',
    'toolbar.search': 'Search accounts...',
    'toolbar.language': 'Switch to Chinese',
    'toolbar.saveCurrent': 'Save current',
    'toolbar.refresh': 'Refresh',
    'toolbar.launch': 'Launch ZCode',
    'toolbar.stop': 'Stop ZCode',
    'profiles.title': 'Account Pool',
    'sync.auto': 'Auto sync',
    'sync.synced': 'Synced',
    'sync.registered': 'Account recorded',
    'sync.waiting': 'Waiting for account',
    'account.current': 'Current account',
    'account.unrecognized': 'No signed-in account detected',
    'account.currentState': 'Current ZCode sign-in state',
    'account.running': 'ZCode running',
    'account.stopped': 'ZCode stopped',
    'account.statusRunning': 'ZCode is running · restart after switching',
    'account.statusStopped': 'ZCode is stopped · ready to switch or save',
    'quota.read': 'Quota loaded',
    'quota.noKey': 'No API key',
    'quota.unavailable': 'Quota unavailable',
    'credential.recognized': 'Credentials detected',
    'credential.waitingLogin': 'Waiting for login',
    'credential.file': 'Credential file',
    'credential.saved': 'credentials.json saved',
    'credential.waitingSave': 'Waiting for credentials',
    'switch.status': 'Switch status',
    'switch.ready': 'Ready',
    'switch.pending': 'Pending',
    'switch.direct': 'Ready to switch',
    'switch.refreshFirst': 'Refresh to complete snapshot',
    'profile.launchAfter': 'Launch after switch',
    'profile.switch': 'Switch',
    'profile.update': 'Update',
    'profile.delete': 'Delete',
    'profile.current': 'Current',
    'profile.quota': 'Quota',
    'profile.switchable': 'Switchable',
    'profile.pending': 'Pending',
    'profile.emptyRunning': 'Waiting for current account credentials.',
    'profile.emptyStopped': 'Waiting for a syncable ZCode sign-in state.',
    'profile.updatedReady': 'Updated at {time}{provider}{quota}; credentials saved',
    'profile.detectedPending': 'Detected at {time}{provider}{quota}; refresh to complete credential snapshot',
    'profile.providerPart': ', {provider}',
    'profile.quotaPart': ', with quota snapshot',
    'title.switchReady': 'If ZCode is running, restart it after switching',
    'title.switchPending': 'Refresh to save credentials.json before switching',
    'confirm.update': 'Overwrite this account snapshot with the current ZCode sign-in state?',
    'confirm.delete': 'Delete account snapshot "{name}"?',
    'status.saved': 'Current account credentials saved.',
    'status.updated': 'Account snapshot updated.',
    'status.switchedRunning': 'Credentials switched. Restart ZCode to apply.',
    'status.switched': 'Account switched.',
    'status.deleted': 'Account snapshot deleted.'
  }
};

let lang = localStorage.getItem('zcode-language') || (navigator.language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US');

function t(key, values = {}) {
  const template = translations[lang]?.[key] || translations['zh-CN'][key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? '');
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  if (languageLabel) languageLabel.textContent = lang === 'zh-CN' ? 'EN' : '中';
  renderIcons();
}

function setLanguage(nextLang) {
  lang = nextLang;
  localStorage.setItem('zcode-language', lang);
  applyLanguage();
  if (appState) {
    renderState();
    renderProfiles(currentProfiles);
    if (syncHint) updateSyncHint();
  }
}

function renderIcons(root = document) {
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: { 'stroke-width': 2, 'aria-hidden': 'true' },
      root
    });
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(value) {
  if (!value) return lang === 'zh-CN' ? '未知时间' : 'Unknown time';
  return new Date(value).toLocaleString();
}

function setBusy(busy) {
  document.querySelectorAll('button').forEach((button) => {
    button.disabled = busy;
  });
}

function showStatus(message, tone = 'ok') {
  statusIndicator.className = `status-indicator ${tone}`;
  const iconName = tone === 'ok' ? 'circle-check' : 'alert-triangle';
  statusIndicator.innerHTML = `<i data-lucide="${iconName}"></i>`;
  statusIndicator.title = message;
  renderIcons(statusIndicator);
}

function renderState() {
  if (appState.running) {
    showStatus(t('account.statusRunning'), 'warn');
  } else {
    showStatus(t('account.statusStopped'), 'ok');
  }
  renderAccount(appState.accountSnapshot);
}

function renderAccount(snapshot) {
  const account = snapshot?.account;
  const profile = account?.profile;
  const quota = snapshot?.quota;
  const name = account?.authenticated ? account.displayName : t('account.unrecognized');
  const provider = account?.activeProvider || 'unknown';
  const avatar = profile?.avatarUrl
    ? `<img src="${escapeHtml(profile.avatarUrl)}" alt="" />`
    : `<span>${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
  const quotaText = quota?.available ? t('quota.read') : quota?.reason === 'no_provider_api_key' ? t('quota.noKey') : t('quota.unavailable');
  const runningText = appState?.running ? t('account.running') : t('account.stopped');

  accountPanel.innerHTML = `
    <div class="account-card-title">
      <span><i data-lucide="user-round-check"></i>${t('account.current')}</span>
      <strong>${runningText}</strong>
    </div>
    <div class="account-body">
      <div class="account-main">
        <div class="avatar">${avatar}</div>
        <div class="account-identity">
          <h2>${escapeHtml(name)}</h2>
          <p>${escapeHtml(profile?.identityMasked || profile?.username || profile?.id || t('account.currentState'))}</p>
        </div>
      </div>
      <div class="account-meta">
        <span class="pill pill-emphasis">${escapeHtml(provider)}</span>
        <span class="pill">${escapeHtml(quotaText)}</span>
        <span class="pill ${account?.authenticated ? 'pill-success' : 'pill-warning'}">${account?.authenticated ? t('credential.recognized') : t('credential.waitingLogin')}</span>
      </div>
    </div>
  `;
  renderIcons(accountPanel);
}

function renderProfiles(profiles) {
  currentProfiles = profiles;
  profilesEl.innerHTML = '';
  if (!profiles.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = appState.running ? t('profile.emptyRunning') : t('profile.emptyStopped');
    profilesEl.append(empty);
    return;
  }

  for (const profile of profiles) {
    const node = profileTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('h3').textContent = profile.name;
    const snapshotReady = profile.snapshotReady || (profile.captured || []).some((item) => item.id === 'credentials' && item.captured);
    const provider = profile.account?.activeProvider ? t('profile.providerPart', { provider: profile.account.activeProvider }) : '';
    const quota = profile.quota?.available ? t('profile.quotaPart') : '';
    node.querySelector('p').textContent = snapshotReady
      ? t('profile.updatedReady', { time: formatTime(profile.updatedAt), provider, quota })
      : t('profile.detectedPending', { time: formatTime(profile.updatedAt), provider, quota });
    const statusGrid = document.createElement('div');
    statusGrid.className = 'credential-grid';
    statusGrid.innerHTML = `
      <div class="credential-item">
        <div class="credential-row"><span><i data-lucide="key-round"></i>${t('credential.file')}</span><strong>${snapshotReady ? '100%' : '0%'}</strong></div>
        <div class="credential-track"><span style="width:${snapshotReady ? '100' : '8'}%"></span></div>
        <small>${snapshotReady ? t('credential.saved') : t('credential.waitingSave')}</small>
      </div>
      <div class="credential-item">
        <div class="credential-row"><span><i data-lucide="shield-check"></i>${t('switch.status')}</span><strong>${snapshotReady ? t('switch.ready') : t('switch.pending')}</strong></div>
        <div class="credential-track"><span style="width:${snapshotReady ? '100' : '22'}%"></span></div>
        <small>${snapshotReady ? t('switch.direct') : t('switch.refreshFirst')}</small>
      </div>
    `;
    node.querySelector('.profile-main').append(statusGrid);
    const badges = node.querySelector('.profile-badges');
    const activeId = appState.accountSnapshot?.account?.stableId;
    const profileId = profile.account?.stableId;
    if (profileId && profileId === activeId) node.classList.add('is-current');
    badges.innerHTML = [
      profileId && profileId === activeId ? `<span class="pill pill-success">${t('profile.current')}</span>` : '',
      profile.account?.activeProvider ? `<span class="pill pill-emphasis">${escapeHtml(profile.account.activeProvider)}</span>` : '',
      profile.quota?.available ? `<span class="pill">${t('profile.quota')}</span>` : '',
      snapshotReady ? `<span class="pill pill-success">${t('profile.switchable')}</span>` : `<span class="pill pill-warning">${t('profile.pending')}</span>`
    ].filter(Boolean).join('');

    const switchBtn = node.querySelector('[data-action="switch"]');
    switchBtn.disabled = !snapshotReady;
    switchBtn.title = snapshotReady ? t('title.switchReady') : t('title.switchPending');
    switchBtn.addEventListener('click', () => switchProfile(profile.id, node));
    node.querySelector('[data-action="update"]').addEventListener('click', () => updateProfile(profile.id));
    node.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProfile(profile.id, profile.name));
    profilesEl.append(node);
  }
  renderIcons(profilesEl);
  applyLanguage();
}

function updateSyncHint() {
  if (!syncHint) return;
  if (appState.accountSnapshot?.account?.authenticated) {
    syncHint.textContent = appState.running ? t('sync.registered') : t('sync.synced');
  } else {
    syncHint.textContent = appState.running ? t('sync.waiting') : t('sync.auto');
  }
}

async function refresh() {
  appState = await api.getState();
  if (appState.accountSnapshot?.account?.authenticated) {
    await api.autoSyncProfile();
    appState = await api.getState();
  }
  updateSyncHint();
  const profiles = await api.listProfiles();
  renderState();
  renderProfiles(profiles);
}

async function runTask(task) {
  try {
    setBusy(true);
    await task();
    await refresh();
  } catch (error) {
    showStatus(error.message || String(error), 'warn');
  } finally {
    setBusy(false);
  }
}

async function createProfile() {
  await runTask(async () => {
    await api.createProfile();
    showStatus(t('status.saved'), 'ok');
  });
}

async function updateProfile(id) {
  if (!confirm(t('confirm.update'))) return;
  await runTask(async () => {
    await api.updateProfile(id);
    showStatus(t('status.updated'), 'ok');
  });
}

async function switchProfile(id, node) {
  const launchAfter = node.querySelector('input[type="checkbox"]').checked;
  await runTask(async () => {
    await api.switchProfile(id, launchAfter);
    showStatus(appState.running ? t('status.switchedRunning') : t('status.switched'), 'ok');
  });
}

async function deleteProfile(id, name) {
  if (!confirm(t('confirm.delete', { name }))) return;
  await runTask(async () => {
    await api.deleteProfile(id);
    showStatus(t('status.deleted'), 'ok');
  });
}

refreshBtnTop?.addEventListener('click', () => runTask(refresh));
launchBtnTop?.addEventListener('click', () => runTask(api.launchZCode));
stopBtn?.addEventListener('click', () => runTask(api.stopZCode));
createBtn?.addEventListener('click', createProfile);
languageBtn?.addEventListener('click', () => setLanguage(lang === 'zh-CN' ? 'en-US' : 'zh-CN'));

applyLanguage();
renderIcons();
refresh().catch((error) => showStatus(error.message || String(error), 'warn'));
