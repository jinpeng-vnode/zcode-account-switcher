const btn = document.getElementById("btn");
const statusEl = document.getElementById("status");
let isActive = false;

chrome.storage.local.get({ bmActive: false, bmLog: null }, (r) => {
  isActive = r.bmActive;
  updateUI();
  if (r.bmLog) statusEl.textContent = r.bmLog.msg + "\n" + r.bmLog.at;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.bmActive) { isActive = changes.bmActive.newValue; updateUI(); }
  if (changes.bmLog && changes.bmLog.newValue) {
    statusEl.textContent = changes.bmLog.newValue.msg + "\n" + changes.bmLog.newValue.at;
  }
});

btn.addEventListener("click", () => {
  isActive = !isActive;
  chrome.storage.local.set({ bmActive: isActive });
  updateUI();
  if (isActive) {
    // 启动时刷新当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.reload(tabs[0].id);
    });
  }
});

document.getElementById("reload").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.reload(tabs[0].id);
  });
});

function updateUI() {
  btn.textContent = isActive ? "停止抢购" : "开始抢购";
  btn.className = isActive ? "stop" : "start";
}
