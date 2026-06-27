(function () {
  const countdownEl = document.getElementById("countdown");
  const dotEl = document.getElementById("dot");
  const statusTextEl = document.getElementById("statusText");
  const productsEl = document.getElementById("products");
  const logsEl = document.getElementById("logs");
  const btnEl = document.getElementById("btn");

  let isActive = false;
  let nextReloadAt = null;

  chrome.storage.local.get(["bmActive", "bmNextReload", "bmProducts", "bmLogs"], (r) => {
    isActive = !!r.bmActive;
    nextReloadAt = r.bmNextReload || null;
    updateStatus();
    renderProducts(r.bmProducts);
    renderLogs(r.bmLogs);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.bmActive) {
      isActive = changes.bmActive.newValue;
      updateStatus();
    }
    if (changes.bmNextReload) {
      nextReloadAt = changes.bmNextReload.newValue;
    }
    if (changes.bmProducts) {
      renderProducts(changes.bmProducts.newValue);
    }
    if (changes.bmLogs) {
      renderLogs(changes.bmLogs.newValue);
    }
  });

  btnEl.addEventListener("click", () => {
    isActive = !isActive;
    chrome.storage.local.set({ bmActive: isActive });
    updateStatus();
    if (isActive) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.reload(tabs[0].id);
      });
    }
  });

  function updateStatus() {
    dotEl.className = "status-dot " + (isActive ? "active" : "idle");
    statusTextEl.textContent = isActive ? "抢购中..." : "已停止";
    btnEl.textContent = isActive ? "停止抢购" : "开始抢购";
    btnEl.className = "btn " + (isActive ? "stop" : "start");
  }

  function renderProducts(products) {
    if (!products || !products.length) {
      productsEl.innerHTML = '<li style="color:#94a3b8">等待检测...</li>';
      return;
    }
    productsEl.innerHTML = products.map((p) => {
      const badge = p.soldOut
        ? '<span class="badge soldout">售罄</span>'
        : '<span class="badge available">可买</span>';
      return `<li><span>${p.name || p.tier}</span>${badge}</li>`;
    }).join("");
  }

  function renderLogs(logs) {
    if (!logs || !logs.length) { logsEl.textContent = ""; return; }
    logsEl.innerHTML = logs.map((l) => {
      const time = new Date(l.at).toLocaleTimeString("zh-CN", { hour12: false });
      return `<div>${time} ${l.msg}</div>`;
    }).join("");
    logsEl.scrollTop = logsEl.scrollHeight;
  }

  // 毫秒倒计时
  function tickCountdown() {
    if (!isActive || !nextReloadAt) {
      countdownEl.textContent = "--:--:---";
    } else {
      const remain = Math.max(0, nextReloadAt - Date.now());
      const sec = Math.floor(remain / 1000);
      const ms = remain % 1000;
      countdownEl.textContent = String(sec).padStart(2, "0") + ":" + String(ms).padStart(3, "0");
    }
    requestAnimationFrame(tickCountdown);
  }
  requestAnimationFrame(tickCountdown);
})();
