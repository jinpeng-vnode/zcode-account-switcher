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

let appState = null;

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
  if (!value) return '未知时间';
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
    showStatus('ZCode 运行中 · 切换后需重启生效', 'warn');
  } else {
    showStatus('ZCode 未运行 · 可以切换或保存凭据', 'ok');
  }
  renderAccount(appState.accountSnapshot);
}

function renderAccount(snapshot) {
  const account = snapshot?.account;
  const profile = account?.profile;
  const quota = snapshot?.quota;
  const name = account?.authenticated ? account.displayName : '未识别到登录账号';
  const provider = account?.activeProvider || 'unknown';
  const avatar = profile?.avatarUrl
    ? `<img src="${escapeHtml(profile.avatarUrl)}" alt="" />`
    : `<span>${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
  const quotaText = quota?.available ? '额度已读取' : quota?.reason === 'no_provider_api_key' ? '未配置 API Key' : '额度暂不可用';
  const runningClass = appState?.running ? 'warn' : 'ok';
  const runningText = appState?.running ? 'ZCode 运行中' : 'ZCode 未运行';

  accountPanel.innerHTML = `
    <div class="account-card-title">
      <span><i data-lucide="user-round-check"></i>当前账号</span>
      <strong>${runningText}</strong>
    </div>
    <div class="account-body">
      <div class="account-main">
        <div class="avatar">${avatar}</div>
        <div class="account-identity">
          <h2>${escapeHtml(name)}</h2>
          <p>${escapeHtml(profile?.identityMasked || profile?.username || profile?.id || 'ZCode 当前登录状态')}</p>
        </div>
      </div>
      <div class="account-meta">
        <span class="pill pill-emphasis">${escapeHtml(provider)}</span>
        <span class="pill">${escapeHtml(quotaText)}</span>
        <span class="pill ${account?.authenticated ? 'pill-success' : 'pill-warning'}">${account?.authenticated ? '凭据已识别' : '等待登录'}</span>
      </div>
    </div>
  `;
  renderIcons(accountPanel);
}

function renderProfiles(profiles) {
  profilesEl.innerHTML = '';
  if (!profiles.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = appState.running ? '正在等待当前账号凭据。' : '正在等待可同步的 ZCode 登录状态。';
    profilesEl.append(empty);
    return;
  }

  for (const profile of profiles) {
    const node = profileTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('h3').textContent = profile.name;
    const snapshotReady = profile.snapshotReady || (profile.captured || []).some((item) => item.id === 'credentials' && item.captured);
    const provider = profile.account?.activeProvider ? `，${profile.account.activeProvider}` : '';
    const quota = profile.quota?.available ? '，已含额度快照' : '';
    node.querySelector('p').textContent = snapshotReady
      ? `更新于 ${formatTime(profile.updatedAt)}${provider}${quota}，凭据已保存`
      : `已识别于 ${formatTime(profile.updatedAt)}${provider}${quota}，刷新后会补全凭据快照`;
    const statusGrid = document.createElement('div');
    statusGrid.className = 'credential-grid';
    statusGrid.innerHTML = `
      <div class="credential-item">
        <div class="credential-row"><span><i data-lucide="key-round"></i>凭据文件</span><strong>${snapshotReady ? '100%' : '0%'}</strong></div>
        <div class="credential-track"><span style="width:${snapshotReady ? '100' : '8'}%"></span></div>
        <small>${snapshotReady ? 'credentials.json 已保存' : '等待保存凭据'}</small>
      </div>
      <div class="credential-item">
        <div class="credential-row"><span><i data-lucide="shield-check"></i>切换状态</span><strong>${snapshotReady ? '就绪' : '待补全'}</strong></div>
        <div class="credential-track"><span style="width:${snapshotReady ? '100' : '22'}%"></span></div>
        <small>${snapshotReady ? '可直接切换账号' : '刷新后补全快照'}</small>
      </div>
    `;
    node.querySelector('.profile-main').append(statusGrid);
    const badges = node.querySelector('.profile-badges');
    const activeId = appState.accountSnapshot?.account?.stableId;
    const profileId = profile.account?.stableId;
    if (profileId && profileId === activeId) node.classList.add('is-current');
    badges.innerHTML = [
      profileId && profileId === activeId ? '<span class="pill pill-success">当前</span>' : '',
      profile.account?.activeProvider ? `<span class="pill pill-emphasis">${escapeHtml(profile.account.activeProvider)}</span>` : '',
      profile.quota?.available ? '<span class="pill">额度</span>' : '',
      snapshotReady ? '<span class="pill pill-success">可切换</span>' : '<span class="pill pill-warning">待补全</span>'
    ].filter(Boolean).join('');

    const switchBtn = node.querySelector('[data-action="switch"]');
    switchBtn.disabled = !snapshotReady;
    switchBtn.title = snapshotReady ? '如果 ZCode 正在运行，通常需要重启后生效' : '刷新补全 credentials.json 后可切换';
    switchBtn.addEventListener('click', () => switchProfile(profile.id, node));
    node.querySelector('[data-action="update"]').addEventListener('click', () => updateProfile(profile.id));
    node.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProfile(profile.id, profile.name));
    profilesEl.append(node);
  }
  renderIcons(profilesEl);
}

async function refresh() {
  appState = await api.getState();
  if (appState.accountSnapshot?.account?.authenticated) {
    await api.autoSyncProfile();
    appState = await api.getState();
    if (syncHint) syncHint.textContent = appState.running ? '已登记账号' : '已自动同步';
  } else if (syncHint) {
    syncHint.textContent = appState.running ? '等待识别账号' : '自动同步';
  }
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
    showStatus('已保存当前账号凭据。', 'ok');
  });
}

async function updateProfile(id) {
  if (!confirm('确定用当前 ZCode 登录状态覆盖这个账号快照？')) return;
  await runTask(async () => {
    await api.updateProfile(id);
    showStatus('已覆盖保存账号快照。', 'ok');
  });
}

async function switchProfile(id, node) {
  const launchAfter = node.querySelector('input[type="checkbox"]').checked;
  await runTask(async () => {
    await api.switchProfile(id, launchAfter);
    showStatus(appState.running ? '账号凭据已切换，重启 ZCode 后生效。' : '账号切换完成。', 'ok');
  });
}

async function deleteProfile(id, name) {
  if (!confirm(`确定删除账号快照"${name}"？`)) return;
  await runTask(async () => {
    await api.deleteProfile(id);
    showStatus('账号快照已删除。', 'ok');
  });
}

refreshBtnTop?.addEventListener('click', () => runTask(refresh));
launchBtnTop?.addEventListener('click', () => runTask(api.launchZCode));
stopBtn?.addEventListener('click', () => runTask(api.stopZCode));
createBtn?.addEventListener('click', createProfile);

renderIcons();
refresh().catch((error) => showStatus(error.message || String(error), 'warn'));
