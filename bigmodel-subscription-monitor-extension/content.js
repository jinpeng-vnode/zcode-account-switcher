(function () {
  "use strict";

  // ====== 配置 ======
  const RELOAD_INTERVAL = 1500;       // 售罄时刷新间隔 ms
  const BUSY_INTERVAL = 2500;         // 系统繁忙时刷新间隔
  const POST_CAPTCHA_WAIT = 4000;     // 验证码完成后等多久再刷
  const WATCHDOG_TIMEOUT = 8000;      // 没收到 batch-preview 多久强制刷新
  const TIER_PRIORITY = ["pro", "max", "lite"]; // 套餐优先级
  const MAX_LOGS = 20;

  let active = false;
  let clicking = false;
  let gotResponse = false;
  let logBuffer = [];

  // ====== 注入 hook ======
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("hook.js");
  (document.documentElement || document.head).appendChild(s);
  s.onload = () => s.remove();

  // ====== 监听 batch-preview 结果 ======
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__BM_TYPE__ !== "batch-preview") return;
    gotResponse = true;
    const json = e.data.payload;
    if (!json || !json.data) return;

    const products = json.data.productList || [];
    const code = json.code;
    const msg = json.msg || json.message || "";

    // 写入套餐状态供侧边栏显示
    const bmProducts = products.map((p) => ({
      name: p.productName || p.name || "",
      tier: /\bPro\b/i.test(p.productName || "") ? "Pro" : /\bMax\b/i.test(p.productName || "") ? "Max" : /\bLite\b/i.test(p.productName || "") ? "Lite" : p.productName || "",
      soldOut: p.soldOut !== false && p.canPurchase !== true
    }));
    chrome.storage.local.set({ bmProducts });

    log(`batch-preview code=${code} msg=${msg} products=${products.length}`);

    if (!active) return;

    // 系统繁忙
    if (code === 555 || /系统繁忙|稍后再试|人数过多/.test(msg)) {
      log("系统繁忙，稍后刷新");
      scheduleReload(BUSY_INTERVAL);
      return;
    }

    // 有可买的
    const buyable = products.filter((p) => p.soldOut === false || p.canPurchase === true);
    if (buyable.length > 0) {
      log("发现可购买商品！尝试点击...");
      notify("可以购买了！快去看看");
      clickBuy();
      return;
    }

    // 全部售罄
    log("售罄，刷新...");
    scheduleReload(RELOAD_INTERVAL);
  });

  // ====== 启动/停止（通过 storage 控制）======
  chrome.storage.local.get({ bmActive: false }, (r) => {
    if (r.bmActive) resume();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.bmActive) {
      if (changes.bmActive.newValue) resume();
      else stop();
    }
  });

  function resume() {
    active = true;
    clicking = false;
    gotResponse = false;
    log("抢购中...");
    scrollToPackages();
    // 看门狗：如果一直没收到 batch-preview 就刷新
    setTimeout(() => {
      if (active && !gotResponse && !clicking) {
        log("超时未收到响应，刷新");
        location.reload();
      }
    }, WATCHDOG_TIMEOUT);
  }

  function stop() {
    active = false;
    clicking = false;
    chrome.storage.local.set({ bmNextReload: null });
    log("已停止");
  }

  // ====== 点击购买 ======
  function clickBuy() {
    if (clicking) return;
    clicking = true;

    // 先切到最优先的标签页
    switchTab();

    let attempt = 0;
    const tryClick = () => {
      if (!active) { clicking = false; return; }
      const btn = findBuyButton();
      if (btn) {
        log("点击: " + btn.textContent.trim().slice(0, 20));
        btn.click();
        setTimeout(confirmDialog, 500);
      } else if (attempt++ < 10) {
        setTimeout(tryClick, 200);
      } else {
        log("没找到按钮，刷新");
        clicking = false;
        scheduleReload(800);
      }
    };
    setTimeout(tryClick, 100);
  }

  function confirmDialog() {
    if (!active) { clicking = false; return; }
    let tries = 0;
    const check = () => {
      // 找弹窗确认按钮
      const btns = Array.from(document.querySelectorAll(".el-dialog button, .el-message-box button"));
      const confirm = btns.find((b) => /已知悉|继续订阅|确认|确定/.test(b.textContent));
      if (confirm && confirm.offsetParent !== null) {
        log("点击确认弹窗");
        confirm.click();
      }
      // 检查是否跳到支付页
      if (location.href.includes("/pay") || location.href.includes("/order") || location.href.includes("/cashier")) {
        log("🎉 跳转支付页了！停止抢购。");
        stop();
        chrome.storage.local.set({ bmActive: false });
        notify("已跳转支付页！快去付款！");
        clicking = false;
        return;
      }
      if (tries++ < 20) {
        setTimeout(check, 300);
      } else {
        log("没跳转，刷新重试");
        clicking = false;
        scheduleReload(600);
      }
    };
    check();
  }

  // ====== 找购买按钮 ======
  function findBuyButton() {
    // 先找 package-card 里的按钮，按优先级排序
    const cards = Array.from(document.querySelectorAll("[class*='package-card'], [class*='product-card'], [class*='plan-card']"));
    const items = cards.map((card) => {
      const btn = card.querySelector("button:not([disabled])");
      if (!btn) return null;
      const text = card.textContent || "";
      let tier = /\bPro\b/i.test(text) ? "pro" : /\bMax\b/i.test(text) ? "max" : /\bLite\b/i.test(text) ? "lite" : "";
      if (!tier) return null;
      const btnText = btn.textContent || "";
      if (/售罄|sold.?out|不可/i.test(btnText)) return null;
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return { btn, tier };
    }).filter(Boolean);

    items.sort((a, b) => TIER_PRIORITY.indexOf(a.tier) - TIER_PRIORITY.indexOf(b.tier));
    if (items.length) return items[0].btn;

    // 兜底：找任何像购买的按钮
    const all = Array.from(document.querySelectorAll("button"));
    return all.find((b) => {
      if (b.disabled) return false;
      const t = b.textContent.trim();
      if (!/订阅|购买|立即|buy|subscribe/i.test(t)) return false;
      if (/售罄|不可/i.test(t)) return false;
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) || null;
  }

  // ====== 切换标签页（连续包季优先）======
  function switchTab() {
    const labels = ["连续包季", "连续包月", "连续包年"];
    for (const label of labels) {
      const tab = Array.from(document.querySelectorAll("[role='tab'], .el-tabs__item, .el-radio-button__inner, button"))
        .find((el) => {
          const t = (el.textContent || "").trim();
          if (!t.includes(label)) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      if (tab) {
        tab.click();
        break;
      }
    }
  }

  // ====== 工具函数 ======
  function scheduleReload(ms) {
    if (!active) return;
    chrome.storage.local.set({ bmNextReload: Date.now() + ms });
    setTimeout(() => {
      if (active) location.reload();
    }, ms);
  }

  function scrollToPackages() {
    const el = document.querySelector("[class*='package'], [class*='subscribe'], .buy-btn");
    if (el) {
      el.scrollIntoView({ block: "start" });
      window.scrollBy(0, -80);
    }
  }

  function notify(msg) {
    if (Notification.permission === "granted") {
      new Notification("BigModel 抢购", { body: msg });
    }
  }

  function log(msg) {
    console.log("[BM抢购]", msg);
    logBuffer.push({ msg, at: new Date().toISOString() });
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();
    chrome.storage.local.set({ bmLogs: logBuffer, bmLog: { msg, at: new Date().toISOString() } });
  }
})();
