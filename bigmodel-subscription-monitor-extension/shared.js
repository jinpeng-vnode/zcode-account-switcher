const Shared = (() => {
  const PERIOD_PRIORITY = ["quarter", "month", "year"];
  const TIER_PRIORITY = ["pro", "max", "lite"];

  const PERIOD_LABELS = {
    quarter: "连续包季",
    month: "连续包月",
    year: "连续包年"
  };

  const PRODUCT_PERIOD_BY_ID = {
    "product-b8ea38": "quarter",
    "product-fef82f": "quarter",
    "product-5d3a03": "quarter",
    "product-02434c": "month",
    "product-1df3e1": "month",
    "product-2fc421": "month",
    "product-70a804": "year",
    "product-5643e6": "year",
    "product-d46f8b": "year"
  };

  const PRODUCT_TIER_BY_ID = {
    "product-b8ea38": "lite",
    "product-02434c": "lite",
    "product-70a804": "lite",
    "product-fef82f": "pro",
    "product-1df3e1": "pro",
    "product-5643e6": "pro",
    "product-5d3a03": "max",
    "product-2fc421": "max",
    "product-d46f8b": "max"
  };

  function normalizeSettings(value) {
    return {
      periodPriority: normalizePriority(value && value.periodPriority, PERIOD_PRIORITY),
      tierPriority: normalizePriority(value && value.tierPriority, TIER_PRIORITY)
    };
  }

  function normalizePriority(value, fallback) {
    const list = Array.isArray(value) ? value : [];
    const deduped = list.filter((item, index) => fallback.includes(item) && list.indexOf(item) === index);
    return deduped.concat(fallback.filter((item) => !deduped.includes(item)));
  }

  function priorityIndex(priority, value) {
    const index = priority.indexOf(value);
    return index === -1 ? 999 : index;
  }

  function getProductPeriod(product) {
    if (!product) return "";
    if (PRODUCT_PERIOD_BY_ID[product.productId]) return PRODUCT_PERIOD_BY_ID[product.productId];
    const raw = String(product.subscribePeriod || product.unit || product.unitText || "").toLowerCase();
    if (raw.includes("quarter") || raw.includes("季")) return "quarter";
    if (raw.includes("month") || raw.includes("月")) return "month";
    if (raw.includes("year") || raw.includes("年")) return "year";
    return "";
  }

  function getProductTier(product) {
    if (!product) return "";
    if (PRODUCT_TIER_BY_ID[product.productId]) return PRODUCT_TIER_BY_ID[product.productId];
    const raw = String(product.type || product.productName || product.tier || "").toLowerCase();
    if (raw.includes("lite")) return "lite";
    if (raw.includes("pro")) return "pro";
    if (raw.includes("max")) return "max";
    return "";
  }

  function isProductAvailable(product) {
    if (!product || product.isLimitBuy === true || product.forbidden === true) return false;
    return product.soldOut === false || product.canPurchase === true || product.disabled === false;
  }

  function getBestAvailableProduct(products, settings) {
    const s = settings || normalizeSettings(null);
    const available = (products || []).filter(isProductAvailable);
    if (!available.length) return null;
    available.sort((a, b) => {
      const periodDiff = priorityIndex(s.periodPriority, getProductPeriod(a)) - priorityIndex(s.periodPriority, getProductPeriod(b));
      if (periodDiff !== 0) return periodDiff;
      return priorityIndex(s.tierPriority, getProductTier(a)) - priorityIndex(s.tierPriority, getProductTier(b));
    });
    return available[0];
  }

  function periodText(period) {
    return PERIOD_LABELS[period] || "";
  }

  return {
    PERIOD_PRIORITY,
    TIER_PRIORITY,
    PERIOD_LABELS,
    PRODUCT_PERIOD_BY_ID,
    PRODUCT_TIER_BY_ID,
    normalizeSettings,
    normalizePriority,
    priorityIndex,
    getProductPeriod,
    getProductTier,
    isProductAvailable,
    getBestAvailableProduct,
    periodText
  };
})();
