(() => {
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
      globalsMatchFn: () => typeof self.gtag === 'function' && (self.gtag.toString().includes("consent") || !!self.google_tag_data?.consent)
    },
    { id: 'shopify_native', name: 'Shopify Native', priority: 100, 
      globalsMatchFn: () => typeof self.Shopify?.customerPrivacy === 'object' && (typeof self.Shopify.customerPrivacy.setTrackingConsent === 'function')
    }
  ];

  // ==========================================
  // 2. UTILITIES
  // ==========================================
  const safeURL = (src) => {
    try { return src ? new URL(src, location.href) : null; } catch { return null; }
  };

  const hasAnyGlobal = (names) => names?.some(n => typeof self[n] !== 'undefined');

  // Extracts inline shopify domain from script text
  const waitForShopify = async (timeout = 50) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const rgx = /Shopify\.shop\s*=\s*["']([^"']+)["']/;
      
      const tick = () => {
        for (const s of document.scripts) {
          const m = (s.textContent || "").match(rgx);
          if (m) return resolve(m[1]);
        }
        Date.now() - start < timeout ? requestAnimationFrame(tick) : resolve("");
      };
      tick();
    });
  };

  // ==========================================
  // 3. THE SINGLE-PASS SCANNER
  // ==========================================
  function scanPageEnvironment() {
    const data = {
      scriptUrls: [],
      gtmId: "",
      sgtmHost: false,
      dwinUrls: [],
      tealium: typeof window.utag === "object" ? "Tealium IQ" : "",
      shopifySrc: /(?:^|\.)myshopify\.com$/i.test(location.hostname),
      woo: false,
      adobe: false
    };

    const dwinRegex = /([^/]+)\.js(?:\?.*)?$/;

    // Loop the DOM exactly ONCE
    for (const s of document.scripts) {
      const src = s.src;
      if (!src) continue;

      data.scriptUrls.push(src);

      // Fast substring checks
      if (!data.shopifySrc && src.includes("myshopify.com")) data.shopifySrc = true;
      if (!data.woo && src.includes("woocommerce")) data.woo = true;
      if (!data.adobe && src.includes("adobedtm")) data.adobe = true;
      if (!data.tealium && (src.includes("tiqcdn.com") || src.includes("tealiumiq.com"))) data.tealium = "Tealium IQ";
      
      if (src.includes("dwin1.com")) {
        const m = src.match(dwinRegex);
        if (m && m[1]) data.dwinUrls.push(m[1]);
      }

      // URL Object checks (Parse once per script)
      const u = safeURL(src);
      if (!u) continue;

      const id = u.searchParams.get("id");

      // Standard GTM
      if (!data.gtmId && u.pathname.includes("gtm.js")) {
        data.gtmId = id || "GTM Found";
      }

      // Server-Side GTM
      if (!data.sgtmHost && (id?.startsWith("GTM-") || id?.startsWith("G-") || u.pathname.includes("gtm.js") || u.pathname.includes("gtag/js"))) {
        const isStandardGoogle = u.hostname.includes("googletagmanager.com") || u.hostname.includes("google-analytics.com");
        if (!isStandardGoogle) data.sgtmHost = u.hostname;
      }
    }

    // Catch dynamic loads for CMP via Performance API
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

      if (provider.scripts) {
        hit = scriptUrls.some(u => provider.scripts.some(rx => rx.test(u)));
      }
      if (!hit && provider.scriptsMatchFn) {
        hit = scriptUrls.some(u => provider.scriptsMatchFn(u));
      }
      if (!hit && provider.globals && hasAnyGlobal(provider.globals)) hit = true;
      if (!hit && provider.globalsMatchFn && provider.globalsMatchFn()) hit = true;

      if (hit) found.push(provider);
    });

    if (!found.length) return null;

    found.sort((a, b) => a.priority - b.priority);
    const uniq = Array.from(new Map(found.map(f => [f.id, f])).values()); // Fast dedupe

    return {
      providers: uniq.map(x => x.name),
      tooltip: uniq.map(x => x.name).join(', ')
    };
  }

  // ==========================================
  // 5. MAIN EXECUTION
  // ==========================================
  async function detectAll() {
    const env = scanPageEnvironment();
    const items = [];

    if (env.gtmId) items.push({ id: "gtm", label: env.gtmId });
    if (env.sgtmHost) items.push({ id: "gtss", label: "GTM Server-Side" });

    const shopDomain = await waitForShopify();
    if (env.shopifySrc || shopDomain) {
      items.push({ id: "shopify", label: "Shopify", meta: { shopifyDomain: shopDomain || "" } });
    }

    if (env.woo) items.push({ id: "woocommerce", label: "WooCommerce" });
    if (env.adobe) items.push({ id: "adobe_launch", label: "Adobe Launch" });
    if (env.tealium) items.push({ id: "tealium", label: env.tealium });

    if (env.dwinUrls.length) {
      items.push({ id: "dwin1", label: env.dwinUrls[0], meta: { all: env.dwinUrls } });
    }

    const cmp = detectCMPProviders(env.scriptUrls);
    if (cmp) {
      items.push({ id: 'cmp', label: 'Cookie Consent', meta: { providers: cmp.providers, tooltip: cmp.tooltip } });
    }

    chrome.runtime.sendMessage({ type: "TECH_DETECTIONS", items });
  }

  const run = () => detectAll().catch(() => {});

  // ==========================================
  // 6. EVENT LISTENERS & TRIGGERS
  // ==========================================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === 'REDETECT_NOW') run(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) run(); });

  // SPA Navigation handling
  let lastUrl = location.href;
  const fireOnNav = () => {
    if (location.href !== lastUrl) { lastUrl = location.href; run(); }
  };
  history.pushState = new Proxy(history.pushState, { apply: (tgt, thisArg, argArray) => { tgt.apply(thisArg, argArray); fireOnNav(); }});
  history.replaceState = new Proxy(history.replaceState, { apply: (tgt, thisArg, argArray) => { tgt.apply(thisArg, argArray); fireOnNav(); }});
  window.addEventListener("popstate", fireOnNav);

  // Clean debounced MutationObserver
  let debounceTimer;
  new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });

})();