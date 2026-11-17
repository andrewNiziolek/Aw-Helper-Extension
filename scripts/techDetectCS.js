// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

(() => {
  console.log("🛠️ [Awin Helper] Tech Detection Script Injected");

  //REGISTRIES & CONFIG
  const CMP_REGISTRY = [
    { id: "onetrust", name: "OneTrust", priority: 10, scripts: [/(^|:\/\/)cdn\.cookielaw\.org\/.*\/otSDKStub\.js(?:\?.*)?$/i, /(^|:\/\/)optanon\.blob\.core\.windows\.net\//i, /(^|:\/\/).*\.onetrust\.com\//i], globals: ["OneTrust", "OptanonActiveGroups", "Optanon"] },
    { id: "cookiebot", name: "Cookiebot", priority: 20, scripts: [/(^|\/\/)consent\.cookiebot\.com\/uc\.js/i, /(^|\/\/).*\.cookiebot\.com\//i], globals: ["Cookiebot"] },
    { id: "iubenda", name: "Iubenda", priority: 30, scripts: [/(^|\/\/)cdn\.iubenda\.com\//i, /(^|\/\/).*\.iubenda\.com\/cookie-policy\//i], globals: ["_iub", "iubenda"] },
    { id: "osano", name: "Osano", priority: 40, scripts: [/(^|\/\/)cmp\.osano\.com\//i, /(^|\/\/).*\.osano\.com\//i], globals: ["Osano", "__osano"] },
    { id: "sourcepoint", name: "SourcePoint", priority: 50, scripts: [/(^|\/\/)cdn\.privacy-mgmt\.com\//i, /(^|\/\/)notice\.sp-prod\.net\//i], globals: ["_sp_", "sp"] },
    { id: "gcm", name: "Google Consent Mode", priority: 60, 
      scriptsMatchFn: (u) => {
        try {
          const url = new URL(u, location.href);
          return url.searchParams?.has("gcs") && (/(^|\/)gtm\.js$/.test(url.pathname) || /(^|\/)(collect|g\/collect)$/.test(url.pathname));
        } catch { return false; }
      },
      globalsMatchFn: () => {
        try { return typeof self.gtag === "function" && (self.gtag.toString().includes("consent") || !!self.google_tag_data?.consent); } catch { return false; }
      }
    },
    { id: "shopify_native", name: "Shopify Native", priority: 100, 
      globalsMatchFn: () => {
        try { return typeof self.Shopify?.customerPrivacy === "object" && typeof self.Shopify.customerPrivacy.setTrackingConsent === "function"; } catch { return false; }
      }
    }
  ];

  // UTILITIES
  const safeURL = (src) => {
    try { return src ? new URL(src, location.href) : null; } catch { return null; }
  };

  const hasAnyGlobal = (names) => {
    try { return names?.some(n => typeof self[n] !== "undefined"); } catch { return false; }
  };

  // --- Shopify .myshopify.com domain extraction ---
  const MYSHOPIFY_RX   = /([a-z0-9][a-z0-9-]*\.myshopify\.com)/i;
  const SHOP_INLINE_RX = /(?:Shopify\.shop\s*=\s*|["']?(?:shop|myshopify_domain|permanent_domain)["']?\s*:\s*)["']([a-z0-9][a-z0-9-]*\.myshopify\.com)["']/i;
  const SHOPIFY_SIG_RX = /myshopify\.com|cdn\.shopify\.com|\/cdn\/shop\//i;

  function extractMyShopify(s=""){ const m = String(s).match(MYSHOPIFY_RX); return m ? m[1].toLowerCase() : ""; }

  let metaJsonDomain = null; // null = not tried yet; "" = tried, nothing found

  // Synchronous DOM/perf sweep, cheapest sources first
  function sweepShopifyDomain() {
    // 1. Host is itself the myshopify domain
    const host = extractMyShopify(location.hostname);
    if (host) return host;

    // 2. Inline script text (Shopify.shop = "...", "shop":"...", myshopify_domain)
    for (const s of document.scripts) {
      if (s.src) continue;
      const m = (s.textContent || "").match(SHOP_INLINE_RX);
      if (m) return m[1].toLowerCase();
    }

    // 3. Script src attributes
    for (const s of document.scripts) {
      const d = extractMyShopify(s.src);
      if (d) return d;
    }

    // 4. Link / meta tags
    try {
      for (const el of document.querySelectorAll('link[href*="myshopify.com"], meta[content*="myshopify.com"]')) {
        const d = extractMyShopify(el.getAttribute("href") || el.getAttribute("content") || "");
        if (d) return d;
      }
    } catch {
      // selector unsupported? skip
    }

    // 5. Resource timing entries (headless Storefront API calls, late assets)
    try {
      for (const e of performance.getEntriesByType("resource")) {
        const d = extractMyShopify(e?.name);
        if (d) return d;
      }
    } catch {
      // perf API unavailable
    }

    return "";
  }

  // 6. Same-origin /meta.json fallback (Liquid storefronts), at most once per page
  async function fetchMetaJsonDomain() {
    if (metaJsonDomain !== null) return metaJsonDomain;
    metaJsonDomain = "";
    try {
      const res = await fetch("/meta.json", { cache: "force-cache", credentials: "omit" });
      if (res.ok) {
        const data = await res.json();
        metaJsonDomain = extractMyShopify(data?.myshopify_domain || "");
      }
    } catch {
      // not a liquid storefront
    }
    return metaJsonDomain;
  }

  async function findShopifyDomain(env, tries = 3, delay = 250) {
    for (let i = 0; i < tries; i++) {
      const d = sweepShopifyDomain();
      if (d) return d;
      if (!env?.shopifySrc) break; // no Shopify signal: don't wait around
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delay));
    }
    return env?.shopifySrc ? await fetchMetaJsonDomain() : "";
  }

  // SINGLE-PASS SCANNER
  function scanPageEnvironment() {
    const data = {
      scriptUrls: [], gtmId: "", sgtmHost: false, dwinUrls: [],
      tealium: "", shopifySrc: /(?:^|\.)myshopify\.com$/i.test(location.hostname),
      shopifyDomain: extractMyShopify(location.hostname),
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

      if (SHOPIFY_SIG_RX.test(src)) {
        data.shopifySrc = true;
        if (!data.shopifyDomain) data.shopifyDomain = extractMyShopify(src);
      }
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
      for (const e of performance.getEntriesByType("resource")) {
        if (typeof e?.name === "string") data.scriptUrls.push(e.name);
      }
    } catch {}

    return data;
  }

  //CMP DETECTOR
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

    return { providers: uniq.map(x => x.name), tooltip: uniq.map(x => x.name).join(", ") };
  }

  // MAIN EXECUTION
  async function detectAll() {

    if (!chrome.runtime?.id) {
    console.warn("Awin Helper: Extension updated. Please refresh the page.");
    return;
    }

    console.group("[Awin Helper] Detection Run");
    const env = scanPageEnvironment();
    console.log("Raw Scanned Data:", env);
    
    const items = [];
    if (env.gtmId) items.push({ id: "gtm", label: env.gtmId });
    if (env.sgtmHost) items.push({ id: "gtss", label: "GTM Server-Side" });

    const shopDomain = env.shopifyDomain || await findShopifyDomain(env);
    if (env.shopifySrc || shopDomain) items.push({ id: "shopify", label: "Shopify", meta: { shopifyDomain: shopDomain || "" } });

    if (env.woo) items.push({ id: "woocommerce", label: "WooCommerce" });
    if (env.adobe) items.push({ id: "adobe_launch", label: "Adobe Launch" });
    if (env.tealium) items.push({ id: "tealium", label: env.tealium });
    if (env.dwinUrls.length) items.push({ id: "dwin1", label: env.dwinUrls[0], meta: { all: env.dwinUrls } });

    const cmp = detectCMPProviders(env.scriptUrls);
    if (cmp) items.push({ id: "cmp", label: "Cookie Consent", meta: { providers: cmp.providers, tooltip: cmp.tooltip } });

    console.log("Final Items Payload:", items);
    console.groupEnd();

    chrome.runtime.sendMessage({ type: "TECH_DETECTIONS", items }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Awin Helper] Background Connection Failed:", chrome.runtime.lastError.message);
      } else {
        console.log("✅ [Awin Helper] Successfully sent to background!");
      }
    });
  }

  const run = () => detectAll().catch(e => console.error("[Awin Helper] Fatal Run Error:", e));

  //EVENT LISTENERS
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === "REDETECT_NOW") run(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") run(); });
  
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
  // Only re-run when new <script> tags appear; detection doesn't depend on other DOM changes
  const addsScript = (mutations) => mutations.some(m => {
    for (const n of m.addedNodes) if (n.nodeName === "SCRIPT") return true;
    return false;
  });

  new MutationObserver((mutations) => {
    if (isThrottled || !addsScript(mutations)) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      isThrottled = true; run(); setTimeout(() => { isThrottled = false; }, 1500); 
    }, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });

})();