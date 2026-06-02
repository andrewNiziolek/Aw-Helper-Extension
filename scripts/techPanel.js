// scripts/techPanel.js

// Map your background script item IDs to your TECH_CONFIG keys
const ID_TO_CONFIG = {
  'dwin1': 'awc',
  'gtm': 'gtm',
  'gtss': 'gtSS',
  'shopify': 'shopify',
  'adobe_launch': 'launch',
  'woocommerce': 'wooComm',
  'tealium': 'tealium',
  'cmp': 'consent',
  'magento': 'magento'
};

async function updateSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const url = tab.url || "";

  const blocklist = ["chrome://", "edge://", "awin.com", "google.com", "microsoftedge", "force.com"];
  const compatText = document.getElementById("compatData");
  const siteURLText = document.getElementById("siteURLText");
  const modeCheck = document.getElementById("modeSwitch");
  const container = document.getElementById("techContainer");

  const isBlocked = blocklist.some(d => url.includes(d));
  if (isBlocked) {
    if (compatText) { compatText.textContent = "Restricted URL"; compatText.style.fontStyle = "italic"; }
    if (siteURLText) siteURLText.textContent = "Restricted URL";
    if (container) container.innerHTML = "";
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

  // Compatibility banner if not in "technician" mode
  if (!modeCheck?.checked && items.some(i => /^(gtm|gtss|shopify|woocommerce)$/.test(i.id))) {
    const easeMSG = document.getElementById("ratingBox");
    if (compatText) { 
      compatText.textContent = "Site is compatible!"; 
      compatText.style.fontWeight = "bold"; 
      compatText.style.color = "#18a45b"; 
    }
    if (easeMSG) easeMSG.style.display = "flex";
  }

  // --- DYNAMIC RENDERING ---
  if (!container) return;
  container.innerHTML = ""; // Clear old data on refresh

  const techMode = !!modeCheck?.checked;
  let shopifyDomain = "";

  items.forEach(it => {
    const configKey = ID_TO_CONFIG[it.id];
    if (!configKey || !TECH_CONFIG[configKey]) return;

    const tech = TECH_CONFIG[configKey];
    let chipText = tech.chipText;
    let tooltipAttr = "";
    let tooltipClass = "";

    // 1. Custom Logic: Awin Mastertag Multi-tag tooltip & count
    if (it.id === "dwin1") {
      const all = it.meta?.all || [];
      chipText = all.length > 1 ? `${it.label} +${all.length - 1}` : it.label;
      if (all.length > 1) {
        tooltipAttr = `data-tooltip="${all.slice(1).join(", ")}"`;
        tooltipClass = "tooltip";
      }
    } 
    // 2. Custom Logic: CMP Tooltip
    else if (it.id === "cmp" && it.meta?.tooltip) {
      tooltipAttr = `data-tooltip="${it.meta.tooltip}"`;
      tooltipClass = "tooltip";
    } 
    // 3. Custom Logic: Shopify Domain extraction
    else if (it.id === "shopify") {
      shopifyDomain = it.meta?.shopifyDomain || '';
    }

    // Inject the main Tech row
    container.innerHTML += `
      <div class="techDisplay" id="${configKey}Display" style="display: flex;">
          <div class="techIcon">${tech.svg}</div>
          <div class="techData">
              <p class="techReadout" id="${configKey}Text">${tech.name}</p>
          </div>
          <span class="chip ${tech.chipClass} ${tooltipClass}" id="${configKey}Chip" ${tooltipAttr}>${chipText}</span>
      </div>
    `;

    // Inject Shopify Additional Info (Only if Tech Mode is ON)
    if (it.id === "shopify" && techMode && shopifyDomain) {
      container.innerHTML += `
        <div class="techAdditionalInfo" id="myShopifyInfo" style="display: flex;">
            <p class="techAdditionalText" id="myShopifyText">${shopifyDomain}</p>
        </div>
      `;
    }
  });

  // Re-bind the click-to-copy function if Shopify info was rendered
  if (shopifyDomain && techMode) {
    shInitShopifyCopy();
  }
}

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

  // Prevent stacking event listeners on re-renders
  if (textEl.dataset.shBound) return;
  textEl.dataset.shBound = "true";

  textEl.addEventListener("click", async () => {
    // Trim out the SVG markup to just get the text node value
    const value = textEl.childNodes[0]?.nodeValue?.trim() || "";
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


// ==========================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================

// Re-render when toggling Tech Mode
document.getElementById("modeSwitch")?.addEventListener("change", updateSidePanel);

// Re-render when the user switches to a different tab
chrome.tabs.onActivated.addListener(updateSidePanel);

// Re-render when the current tab finishes loading/navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateSidePanel();
  }
});

// Initial run when the side panel is first opened
updateSidePanel();