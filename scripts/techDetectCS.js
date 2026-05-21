(() => {
  console.log("🛠️ [Awin Helper] Tech Detection Script Injected");

  // ==========================================
  // 1. REGISTRIES & CONFIG
  // ==========================================
  const CMP_REGISTRY = [
    { id: 'onetrust', name: 'OneTrust', priority: 10, scripts: [/(^|:\/\/)cdn\.cookielaw\.org\/.*\/otSDKStub\.js(?:\?.*)?$/i, /(^|:\/\/)optanon\.blob\.core\.windows\.net\//i, /(^|:\/\/).*\.onetrust\.com\//i], globals: ['OneTrust', 'OptanonActiveGroups', 'Optanon'] },
    { id: 'cookiebot', name: 'Cookiebot', priority: 20, scripts: [/(^|\/\/)consent\.cookiebot\.com\/uc\.js/i, /(^|\/\/).*\.cookiebot\.com\//i], globals: ['Cookiebot'] },
    { id: 'iubenda', name: 'Iubenda', priority: 30, scripts: [/(^|\/\/)cdn\.iubenda\.com\//i, /(^|\/\/).*\.iubenda\.com\/cookie-policy\//i], globals: ['_iub', 'iubenda'] },
    { id: 'osano', name: 'Osano', priority: 40, scripts: [/(^|\/\/)cmp\.osano\.com\//i, /(^|\/\/).*\.osano\.com\//i], globals: ['Osano', '__osano'] },
    { id: 'sourcepoint', name: 'SourcePoint', priority: 50, scripts: [/(^|\/\/)cdn\.privacy-mgmt\.com\//i, /(^|\/\/)notice\.sp-prod\.net\//i], globals: ['_sp_', 'sp'] },
    { id: 'gcm', name: 'Google Consent Mode', priority: 60, 
      scriptsMatchFn: (u) => {
        try {
          const url = new URL(u, location.href);
          return url.searchParams?.has('gcs') && (/(^|\/)gtm\.js$/.test(url.pathname) || /(^|\/)(collect|g\/collect)$/.test(url.pathname));
        } catch { return false; }
      },
      globalsMatchFn: () => {
        try { return typeof self.gtag === 'function' && (self.gtag.toString().includes("consent") || !!self.google_tag_data?.consent); } catch { return false; }
      }
    },
    { id: 'shopify_native', name: 'Shopify Native', priority: 100, 
      globalsMatchFn: () => {
        try { return typeof self.Shopify?.customerPrivacy === 'object' && typeof self.Shopify.customerPrivacy.setTrackingConsent === 'function'; } catch { return false; }
      }
    }
  ];

  // ==========================================
  // 2. UTILITIES
  // ==========================================
  const safeURL = (src) => {
    try { return src ? new URL(src, location.href) : null; } catch { return null; }
  };

  const hasAnyGlobal = (names) => {
    try { return names?.some(n => typeof self[n] !== 'undefined'); } catch { return false; }
  };

  const waitForShopify = async (timeout = 50) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const rgx = /Shopify\.shop\s*=\s*["']([^"']+)["']/;
      
      const tick = () => {
        for (const s of document.scripts) {
          const m = (s.textContent || "").match(rgx);
          if (m) return resolve(m[1]);
        }
        Date.now() - start < timeout ? setTimeout(tick, 10) : resolve("");
      };
      tick();
    });
  };

  // ==========================================
  // 3. THE SINGLE-PASS SCANNER
  // ==========================================
  function scanPageEnvironment() {
    const data = {
      scriptUrls: [], gtmId: "", sgtmHost: false, dwinUrls: [],
      tealium: "", shopifySrc: /(?:^|\.)myshopify\.com$/i.test(location.hostname),
      woo: false, adobe: false
    };

    try {
      if (typeof window.utag === "object") data.tealium = "Tealium IQ";
    } catch (e) {}

    const dwinRegex = /([^/]+)\.js(?:\?.*)?$/;

    for (const s of document.scripts) {
      const src = s.src;
      if (!src) continue;

      data.scriptUrls.push(src);

      if (!data.shopifySrc && src.includes("myshopify.com")) data.shopifySrc = true;
      if (!data.woo && src.includes("woocommerce")) data.woo = true;
      if (!data.adobe && src.includes("adobedtm")) data.adobe = true;
      if (!data.tealium && (src.includes("tiqcdn.com") || src.includes("tealiumiq.com"))) data.tealium = "Tealium IQ";
      
      if (src.includes("dwin1.com")) {
        const m = src.match(dwinRegex);
        if (m && m[1]) data.dwinUrls.push(m[1]);
      }

      const u = safeURL(src);
      if (!u) continue;

      const id = u.searchParams.get("id");

      if (!data.gtmId && (u.pathname.includes("gtm.js") || u.pathname.includes("gtag/js"))) {
        data.gtmId = id || "GTM Found";
      }

      if (!data.sgtmHost && (id?.startsWith("GTM-") || id?.startsWith("G-") || u.pathname.includes("gtm.js") || u.pathname.includes("gtag/js"))) {
        const isStandardGoogle = u.hostname.includes("googletagmanager.com") || u.hostname.includes("google-analytics.com");
        if (!isStandardGoogle) data.sgtmHost = u.hostname;
      }
    }

    try {
      for (const e of performance.getEntriesByType('resource')) {
        if (typeof e?.name === 'string') data.scriptUrls.push(e.name);
      }
    } catch {}

    return data;
  }

  // ==========================================
  // 4. CMP DETECTOR
  // ==========================================
  function detectCMPProviders(scriptUrls) {
    const found = [];

    CMP_REGISTRY.forEach(provider => {
      let hit = false;
      if (provider.scripts) hit = scriptUrls.some(u => provider.scripts.some(rx => rx.test(u)));
      if (!hit && provider.scriptsMatchFn) hit = scriptUrls.some(u => provider.scriptsMatchFn(u));
      if (!hit && provider.globals && hasAnyGlobal(provider.globals)) hit = true;
      if (!hit && provider.globalsMatchFn && provider.globalsMatchFn()) hit = true;

      if (hit) found.push(provider);
    });

    if (!found.length) return null;

    found.sort((a, b) => a.priority - b.priority);
    const uniq = Array.from(new Map(found.map(f => [f.id, f])).values());

    return { providers: uniq.map(x => x.name), tooltip: uniq.map(x => x.name).join(', ') };
  }

  // ==========================================
  // 5. MAIN EXECUTION
  // ==========================================
  async function detectAll() {
    console.group("[Awin Helper] Detection Run");
    const env = scanPageEnvironment();
    console.log("Raw Scanned Data:", env);
    
    const items = [];
    if (env.gtmId) items.push({ id: "gtm", label: env.gtmId });
    if (env.sgtmHost) items.push({ id: "gtss", label: "GTM Server-Side" });

    const shopDomain = await waitForShopify();
    if (env.shopifySrc || shopDomain) items.push({ id: "shopify", label: "Shopify", meta: { shopifyDomain: shopDomain || "" } });

    if (env.woo) items.push({ id: "woocommerce", label: "WooCommerce" });
    if (env.adobe) items.push({ id: "adobe_launch", label: "Adobe Launch" });
    if (env.tealium) items.push({ id: "tealium", label: env.tealium });
    if (env.dwinUrls.length) items.push({ id: "dwin1", label: env.dwinUrls[0], meta: { all: env.dwinUrls } });

    const cmp = detectCMPProviders(env.scriptUrls);
    if (cmp) items.push({ id: 'cmp', label: 'Cookie Consent', meta: { providers: cmp.providers, tooltip: cmp.tooltip } });

    console.log("Final Items Payload:", items);
    console.groupEnd();

    // The Wake-Up Fix: Using a callback forces Chrome to wake the background Service Worker
    chrome.runtime.sendMessage({ type: "TECH_DETECTIONS", items }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Awin Helper] Background Connection Failed:", chrome.runtime.lastError.message);
      } else {
        console.log("✅ [Awin Helper] Successfully sent to background!");
      }
    });
  }

  const run = () => detectAll().catch(e => console.error("[Awin Helper] Fatal Run Error:", e));

  // ==========================================
  // 6. EVENT LISTENERS
  // ==========================================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === 'REDETECT_NOW') run(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
  
  try {
    let lastUrl = location.href;
    const fireOnNav = () => { if (location.href !== lastUrl) { lastUrl = location.href; run(); } };
    const { pushState, replaceState } = history;
    history.pushState = function () { pushState.apply(this, arguments); fireOnNav(); };
    history.replaceState = function () { replaceState.apply(this, arguments); fireOnNav(); };
    window.addEventListener("popstate", fireOnNav);
  } catch (e) { console.warn("[Awin Helper] SPA routing binding skipped", e); }

  let debounceTimer = null;
  let isThrottled = false;
  new MutationObserver(() => {
    if (isThrottled) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      isThrottled = true; run(); setTimeout(() => { isThrottled = false; }, 1500); 
    }, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });

})();