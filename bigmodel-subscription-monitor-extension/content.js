(function () {
  const MAX_LOGS = 1000;
  const TARGET_BATCH_PREVIEW = "/api/biz/pay/batch-preview";
  const AUTO_PURCHASE_INTERVAL = 100;

  let monitorSettings = Shared.normalizeSettings(null);

  injectHook();
  loadSettings();
  detectWafBlock();
  scheduleInitialScroll();
  startCaptchaMonitor();
  resumeAutoPurchaseIfActive();

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== "BIGMODEL_SUBSCRIPTION_MONITOR" || message.type !== "api-response") return;
    const record = message.record;
    if (!record || !record.path) return;

    await appendLog(record);
    chrome.runtime.sendMessage({ type: "api-response", record });

    if (record.path === TARGET_BATCH_PREVIEW) {
      const products = record.summary && Array.isArray(record.summary.productList) ? record.summary.productList : [];
      const responseCode = record.summary && record.summary.code;
      autoSwitchToBestAvailableTab(products, responseCode);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;
    if (message.type === "scroll-to-package-area") scrollToPackageArea();
    if (message.type === "start-auto-purchase") startAutoPurchase();
    if (message.type === "stop-auto-purchase") stopAutoPurchase();
    if (message.type === "ap-click") onApClick();
    if (message.type === "ap-reload") onApReload(message.delay || 800);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.monitorSettings) return;
    monitorSettings = Shared.normalizeSettings(changes.monitorSettings.newValue);
  });

  // ===== Inject & Settings =====

  function injectHook() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("page-hook.js");
    script.async = false;
    (document.documentElement || document.head).appendChild(script);
    script.remove();
  }

  async function loadSettings() {
    const { monitorSettings: stored } = await chrome.storage.local.get({ monitorSettings: null });
    monitorSettings = Shared.normalizeSettings(stored);
  }

  async function appendLog(record) {
    const current = await chrome.storage.local.get({ logs: [] });
    const logs = Array.isArray(current.logs) ? current.logs : [];
    logs.push(record);
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
    await chrome.storage.local.set({ logs, lastRecord: record });
  }

  // ===== WAF & Scroll =====

  async function detectWafBlock() {
    const title = document.title || "";
    const bodyText = document.body ? document.body.innerText || "" : "";
    const isWafBlock =
      title.trim() === "405" ||
      bodyText.includes("您的访问被阻断") ||
      bodyText.includes("your request has been blocked");

    if (!isWafBlock) return;

    let traceid = "";
    try {
      const renderData = document.getElementById("renderData");
      if (renderData && renderData.value) {
        traceid = JSON.parse(renderData.value).traceid || "";
      }
    } catch (_) {}

    const state = {
      updatedAt: new Date().toISOString(),
      status: "waf",
      label: "访问被阻断",
      reason: traceid ? `WAF/安全防护阻断，traceid=${traceid}` : "WAF/安全防护阻断",
      products: [],
      record: {
        at: new Date().toISOString(),
        method: "PAGE",
        status: 405,
        path: location.pathname,
        durationMs: 0,
        requestBody: "",
        summary: { code: 405, msg: "访问被阻断", traceid }
      }
    };

    await chrome.storage.local.set({ purchaseState: state });
  }

  function scheduleInitialScroll() {
    window.addEventListener("load", () => {
      setTimeout(scrollToPackageArea, 150);
    }, { once: true });
  }

  function scrollToPackageArea() {
    const target =
      document.querySelector(".claude-code-package-box") ||
      document.querySelector(".glm-coding-package-list") ||
      document.querySelector(".package-card-box") ||
      document.querySelector(".buy-btn");

    if (!target) return;
    target.scrollIntoView({ behavior: "auto", block: "start" });
    window.scrollBy({ top: -80, left: 0, behavior: "auto" });
  }

  // ===== Tab Switching =====

  function autoSwitchToBestAvailableTab(products, responseCode) {
    if (responseCode && responseCode !== 200) return;
    const best = Shared.getBestAvailableProduct(products, monitorSettings);
    const bestPeriod = best ? Shared.getProductPeriod(best) : "";
    if (!bestPeriod) return;

    const now = Date.now();
    if (window.__bigmodelLastAutoTab === bestPeriod && now - (window.__bigmodelLastAutoTabAt || 0) < 1500) return;
    window.__bigmodelLastAutoTab = bestPeriod;
    window.__bigmodelLastAutoTabAt = now;

    switchToPeriodTab(bestPeriod);
    setTimeout(scrollToPackageArea, 50);
  }

  function switchToPeriodTab(period) {
    const label = Shared.PERIOD_LABELS[period];
    if (!label) return;

    const candidates = Array.from(document.querySelectorAll("button, [role='tab'], div, span"))
      .filter((el) => {
        const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
        if (!text || !text.includes(label)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .sort((a, b) => clickableScore(b) - clickableScore(a));

    const target = candidates[0];
    if (!target) return;
    const clickable = target.closest("button, [role='tab'], .el-radio-button, .el-tabs__item, .switch-tab-item, .tab-item") || target;
    clickable.click();
  }

  function clickableScore(el) {
    const style = getComputedStyle(el);
    let score = 0;
    if (el.matches("button, [role='tab']")) score += 10;
    if (style.cursor === "pointer") score += 5;
    if ((el.className || "").toString().includes("active")) score -= 2;
    return score;
  }

  // ===== Auto-Purchase =====

  let autoPurchaseDone = false;
  let autoPurchaseActive = false;

  async function startAutoPurchase() {
    autoPurchaseActive = true;
    autoPurchaseDone = false;
    await chrome.storage.local.set({ autoPurchaseActive: true });
    logAutoPurchase("自动抢购已启动，等待 batch-preview 响应判断状态...");
    setInterval(tryAutoPurchase, AUTO_PURCHASE_INTERVAL);
    observeButtonChanges();
  }

  async function resumeAutoPurchaseIfActive() {
    const { autoPurchaseActive: active } = await chrome.storage.local.get({ autoPurchaseActive: false });
    if (active) {
      autoPurchaseActive = true;
      logAutoPurchase("页面刷新后恢复自动抢购，等待 batch-preview 响应...");
      setInterval(tryAutoPurchase, AUTO_PURCHASE_INTERVAL);
      observeButtonChanges();
    }
  }

  async function stopAutoPurchase() {
    autoPurchaseActive = false;
    autoPurchaseDone = true;
    await chrome.storage.local.set({ autoPurchaseActive: false });
    logAutoPurchase("自动抢购已停止");
  }

  function onApClick() {
    if (!autoPurchaseActive || autoPurchaseDone) return;
    logAutoPurchase("检测到可购买商品，正在尝试点击购买按钮...");
    tryAutoPurchase();
  }

  function onApReload(delay) {
    if (!autoPurchaseActive || autoPurchaseDone) return;
    if (captchaState.isVisible) {
      logAutoPurchase("验证码弹出中，暂停刷新，等验证完成后继续");
      return;
    }
    const finalDelay = getCaptchaThrottledInterval(delay);
    logAutoPurchase(`${finalDelay}ms 后刷新`);
    setTimeout(() => {
      if (autoPurchaseDone || !autoPurchaseActive) return;
      if (captchaState.isVisible) return;
      location.reload();
    }, finalDelay);
  }

  function getCaptchaThrottledInterval(baseInterval) {
    if (captchaState.showCount === 0) return baseInterval;
    const sinceLastCaptcha = Date.now() - (captchaState.lastCompletedAt || captchaState.lastShownAt);
    if (sinceLastCaptcha < 30000) return Math.max(baseInterval, 3000);
    if (sinceLastCaptcha < 60000) return Math.max(baseInterval, 1500);
    return baseInterval;
  }

  function tryAutoPurchase() {
    if (autoPurchaseDone) return;
    tryAutoConfirmDialog();
    const btn = findBestEnabledButton();
    if (!btn) return;
    autoPurchaseDone = true;
    logAutoPurchase(`发现可购买按钮 [${btn.textContent.trim().slice(0, 20)}]，正在自动点击...`);
    btn.click();
    setTimeout(() => tryAutoConfirmDialog(), 500);
    setTimeout(() => { autoPurchaseDone = false; }, 3000);
  }

  function findBestEnabledButton() {
    const cards = findProductCards();
    if (!cards.length) return null;

    const tierPriority = monitorSettings.tierPriority || Shared.TIER_PRIORITY;
    const ranked = cards
      .filter((card) => card.button && !card.button.disabled)
      .filter((card) => !/售罄|sold\s*out/i.test(card.button.textContent || ""))
      .sort((a, b) => Shared.priorityIndex(tierPriority, a.tier) - Shared.priorityIndex(tierPriority, b.tier));

    return ranked.length ? ranked[0].button : null;
  }

  function findProductCards() {
    const cards = Array.from(document.querySelectorAll(".package-card"));
    return cards.map((card) => {
      const btn = card.querySelector(".package-card-btn-box button");
      if (!btn) return null;
      const titleEl = card.querySelector(".package-card-title");
      const titleText = titleEl ? titleEl.textContent.trim() : "";
      let tier = "";
      if (/^Pro/i.test(titleText)) tier = "pro";
      else if (/^Max/i.test(titleText)) tier = "max";
      else if (/^Lite/i.test(titleText)) tier = "lite";
      return { button: btn, tier, card };
    }).filter(Boolean).filter((item) => item.tier);
  }

  function tryAutoConfirmDialog() {
    const dialog = document.querySelector(".el-dialog__wrapper.old-user-dialog");
    if (!dialog || dialog.style.display === "none" || getComputedStyle(dialog).display === "none") return;
    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes("已知悉") || btn.textContent.includes("继续订阅")
    );
    if (confirmBtn && confirmBtn.offsetParent !== null) {
      logAutoPurchase("检测到确认弹窗，自动点击「已知悉，继续订阅」");
      confirmBtn.click();
    }
  }

  function observeButtonChanges() {
    const observer = new MutationObserver(() => {
      if (!autoPurchaseDone) tryAutoPurchase();
    });
    const target = document.querySelector(".glm-coding-package-list") || document.querySelector(".package-card-box") || document.body;
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "class", "style"] });
    const dialogObserver = new MutationObserver(() => tryAutoConfirmDialog());
    const dialogTarget = document.querySelector(".old-user-dialog") || document.body;
    dialogObserver.observe(dialogTarget, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
  }

  function logAutoPurchase(msg) {
    const timestamp = new Date().toISOString();
    console.log(`[AutoPurchase ${timestamp}] ${msg}`);
    chrome.storage.local.set({ autoPurchaseLog: { msg, at: timestamp } });
  }

  // ===== Captcha Detection & Handling =====

  const CAPTCHA_SELECTOR = "#tcaptcha_transform_dy";
  const CAPTCHA_ALERT_SOUND_URL = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAAD/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/+f/5//n/9f/1//H/8f/t/+3/6f/p/+X/4f/h/93/3f/Z/9n/1f/R/9H/zf/N/8n/xf/F/8H/wf+9/73/uf+5/7X/tf+x/7H/rf+t/6n/qf+l/6X/of+h/53/nf+Z/5n/lf+V/5H/kf+N/43/if+J/4X/hf+B/4H/ff99/3n/ef91/3X/cf9x/23/bf9p/2n/Zf9l/2H/Yf9d/13/Wf9Z/1X/Vf9R/1H/Tf9N/0n/Sf9F/0X/Qf9B/z3/Pf85/zn/Nf81/zH/Mf8t/y3/Kf8p/yX/Jf8h/yH/Hf8d/xn/Gf8V/xX/Ef8R/w3/Df8J/wn/Bf8F/wH/Af79/v3++f75/vX+9f7x/vH+7f7t/un+6f7l/uX+4f7h/t3+3f7Z/tn+1f7V/tH+0f7N/s3+yf7J/sX+xf7B/sH+vf69/rn+uf61/rX+sf6x/q3+rf6p/qn+pf6l/qH+of6d/p3+mf6Z/pX+lf6R/pH+jf6N/on+if6F/oX+gf6B/n3+ff55/nn+df51/nH+cf5t/m3+af5p/mX+Zf5h/mH+Xf5d/ln+Wf5V/lX+Uf5R/k3+Tf5J/kn+Rf5F/kH+Qf49/j3+Of45/jX+Nf4x/jH+Lf4t/in+Kf4l/iX+If4h/h3+Hf4Z/hn+Ff4V/hH+Ef4N/g3+Cf4J/gX+Bf4B/gH9/f39/fn9+f31/fX98f3x/e397f3p/en95f3l/eH94f3d/d392f3Z/dX91f3R/dH9zf3N/cn9yf3F/cX9wf3B/b39vf25/bn9tf21/bH9sf2t/a39qf2p/aX9pf2h/aH9nf2d/Zn9mf2V/ZX9kf2R/Y39jf2J/Yn9hf2F/YH9gf2B/YH9hf2F/Yn9if2N/Y39kf2R/ZX9lf2Z/Zn9nf2d/aH9of2l/aX9qf2p/a39rf2x/bH9tf21/bn9uf29/b39wf3B/cX9xf3J/cn9zf3N/dH90f3V/dX92f3Z/d393f3h/eH95f3l/en96f3t/e398f3x/fX99f35/fn9/f39/gH+Af4F/gX+Cf4J/g3+Df4R/hH+Ff4V/hn+Gf4d/h3+If4h/iX+Jf4p/in+Lf4t/jH+Mf41/jX+Of45/j3+Pf5B/kH+Rf5F/kn+Sf5N/k3+Uf5R/lX+Vf5Z/ln+Xf5d/mH+Yf5l/mX+af5p/m3+bf5x/nH+df51/nn+ef59/n3+gf6B/oX+hf6J/on+jf6N/pH+kf6V/pX+mf6Z/p3+nf6h/qH+pf6l/qn+qf6t/q3+sf6x/rX+tf65/rn+vf69/sH+wf7F/sX+yf7J/s3+zf7R/tH+1f7V/tn+2f7d/t3+4f7h/uX+5f7p/un+7f7t/vH+8f71/vX++f75/v3+/f8B/wH/Bf8F/wn/Cf8N/w3/Ef8R/xX/Ff8Z/xn/Hf8d/yH/If8l/yX/Kf8p/y3/Lf8x/zH/Nf81/zn/Of89/z3/Qf9B/0X/Rf9J/0n/Tf9N/1H/Uf9V/1X/Wf9Z/13/Xf9h/2H/Zf9l/2n/af9t/23/cf9x/3X/df95/3n/ff99/4H/gf+F/4X/if+J/43/jf+R/5H/lf+V/5n/mf+d/53/of+h/6X/pf+p/6n/rf+t/7H/sf+1/7X/uf+5/73/vf/B/8H/xf/F/8n/yf/N/83/0f/R/9X/1f/Z/9n/3f/d/+H/4f/l/+X/6f/p/+3/7f/x//H/9f/1//n/+f/9//3//f/9/";
  const captchaState = {
    isVisible: false,
    showCount: 0,
    lastShownAt: 0,
    lastCompletedAt: 0
  };

  function startCaptchaMonitor() {
    observeCaptchaElement();
    pollCaptchaVisibility();
  }

  function observeCaptchaElement() {
    const existing = document.querySelector(CAPTCHA_SELECTOR);
    if (existing) {
      watchCaptchaStyle(existing);
      return;
    }

    const bodyObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node.id === "tcaptcha_transform_dy" ? node : node.querySelector && node.querySelector(CAPTCHA_SELECTOR);
          if (el) {
            watchCaptchaStyle(el);
            bodyObserver.disconnect();
            return;
          }
        }
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function watchCaptchaStyle(el) {
    const check = () => {
      const style = getComputedStyle(el);
      const visible = parseFloat(style.opacity) > 0.1 && parseInt(style.top) > -10000;
      if (visible && !captchaState.isVisible) {
        onCaptchaShow();
      } else if (!visible && captchaState.isVisible) {
        onCaptchaHide();
      }
    };

    const styleObserver = new MutationObserver(check);
    styleObserver.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
    check();
  }

  function pollCaptchaVisibility() {
    setInterval(() => {
      const el = document.querySelector(CAPTCHA_SELECTOR);
      if (!el) return;
      const style = getComputedStyle(el);
      const visible = parseFloat(style.opacity) > 0.1 && parseInt(style.top) > -10000;
      if (visible && !captchaState.isVisible) {
        onCaptchaShow();
      } else if (!visible && captchaState.isVisible) {
        onCaptchaHide();
      }
    }, 500);
  }

  function onCaptchaShow() {
    captchaState.isVisible = true;
    captchaState.showCount++;
    captchaState.lastShownAt = Date.now();
    logAutoPurchase("⚠️ 验证码弹出！请手动完成滑块验证");
    playCaptchaAlert();
    sendCaptchaNotification();
    updateCaptchaPanel(true);
  }

  function onCaptchaHide() {
    if (!captchaState.isVisible) return;
    captchaState.isVisible = false;
    captchaState.lastCompletedAt = Date.now();
    const elapsed = Date.now() - captchaState.lastShownAt;
    logAutoPurchase(`验证码已完成 (耗时 ${Math.round(elapsed / 1000)}s)，2秒后自动刷新`);
    updateCaptchaPanel(false);
    if (autoPurchaseActive) {
      setTimeout(() => { location.reload(); }, 2000);
    }
  }

  function playCaptchaAlert() {
    try {
      const audio = new Audio(CAPTCHA_ALERT_SOUND_URL);
      audio.volume = 0.8;
      audio.play().catch(() => {});
      setTimeout(() => { audio.play().catch(() => {}); }, 1500);
    } catch (_) {}
  }

  function sendCaptchaNotification() {
    try {
      chrome.runtime.sendMessage({
        type: "captcha-alert",
        data: { showCount: captchaState.showCount, at: new Date().toISOString() }
      });
    } catch (_) {}
  }

  function updateCaptchaPanel(visible) {
    chrome.storage.local.set({
      captchaState: { visible, showCount: captchaState.showCount, at: new Date().toISOString() }
    });
  }
})();
