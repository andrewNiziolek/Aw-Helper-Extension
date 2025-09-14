(() => {
  const SCRIPTS = () => Array.from(document.scripts);

  const safeURL = (src) => {
    try { return src ? new URL(src, location.href) : null; } catch { return null; }
  };

  function detectGTM() {
    for (const s of SCRIPTS()) {
      const u = safeURL(s.src);
      if (!u) continue;
      if (u.pathname.includes("gtm.js")) {
        const id = u.searchParams.get("id");
        return id || "GTM Found";
      }
    }
    return "";
  }

  function detectGTSS() {
    for (const s of SCRIPTS()) {
      const u = safeURL(s.src);
      if (!u) continue;
      if (u.hostname.includes("googletagmanager.com") && u.searchParams.has("id")) {
        return true;
      }
    }
    return false;
  }

  function detectPresence(substr) {
    for (const s of SCRIPTS()) {
      if (s.src && s.src.includes(substr)) return true;
    }
    return false;
  }

  function detectDWIN() {
    const out = [];
    const re = /([^/]+)\.js(?:\?.*)?$/;
    for (const s of SCRIPTS()) {
      if (!s.src) continue;
      if (s.src.includes("dwin1.com")) {
        const m = s.src.match(re);
        if (m && m[1]) out.push(m[1]);
      }
    }
    return out;
  }

  function detectTealium() {
    for (const s of SCRIPTS()) {
      const u = safeURL(s.src);
      if (!u) continue;
      if (
        u.hostname.includes("tiqcdn.com") ||
        u.hostname.includes("tealiumiq.com")
      ) {
        return "Tealium IQ";
      }
    }

    if (typeof window.utag === "object") {
      return "Tealium IQ";
    }

    return "";
  }

  function waitForShopify(timeout = 50) {
    return new Promise((resolve) => {
      const start = Date.now();
      const rgx = /Shopify\.shop\s*=\s*["']([^"']+)["']/;
      const tick = () => {
        for (const s of SCRIPTS()) {
          const txt = s.textContent || "";
          const m = txt.match(rgx);
          if (m) return resolve(m[1]);
        }
        if (Date.now() - start < timeout) requestAnimationFrame(tick);
        else resolve("");
      };
      tick();
    });
  }

  async function detectAll() {
    const items = [];

    const gtmId = detectGTM();
    const tealium = detectTealium();
    if (gtmId) items.push({ id: "gtm", label: gtmId });

    if (detectGTSS()) items.push({ id: "gtss", label: "GTM Server-Side" });

    const shopifyBySrc = /(?:^|\.)myshopify\.com$/i.test(location.hostname) || detectPresence("myshopify.com");
    const shopDomain = await waitForShopify();
    if (shopifyBySrc || shopDomain) {
      items.push({ id: "shopify", label: "Shopify", meta: { shopifyDomain: shopDomain || "" } });
    }

    if (detectPresence("woocommerce")) items.push({ id: "woocommerce", label: "WooCommerce" });
    if (detectPresence("adobedtm")) items.push({ id: "adobe_launch", label: "Adobe Launch" });
    if (tealium) items.push({ id: "tealium", label: tealium });

    const masterTags = detectDWIN();
    if (masterTags.length) {
      items.push({ id: "dwin1", label: masterTags[0], meta: { all: masterTags } });
    }
    const cmp = detectCMPProviders();
    if (cmp) {
      items.push({
        id: 'cmp',
        label: 'Cookie Consent',
        meta: { providers: cmp.providers, tooltip: cmp.tooltip }
      });
    }

    chrome.runtime.sendMessage({ type: "TECH_DETECTIONS", items });
  }

  const run = () => detectAll().catch(() => {});

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  // Re-run on explicit request from background/popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'REDETECT_NOW') {
      detectAll().catch(() => {});
    }
  });

  // Re-emit when the page becomes visible again (tab switched back)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') detectAll().catch(()=>{});
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) detectAll().catch(()=>{});
  });


  // SPA re-run
  (() => {
    let last = location.href;
    const fire = () => {
      if (location.href !== last) { last = location.href; run(); }
    };
    const { pushState, replaceState } = history;
    history.pushState = function () { pushState.apply(this, arguments); fire(); };
    history.replaceState = function () { replaceState.apply(this, arguments); fire(); };
    addEventListener("popstate", fire);
  })();

  // Debounce for late-loading tags
  new MutationObserver((() => { let t; return () => { clearTimeout(t); t = setTimeout(run, 500); }; })())
    .observe(document.documentElement, { childList: true, subtree: true });
})();

// --- CMP detector---
// Priority: lower number = higher priority (Shopify Native last)
const CMP_REGISTRY = [
  {
    id: 'onetrust',
    name: 'OneTrust',
    priority: 10,
    scripts: [
      /(^|:\/\/)cdn\.cookielaw\.org\/.*\/otSDKStub\.js(?:\?.*)?$/i,
      /(^|:\/\/)optanon\.blob\.core\.windows\.net\//i,
      /(^|:\/\/).*\.onetrust\.com\//i
    ],
    globals: ['OneTrust', 'OptanonActiveGroups', 'Optanon']
  },
  {
    id: 'cookiebot',
    name: 'Cookiebot',
    priority: 20,
    scripts: [
      /(^|\/\/)consent\.cookiebot\.com\/uc\.js/i,
      /(^|\/\/).*\.cookiebot\.com\//i
    ],
    globals: ['Cookiebot']
  },
  {
    id: 'iubenda',
    name: 'Iubenda',
    priority: 30,
    scripts: [
      /(^|\/\/)cdn\.iubenda\.com\//i,
      /(^|\/\/).*\.iubenda\.com\/cookie-policy\//i
    ],
    globals: ['_iub', 'iubenda']
  },
  {
    id: 'osano',
    name: 'Osano',
    priority: 40,
    scripts: [
      /(^|\/\/)cmp\.osano\.com\//i,
      /(^|\/\/).*\.osano\.com\//i
    ],
    globals: ['Osano', '__osano']
  },
  {
    id: 'sourcepoint',
    name: 'SourcePoint',
    priority: 50,
    scripts: [
      /(^|\/\/)cdn\.privacy-mgmt\.com\//i,
      /(^|\/\/)notice\.sp-prod\.net\//i
    ],
    globals: ['_sp_', 'sp']
  },
  {
    id: 'gcm',
    name: 'Google Consent Mode',
    priority: 60,
    scriptsMatchFn: (u) => {
      try {
        const url = new URL(u, location.href);
        if (!url.searchParams) return false;
        const hasGcs = url.searchParams.has('gcs');
        const gtmLike = /(^|\/)gtm\.js$/.test(url.pathname);
        const gaLike  = /(^|\/)(collect|g\/collect)$/.test(url.pathname);
        return hasGcs && (gtmLike || gaLike);
      } catch { return false; }
    },
    globalsMatchFn: () => {
      const g = self.gtag;
      // detect explicit consent API usage if surfaced
      return typeof g === 'function' && (g.toString().includes("consent") || !!(self.google_tag_data?.consent));
    }
  },
  {
    id: 'shopify_native',
    name: 'Shopify Native',
    priority: 100, // lowest
    globalsMatchFn: () => {
      const cp = self.Shopify?.customerPrivacy;
      return typeof cp === 'object' && (
        typeof cp.setTrackingConsent === 'function' ||
        typeof cp.getTrackingConsent === 'function'
      );
    }
  }
];

// Utility: safely normalize script URLs present on the page
function collectScriptURLs() {
  const urls = [];
  // <script src=...>
  for (const s of document.scripts) {
    if (s && s.src) urls.push(s.src);
  }
  // Perf entries can catch dynamic loads
  try {
    for (const e of performance.getEntriesByType('resource')) {
      if (e?.name && typeof e.name === 'string') urls.push(e.name);
    }
  } catch {}
  return urls;
}

// Utility: global presence by simple top-level names
function hasAnyGlobal(names) {
  if (!names || !names.length) return false;
  for (const n of names) {
    if (n in self && typeof self[n] !== 'undefined') return true;
  }
  return false;
}

// Core: detect CMP providers (strong signals only)
function detectCMPProviders() {
  const scripts = collectScriptURLs();
  const found = [];

  CMP_REGISTRY.forEach(provider => {
    let hit = false;

    // Script host/path regexes
    if (provider.scripts && provider.scripts.length) {
      for (const u of scripts) {
        for (const rx of provider.scripts) {
          if (rx.test(u)) { hit = true; break; }
        }
        if (hit) break;
      }
    }

    // Custom script matcher
    if (!hit && provider.scriptsMatchFn) {
      for (const u of scripts) { if (provider.scriptsMatchFn(u)) { hit = true; break; } }
    }

    // Global names / custom global matcher
    if (!hit && provider.globals && hasAnyGlobal(provider.globals)) hit = true;
    if (!hit && provider.globalsMatchFn && provider.globalsMatchFn()) hit = true;

    if (hit) found.push({ id: provider.id, name: provider.name, priority: provider.priority });
  });

  if (!found.length) return null;

  // Sort by priority and dedupe by id
  found.sort((a, b) => a.priority - b.priority);
  const uniq = [];
  const seen = new Set();
  for (const f of found) { if (!seen.has(f.id)) { uniq.push(f); seen.add(f.id); } }

  return {
    providers: uniq.map(x => x.name),
    // Tooltip text for your chip:
    tooltip: uniq.map(x => x.name).join(', ')
  };
}