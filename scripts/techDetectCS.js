// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

(() => {
  console.log("🛠️ [Awin Helper] Tech Detection Script Injected");

  // CONFIG (scripts/trackingDetect.js, loaded first in the same isolated world)
  const CFG = globalThis.AWH_DETECT_CONFIG || {};

  // UTILITIES
  const safeURL = (src) => {
    try { return src ? new URL(src, location.href) : null; } catch { return null; }
  };

  function safeDecode(s=""){ try { return decodeURIComponent(s); } catch { return s; } }

  // document.cookie -> Map(name -> raw value); first-party, non-HttpOnly cookies only
  function readCookies() {
    const jar = new Map();
    try {
      for (const part of document.cookie.split(";")) {
        const i = part.indexOf("=");
        if (i < 1) continue;
        const name = part.slice(0, i).trim();
        if (name && !jar.has(name)) jar.set(name, part.slice(i + 1).trim());
      }
    } catch {
      // cookies blocked (sandboxed frame)
    }
    return jar;
  }

  function findCookie(jar, spec) {
    if (spec?.name) return jar.has(spec.name) ? { name: spec.name, value: jar.get(spec.name) } : null;
    if (spec?.prefix) {
      for (const [name, value] of jar) if (name.startsWith(spec.prefix)) return { name, value };
    }
    return null;
  }

  function queryFirst(selectors) {
    for (const sel of selectors || []) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch {
        // bad selector: skip
      }
    }
    return null;
  }

  // position:fixed banners have no offsetParent, so check rendered boxes + visibility instead
  function isShown(el) {
    if (!el) return false;
    try {
      if (typeof el.checkVisibility === "function") return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    } catch { return false; }
  }

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

  // --- CONSENT DETECTOR ---
  // Cookie parsers: return { categories: { label: true|false|null }, interacted? } or null. Never guess.
  const CONSENT_PARSERS = {
    // OptanonConsent: ...&groups=C0001:1,C0002:0&interactionCount=1...
    onetrust: (raw) => {
      const v = safeDecode(raw);
      const groups = v.match(/(?:^|&)groups=([^&]*)/)?.[1];
      if (!groups) return null;
      const labels = CFG.CONSENT_CATEGORY_LABELS?.onetrust || {};
      const categories = {};
      for (const pair of safeDecode(groups).split(",")) {
        const [id, flag] = pair.split(":");
        if (!id || (flag !== "0" && flag !== "1")) continue;
        categories[labels[id] || id] = flag === "1";
      }
      const count = Number(v.match(/(?:^|&)interactionCount=(\d+)/)?.[1] || 0);
      return Object.keys(categories).length ? { categories, interacted: count > 0 } : null;
    },

    // CookieConsent: {stamp:'..',necessary:true,preferences:false,statistics:false,marketing:false,method:'explicit',...}
    cookiebot: (raw) => {
      const v = safeDecode(raw);
      if (v === "-1") return { categories: {}, interacted: false, note: "Consent not required in this region" };
      const categories = {};
      for (const m of v.matchAll(/(necessary|preferences|statistics|marketing):(true|false)/g)) {
        categories[m[1][0].toUpperCase() + m[1].slice(1)] = m[2] === "true";
      }
      if (!Object.keys(categories).length) return null;
      return { categories, interacted: /method:'?(explicit|implied)/.test(v) };
    },

    // _tracking_consent: JSON, newer format has con.CMP = { a, m, p, s } with "1" | "0" | ""
    shopify: (raw) => {
      let data = null;
      try { data = JSON.parse(safeDecode(raw)); } catch { return null; }
      const cmp = data?.con?.CMP;
      if (!cmp || typeof cmp !== "object") return null;
      const labels = CFG.CONSENT_CATEGORY_LABELS?.shopify || {};
      const categories = {};
      let interacted = false;
      for (const [key, flag] of Object.entries(cmp)) {
        if (!(key in labels)) continue;
        categories[labels[key]] = flag === "1" ? true : flag === "0" ? false : null;
        if (flag === "1" || flag === "0") interacted = true;
      }
      return Object.keys(categories).length ? { categories, interacted } : null;
    }
  };

  // GCM: last gcs= value seen on a Google tag/collect request
  function readGCM(scriptUrls) {
    const gcm = CFG.CONSENT_FRAMEWORKS?.gcm;
    if (!gcm) return { present: false };
    let last = "";
    for (const u of scriptUrls) {
      if (!u.includes(gcm.param + "=")) continue;
      const url = safeURL(u);
      const val = url?.searchParams.get(gcm.param) || "";
      if (url && gcm.pathRx.test(url.pathname) && gcm.valueRx.test(val)) last = val;
    }
    if (!last) return { present: false };
    const [, ad, analytics] = last.match(gcm.valueRx);
    const STATE = { "1": "granted", "0": "denied", "-": "unset" };
    return { present: true, raw: last, ad_storage: STATE[ad], analytics_storage: STATE[analytics] };
  }

  function detectConsent(scriptUrls) {
    const jar = readCookies();
    const providers = [];
    let banner = false;

    for (const p of CFG.CONSENT_PROVIDERS || []) {
      const sources = [];
      let state = null;
      let interacted = false;

      if ((p.scripts || []).length && scriptUrls.some(u => p.scripts.some(rx => rx.test(u)))) sources.push("script");

      const domEl = queryFirst(p.dom);
      if (domEl) sources.push("dom");

      for (const spec of p.cookies || []) {
        const c = findCookie(jar, spec);
        if (!c) continue;
        if (spec.match && !spec.match.test(safeDecode(c.value))) continue; // generic name, wrong format
        if (!sources.includes("cookie")) sources.push("cookie");
        if (spec.interacted) interacted = true;
        if (spec.parse && !state) {
          try { state = CONSENT_PARSERS[spec.parse]?.(c.value) || null; } catch { state = null; }
        }
      }

      if (!sources.length) continue;

      const bannerShown = isShown(queryFirst(p.banner));
      if (bannerShown) banner = true;

      providers.push({
        id: p.id,
        name: p.name,
        priority: p.priority ?? 999,
        sources,
        bannerShown,
        state: state
          ? { categories: state.categories || {}, interacted: !!(state.interacted || interacted), note: state.note || "" }
          : (interacted ? { categories: {}, interacted: true, note: "" } : null)
      });
    }

    providers.sort((a, b) => a.priority - b.priority);

    // Shopify Native is only worth showing when no third-party CMP is present
    const hasThirdParty = providers.some(p => p.id !== "shopify_native");
    if (hasThirdParty) {
      const idx = providers.findIndex(p => p.id === "shopify_native");
      if (idx !== -1) providers.splice(idx, 1);
    }

    const fw = CFG.CONSENT_FRAMEWORKS || {};
    const tcfCookie = (fw.tcf?.cookies || []).some(n => jar.has(n));
    const frameworks = {
      tcf: { present: tcfCookie || !!queryFirst(fw.tcf?.dom), tcString: tcfCookie },
      gpp: { present: !!queryFirst(fw.gpp?.dom) },
      gcm: readGCM(scriptUrls)
    };

    return { providers, frameworks, banner };
  }

  // --- ADVERTISER APP DETECTOR ---
  const manifestCache = new Map(); // manifest href -> Promise<{ hits, preferRelated }>

  function fetchManifestApps(href) {
    if (manifestCache.has(href)) return manifestCache.get(href);
    const spec = CFG.APP_SIGNALS?.manifest || {};
    const job = (async () => {
      const out = { hits: [], preferRelated: false };
      try {
        const res = await fetch(href, { credentials: "same-origin", cache: "force-cache" });
        if (!res.ok) return out;
        const data = await res.json();
        out.preferRelated = data?.prefer_related_applications === true;
        for (const app of Array.isArray(data?.related_applications) ? data.related_applications : []) {
          const platform = spec.platforms?.[app?.platform];
          if (!platform) continue;
          let id = String(app?.id || "").trim();
          if (!id && app?.url) id = String(app.url).match(spec.urlRx?.[platform])?.[1] || "";
          if (platform === "ios") id = id.replace(/^id/i, "");
          out.hits.push({ platform, id, source: spec.label || "Web manifest" });
        }
      } catch {
        // cross-origin / invalid JSON: no manifest signal
      }
      return out;
    })();
    manifestCache.set(href, job);
    return job;
  }

  async function detectApps() {
    const cfg = CFG.APP_SIGNALS || {};
    const valid = cfg.validators || {};
    const hits = [];

    for (const sig of cfg.dom || []) {
      try {
        for (const el of document.querySelectorAll(sig.selector)) {
          const id = String(el.getAttribute(sig.attr) || "").match(sig.rx)?.[1] || "";
          hits.push({ platform: sig.platform, id, source: sig.label });
        }
      } catch {
        // bad selector: skip
      }
    }

    let preferRelated = false;
    const manifestEl = cfg.manifest ? queryFirst([cfg.manifest.selector]) : null;
    const manifestHref = manifestEl ? safeURL(manifestEl.getAttribute("href"))?.href : "";
    if (manifestHref) {
      const m = await fetchManifestApps(manifestHref);
      hits.push(...m.hits);
      preferRelated = m.preferRelated;
    }

    // Keep only IDs that pass the strict store-ID validators
    const result = { ios: null, android: null, preferRelated };
    for (const h of hits) {
      if (!valid[h.platform]?.test(h.id)) continue;
      const slot = result[h.platform] || (result[h.platform] = { id: h.id, url: (cfg.storeURL?.[h.platform] || "") + h.id, sources: [], otherIds: [] });
      if (h.id !== slot.id && !slot.otherIds.includes(h.id)) slot.otherIds.push(h.id);
      if (!slot.sources.includes(h.source)) slot.sources.push(h.source);
    }
    return result;
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

    // Consent: Glance reads meta.summary, Dock reads meta.details
    const consent = detectConsent(env.scriptUrls);
    const fw = consent.frameworks;
    if (consent.providers.length || fw.tcf.present || fw.gpp.present || fw.gcm.present) {
      const names = consent.providers.map(p => p.name);
      items.push({
        id: "cmp",
        label: "Cookie Consent",
        meta: {
          summary: { providers: names, tcf: fw.tcf.present, gpp: fw.gpp.present, gcm: fw.gcm.present, banner: consent.banner },
          providers: names,        // legacy readers
          tooltip: names.join(", "),
          details: { providers: consent.providers, frameworks: fw, banner: consent.banner }
        }
      });
    }

    // Advertiser apps: emitted only when a store ID validated
    const apps = await detectApps();
    if (apps.ios || apps.android) {
      const label = apps.ios && apps.android ? "iOS + Android" : apps.ios ? "iOS app" : "Android app";
      items.push({
        id: "app",
        label,
        meta: {
          summary: { ios: !!apps.ios, android: !!apps.android },
          details: { ios: apps.ios, android: apps.android, preferRelated: apps.preferRelated }
        }
      });
    }

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