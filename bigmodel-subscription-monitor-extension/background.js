importScripts("shared.js");

const TARGET_BATCH_PREVIEW = "/api/biz/pay/batch-preview";
const API_URL_FILTER = {
  urls: ["https://bigmodel.cn/api/*", "https://open.bigmodel.cn/api/*"]
};
const REFRESH_DELAY_NORMAL = 800;
const REFRESH_DELAY_BUSY = 1500;

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message) return;

  if (message.type === "captcha-alert") {
    handleCaptchaAlert(message.data, sender);
    return;
  }

  if (message.type !== "api-response") return;
  const record = message.record;
  if (!record) return;

  if (record.path === TARGET_BATCH_PREVIEW) {
    handleBatchPreview(record, sender);
  }
});

if (chrome.webRequest && chrome.webRequest.onCompleted) {
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      recordNetworkObservation({
        at: new Date(details.timeStamp || Date.now()).toISOString(),
        method: details.method,
        statusCode: details.statusCode,
        url: details.url,
        path: pathOnly(details.url),
        ip: details.ip || "",
        fromCache: details.fromCache || false,
        type: details.type || ""
      });
    },
    API_URL_FILTER
  );
}

if (chrome.webRequest && chrome.webRequest.onErrorOccurred) {
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      recordNetworkObservation({
        at: new Date(details.timeStamp || Date.now()).toISOString(),
        method: details.method,
        statusCode: 0,
        url: details.url,
        path: pathOnly(details.url),
        ip: details.ip || "",
        fromCache: false,
        type: details.type || "",
        error: details.error || "request failed"
      });
    },
    API_URL_FILTER
  );
}

async function handleBatchPreview(record, sender) {
  const products = record.summary && Array.isArray(record.summary.productList) ? record.summary.productList : [];
  const responseCode = record.summary && record.summary.code;
  const responseMsg = record.summary && record.summary.msg;
  const available = products.some((p) => p.soldOut === false || p.canPurchase === true);
  const limited = products.some((p) => p.isLimitBuy === true);
  const soldOut = products.length > 0 && products.every((p) => p.soldOut === true);
  const { monitorSettings: storedSettings = null } = await chrome.storage.local.get({ monitorSettings: null });
  const settings = Shared.normalizeSettings(storedSettings);
  const bestProduct = Shared.getBestAvailableProduct(products, settings);
  const bestPeriod = bestProduct ? Shared.getProductPeriod(bestProduct) : "";
  const state = {
    updatedAt: new Date().toISOString(),
    status: "unknown",
    label: "未知",
    reason: "还没有拿到明确的 batch-preview 状态",
    products,
    bestPeriod,
    bestProduct,
    settings,
    record
  };

  if (responseCode === 555 || /系统繁忙|稍后再试|刷新再试|人数过多/.test(responseMsg || "")) {
    state.status = "busy";
    state.label = "系统繁忙";
    state.reason = `batch-preview 返回 code=${responseCode}, msg=${responseMsg || ""}`;
    chrome.action.setBadgeText({ text: "555" });
    chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  } else if (available) {
    state.status = "available";
    state.label = "可能可以购买";
    state.reason = `batch-preview 返回了 soldOut:false 或 canPurchase:true，已优先切到 ${Shared.periodText(bestPeriod) || "可买周期"}`;
    chrome.action.setBadgeText({ text: "OK" });
    chrome.action.setBadgeBackgroundColor({ color: "#047857" });
    const { lastAvailableNotifyAt = 0 } = await chrome.storage.local.get({ lastAvailableNotifyAt: 0 });
    if (Date.now() - lastAvailableNotifyAt > 30000) {
      await chrome.storage.local.set({ lastAvailableNotifyAt: Date.now() });
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon-128.png",
        title: "BigModel 可能可购买",
        message: "batch-preview 返回了非售罄/可购买状态，请回到页面手动确认。"
      });
    }
  } else if (limited) {
    state.status = "limited";
    state.label = "抢购人数过多";
    state.reason = "接口状态里出现 isLimitBuy:true，可手动刷新再试";
    chrome.action.setBadgeText({ text: "BUSY" });
    chrome.action.setBadgeBackgroundColor({ color: "#b91c1c" });
  } else if (soldOut) {
    state.status = "soldout";
    state.label = "暂不可购买";
    state.reason = "batch-preview 返回的商品全部是 soldOut:true";
    chrome.action.setBadgeText({ text: "OUT" });
    chrome.action.setBadgeBackgroundColor({ color: "#b45309" });
  } else if (record.status >= 400 || (record.summary && record.summary.code && record.summary.code !== 200)) {
    state.status = "error";
    state.label = "接口异常";
    state.reason = `HTTP ${record.status} / code ${record.summary && record.summary.code}`;
    chrome.action.setBadgeText({ text: "ERR" });
    chrome.action.setBadgeBackgroundColor({ color: "#b91c1c" });
  } else {
    chrome.action.setBadgeText({ text: "LOG" });
    chrome.action.setBadgeBackgroundColor({ color: "#374151" });
  }

  await chrome.storage.local.set({ purchaseState: state });
  await dispatchAutoPurchaseCommand(state.status, sender);
}

async function dispatchAutoPurchaseCommand(status, sender) {
  const { autoPurchaseActive } = await chrome.storage.local.get({ autoPurchaseActive: false });
  if (!autoPurchaseActive) return;

  const tabId = sender && sender.tab && sender.tab.id;
  if (!tabId) return;

  if (status === "available") {
    chrome.tabs.sendMessage(tabId, { type: "ap-click" });
  } else if (status === "soldout" || status === "limited" || status === "busy" || status === "error") {
    const delay = status === "busy" ? REFRESH_DELAY_BUSY : REFRESH_DELAY_NORMAL;
    chrome.tabs.sendMessage(tabId, { type: "ap-reload", delay });
  }
}

async function recordNetworkObservation(item) {
  const current = await chrome.storage.local.get({ networkObservations: [] });
  const observations = Array.isArray(current.networkObservations) ? current.networkObservations : [];
  observations.push(item);
  if (observations.length > 300) observations.splice(0, observations.length - 300);
  await chrome.storage.local.set({ networkObservations: observations, lastNetworkObservation: item });
}

function pathOnly(url) {
  try {
    return new URL(url).pathname;
  } catch (_) {
    return String(url || "").replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  }
}

function handleCaptchaAlert(data, sender) {
  chrome.action.setBadgeText({ text: "CAP" });
  chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  chrome.notifications.create("captcha-" + Date.now(), {
    type: "basic",
    iconUrl: "icon-128.png",
    title: "⚠️ 需要验证码",
    message: `腾讯云验证码弹出（第 ${data.showCount} 次），请切回页面完成滑块验证！`,
    priority: 2,
    requireInteraction: true
  });
  if (sender && sender.tab && sender.tab.id) {
    chrome.tabs.update(sender.tab.id, { active: true });
    chrome.windows.update(sender.tab.windowId, { focused: true });
  }
}
