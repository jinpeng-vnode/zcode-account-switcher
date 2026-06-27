const countEl = document.getElementById("count");
const clockEl = document.getElementById("clock");
const timingHintEl = document.getElementById("timing-hint");
const cardEl = document.getElementById("purchase-card");
const labelEl = document.getElementById("purchase-label");
const reasonEl = document.getElementById("purchase-reason");
const timeEl = document.getElementById("purchase-time");
const productsEl = document.getElementById("products");
const latencyEl = document.getElementById("latency");
const latestEl = document.getElementById("latest");
const logsEl = document.getElementById("logs");
const tierPriorityEl = document.getElementById("tier-priority");
const periodPriorityEl = document.getElementById("period-priority");
const autoPurchaseBtn = document.getElementById("auto-purchase");
const autoPurchaseLogEl = document.getElementById("auto-purchase-log");
const captchaCardEl = document.getElementById("captcha-card");
const captchaLabelEl = document.getElementById("captcha-label");
const captchaDetailEl = document.getElementById("captcha-detail");
let latestTimingHint = "等待耗时样本";

document.getElementById("refresh").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) chrome.tabs.reload(tab.id);
});

document.getElementById("scroll").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "scroll-to-package-area" });
});

autoPurchaseBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  const { autoPurchaseActive } = await chrome.storage.local.get({ autoPurchaseActive: false });
  if (autoPurchaseActive) {
    chrome.tabs.sendMessage(tab.id, { type: "stop-auto-purchase" });
    await chrome.storage.local.set({ autoPurchaseActive: false });
    setAutoPurchaseBtnState(false);
  } else {
    chrome.tabs.sendMessage(tab.id, { type: "start-auto-purchase" });
    await chrome.storage.local.set({ autoPurchaseActive: true });
    setAutoPurchaseBtnState(true);
  }
});

function setAutoPurchaseBtnState(active) {
  if (active) {
    autoPurchaseBtn.textContent = "停止自动抢购";
    autoPurchaseBtn.classList.remove("btn-primary");
    autoPurchaseBtn.classList.add("btn-danger");
  } else {
    autoPurchaseBtn.textContent = "开始自动抢购";
    autoPurchaseBtn.classList.remove("btn-danger");
    autoPurchaseBtn.classList.add("btn-primary");
  }
}

document.getElementById("export").addEventListener("click", exportLogs);
document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ logs: [], purchaseState: null });
  render();
});

for (const el of [tierPriorityEl, periodPriorityEl]) {
  el.addEventListener("change", saveSettings);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.logs || changes.purchaseState || changes.monitorSettings) render();
    if (changes.autoPurchaseLog) renderAutoPurchaseLog(changes.autoPurchaseLog.newValue);
    if (changes.captchaState) renderCaptchaState(changes.captchaState.newValue);
    if (changes.autoPurchaseActive) setAutoPurchaseBtnState(changes.autoPurchaseActive.newValue);
  }
});

render();
startClock();

async function render() {
  const { logs = [], purchaseState = null, monitorSettings = null, networkObservations = [], autoPurchaseLog = null, captchaState = null, autoPurchaseActive = false } = await chrome.storage.local.get({ logs: [], purchaseState: null, monitorSettings: null, networkObservations: [], autoPurchaseLog: null, captchaState: null, autoPurchaseActive: false });
  renderSettings(Shared.normalizeSettings(monitorSettings));
  countEl.textContent = `${logs.length} logs`;
  renderPurchaseState(purchaseState);
  renderLatency(logs, networkObservations);
  renderAutoPurchaseLog(autoPurchaseLog);
  renderCaptchaState(captchaState);
  setAutoPurchaseBtnState(autoPurchaseActive);
  const latest = logs[logs.length - 1];
  latestEl.textContent = latest ? JSON.stringify(compactRecord(latest), null, 2) : "暂无日志";
  logsEl.textContent = JSON.stringify(logs.slice(-20).map(compactRecord), null, 2);
}

function renderLatency(logs, networkObservations) {
  const batchLogs = logs.filter((item) => item.path === "/api/biz/pay/batch-preview" && Number.isFinite(item.durationMs));
  if (!batchLogs.length) {
    latencyEl.textContent = "暂无 batch-preview 耗时";
    return;
  }

  const durations = batchLogs.map((item) => item.durationMs);
  const latest = batchLogs[batchLogs.length - 1];
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const avg = Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
  const recent = durations.slice(-10);
  const recentAvg = Math.round(recent.reduce((sum, value) => sum + value, 0) / recent.length);
  const batchNetwork = (networkObservations || []).filter((item) => item.path === "/api/biz/pay/batch-preview");
  const ips = Array.from(new Set(batchNetwork.map((item) => item.ip).filter(Boolean))).slice(-5);
  const latestNetwork = batchNetwork[batchNetwork.length - 1];

  latencyEl.innerHTML = [
    metricRow("最近耗时", `${latest.durationMs} ms`),
    metricRow("最近10次均值", `${recentAvg} ms`),
    metricRow("全部均值", `${avg} ms`),
    metricRow("最小 / 最大", `${min} / ${max} ms`),
    metricRow("样本数", String(batchLogs.length)),
    metricRow("服务端 IP", ips.length ? ips.join(", ") : "浏览器暂未暴露"),
    metricRow("最近网络状态", latestNetwork ? `${latestNetwork.statusCode || "ERR"} ${latestNetwork.error || ""}` : "暂无")
  ].join("");

  latestTimingHint = buildTimingHint(recentAvg);
  timingHintEl.textContent = latestTimingHint;
}

function metricRow(label, value) {
  return `<div class="metric-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`;
}

function startClock() {
  const tick = () => {
    const now = new Date();
    clockEl.textContent = formatBeijingTime(now);
    timingHintEl.textContent = latestTimingHint;
    requestAnimationFrame(tick);
  };
  tick();
}

function formatBeijingTime(date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("hour")}:${get("minute")}:${get("second")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

function buildTimingHint(recentAvg) {
  if (!Number.isFinite(recentAvg)) return "等待耗时样本";
  const ms = Math.max(0, Math.min(999, recentAvg));
  const targetMs = 1000 - ms;
  return `参考：若卡 10:00:00，可在 09:59:59.${String(targetMs).padStart(3, "0")} 左右手动刷新`;
}

async function saveSettings() {
  const settings = {
    tierPriority: tierPriorityEl.value.split(","),
    periodPriority: periodPriorityEl.value.split(",")
  };
  await chrome.storage.local.set({ monitorSettings: Shared.normalizeSettings(settings) });
}

function renderSettings(settings) {
  tierPriorityEl.value = settings.tierPriority.join(",");
  periodPriorityEl.value = settings.periodPriority.join(",");
}

function renderPurchaseState(state) {
  const status = state && state.status ? state.status : "unknown";
  cardEl.className = `state ${status}`;
  labelEl.textContent = state && state.label ? state.label : "未知";
  reasonEl.textContent = state && state.reason ? state.reason : "等待 batch-preview 返回";
  if (state && state.bestPeriod) {
    reasonEl.textContent += `；目标选项卡：${Shared.periodText(state.bestPeriod)}`;
  }
  timeEl.textContent = state && state.updatedAt ? `更新时间：${formatTime(state.updatedAt)}` : "";

  const products = state && Array.isArray(state.products) ? state.products : [];
  if (!products.length) {
    const record = state && state.record;
    if (record && record.summary) {
      productsEl.textContent = `没有商品列表。code=${String(record.summary.code)} msg=${String(record.summary.msg || "")}`;
    } else {
      productsEl.textContent = "暂无商品状态";
    }
    return;
  }

  productsEl.innerHTML = products
    .map((p) => {
      const canBuy = p.soldOut === false || p.canPurchase === true;
      const stateText = canBuy ? "可能可买" : p.isLimitBuy === true ? "抢购人数过多" : p.soldOut === true ? "售罄" : "未知";
      const title = p.productName || p.type || p.tier || p.productId || "unknown";
      return `
        <div class="product">
          <strong>${escapeHtml(title)} · ${escapeHtml(stateText)}</strong>
          <span>${escapeHtml(p.productId || "")}</span>
          <span class="signal">isLimitBuy=${String(p.isLimitBuy)} / disabled=${String(p.disabled)}</span>
          <span>soldOut=${String(p.soldOut)} / canPurchase=${String(p.canPurchase)} / canRepurchase=${String(p.canRepurchase)}</span>
          <span>forbidden=${String(p.forbidden)} / delay=${String(p.delay)}</span>
          <span>price=${String(p.payAmount ?? "")}</span>
        </div>
      `;
    })
    .join("");
}

function compactRecord(record) {
  return {
    at: record.at,
    method: record.method,
    status: record.status,
    path: record.path,
    durationMs: record.durationMs,
    requestBody: record.requestBody,
    summary: record.summary
  };
}

async function exportLogs() {
  const { logs = [], purchaseState = null } = await chrome.storage.local.get({ logs: [], purchaseState: null });
  const blob = new Blob([JSON.stringify({ purchaseState, logs }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `bigmodel-monitor-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


function renderAutoPurchaseLog(log) {
  if (!autoPurchaseLogEl) return;
  if (!log) {
    autoPurchaseLogEl.textContent = "未启动";
    return;
  }
  autoPurchaseLogEl.textContent = `${log.msg}  (${formatTime(log.at)})`;
}

function renderCaptchaState(state) {
  if (!captchaCardEl) return;
  if (!state) {
    captchaCardEl.style.display = "none";
    return;
  }
  captchaCardEl.style.display = "";
  if (state.visible) {
    captchaCardEl.className = "state error";
    captchaLabelEl.textContent = "验证码弹出中";
    captchaDetailEl.textContent = `第 ${state.showCount} 次弹出，请切回页面完成滑块验证`;
  } else {
    captchaCardEl.className = "state available";
    captchaLabelEl.textContent = "验证已完成";
    captchaDetailEl.textContent = `共弹出 ${state.showCount} 次`;
  }
}
