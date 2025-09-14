// scripts/techPanel.js
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const url = tab.url || "";

  const blocklist = ["chrome://", "edge://", "awin.com", "google.com", "microsoftedge", "force.com"];

  const compatText = document.getElementById("compatData");
  const siteURLText = document.getElementById("siteURLText");
  const modeCheck = document.getElementById("modeSwitch");

  const isBlocked = blocklist.some(d => url.includes(d));
  if (isBlocked) {
    if (compatText) { compatText.textContent = "Restricted URL"; compatText.style.fontStyle = "italic"; }
    if (siteURLText) siteURLText.textContent = "Restricted URL";
    return;
  }

  // hostname display
  try {
    const host = new URL(url).hostname;
    if (siteURLText) siteURLText.textContent = host;
  } catch {
    if (siteURLText) siteURLText.textContent = url;
  }

  // Ask SW for detections (handles suspended worker); retry once if empty.
  let { items } = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_TECH_DETECTIONS", tabId: tab.id },
      (r) => {
        if (chrome.runtime.lastError) return resolve({ items: [] });
        resolve(r || { items: [] });
      }
    );
  });

  // If nothing cached (e.g., worker just woke), give CS a beat to re-emit, then retry.
  if (!items || items.length === 0) {
    await new Promise((r) => setTimeout(r, 200));
    const resp2 = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "GET_TECH_DETECTIONS", tabId: tab.id },
        (r) => resolve(r || { items: [] })
      );
    });
    items = resp2.items || [];
  }

  // compatibility banner if not in "technician" mode
  if (!modeCheck?.checked && items.some(i => /^(gtm|gtss|shopify|woocommerce)$/.test(i.id))) {
    const easeMSG = document.getElementById("ratingBox");
    if (compatText) { compatText.textContent = "Site is compatible!"; compatText.style.fontWeight = "bold"; compatText.style.color = "#18a45b"; }
    if (easeMSG) easeMSG.style.display = "flex";
  }

  // helpers
  const show = (id, text = null) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.style.display = "grid";
    if (text) {
      const el = document.getElementById(text.id);
      if (el) el.textContent = text.value;
    }
  };

  let _shopifyDetected = false;
  let _shopifyDomain = '';

  const setDisplay = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? 'grid' : 'none';
  };

  function renderShopifyRow() {
    // hide/show the whole row based on detection
    setDisplay('shopifyDisplay', _shopifyDetected);

    if (!_shopifyDetected) {
      setDisplay('myShopifyInfo', false);
      return;
    }

    const techMode = !!modeCheck?.checked;
    setDisplay('myShopifyInfo', techMode);

    if (techMode) {
      const t = document.getElementById('myShopifyText');
      if (t) t.textContent = _shopifyDomain || '';
      shInitShopifyCopy();
    }
  }
  
  // react to toggle immediately
  modeCheck?.addEventListener('change', renderShopifyRow);
  modeCheck?.addEventListener('input', renderShopifyRow);

  // render detections
  for (const it of items) {
    if (it.id === "gtm") {
      show("gtmDisplay", { id: "gtmText", value: it.label });
    }
    if (it.id === "gtss") {
      show("gtSSDisplay", { id: "gtSSText", value: "GTM Server-Side" });
    }
    if (it.id === 'shopify') {
      _shopifyDetected = true;
      _shopifyDomain = it.meta?.shopifyDomain || '';
    }
    if (it.id === "adobe_launch") {
      show("launchDisplay", { id: "launchText", value: "Adobe Launch" });
    }
    if (it.id === "woocommerce") {
      show("wooCommDisplay", { id: "wooCommStatus", value: "WooCommerce" });
    }
    if (it.id === "tealium") {
      show("tealiumDisplay", { id: "tealiumText", value: it.label });
    }
    if (it.id === 'cmp') {
      show('consentDisplay', { id: 'consentText', value: 'Cookie Consent' }); // title stays
      const chip = document.getElementById('consentChip');
      if (chip && it.meta?.tooltip) {
        chip.setAttribute('data-tooltip', it.meta.tooltip);
        chip.classList.add('tooltip');
      }
    }
    if (it.id === "dwin1") {
      const chip = document.getElementById("awcChip");
      const panel = document.getElementById("awcDisplay");
      if (chip && panel) {
        const all = it.meta?.all || [];
        chip.textContent = all.length > 1 ? `${it.label} +${all.length - 1}` : it.label;
        panel.style.display = "grid";
        if (all.length > 1) {
          chip.setAttribute("data-tooltip", all.slice(1).join(", "));
          chip.classList.add("tooltip");
        }
      }
    }
  }
  renderShopifyRow();
})();

// --- Shopify "click-to-copy" helper ---
function shInitShopifyCopy() {
  const textEl = document.getElementById("myShopifyText");
  const infoEl = document.getElementById("myShopifyInfo");
  if (!textEl || !infoEl) return;

  const COPY_SVG = `
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
    </svg>`;
  const CHECK_SVG = `
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
    </svg>`;

  if (!document.getElementById("copyMyShopifyIcon")) {
    const span = document.createElement("span");
    span.id = "copyMyShopifyIcon";
    span.innerHTML = COPY_SVG;
    textEl.appendChild(span);
  }

  if (textEl.__shBound) return;
  textEl.__shBound = true;

  textEl.addEventListener("click", async () => {
    const value = (textEl.textContent || "").trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
    }

    const icon = document.getElementById("copyMyShopifyIcon");
    const prevMarkup = icon?.innerHTML;
    if (icon) icon.innerHTML = CHECK_SVG;

    infoEl.classList.add("copyFlash");
    clearTimeout(infoEl.__flashTimer);
    infoEl.__flashTimer = setTimeout(() => {
      if (icon && prevMarkup) icon.innerHTML = prevMarkup;
      infoEl.classList.remove("copyFlash");
    }, 900);
  });
}

// metadata
window.__awin_helper_meta = {
  by: "Andrew Niziolek",
  license: "AGPL-3.0",
  fingerprint: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
};
