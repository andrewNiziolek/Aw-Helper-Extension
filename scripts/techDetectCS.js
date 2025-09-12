// scripts/techDetect.cs.js

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
    if (gtmId) items.push({ id: "gtm", label: gtmId });

    if (detectGTSS()) items.push({ id: "gtss", label: "GTM Server-Side" });

    const shopifyBySrc = /(?:^|\.)myshopify\.com$/i.test(location.hostname) || detectPresence("myshopify.com");
    const shopDomain = await waitForShopify();
    if (shopifyBySrc || shopDomain) {
      items.push({ id: "shopify", label: "Shopify", meta: { shopifyDomain: shopDomain || "" } });
    }

    if (detectPresence("woocommerce")) items.push({ id: "woocommerce", label: "WooCommerce" });
    if (detectPresence("adobedtm")) items.push({ id: "adobe_launch", label: "Adobe Launch" });

    const masterTags = detectDWIN();
    if (masterTags.length) {
      items.push({ id: "dwin1", label: masterTags[0], meta: { all: masterTags } });
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
