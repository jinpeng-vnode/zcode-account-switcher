// 注入到页面上下文，拦截 fetch 抓 batch-preview 响应
(function () {
  if (window.__BM_HOOK__) return;
  window.__BM_HOOK__ = true;

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const resp = await origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (url.includes("/api/biz/pay/batch-preview")) {
        const clone = resp.clone();
        clone.json().then((json) => {
          window.postMessage({ __BM_TYPE__: "batch-preview", payload: json }, "*");
        }).catch(() => {});
      }
    } catch (_) {}
    return resp;
  };
})();
