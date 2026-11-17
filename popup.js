// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// popup.js — "Glance" view: fast summary rendered from cached detection state

window.__awin_helper_meta = {
  by: 'Andrew Niziolek',
  license: 'AGPL-3.0-or-later',
  fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
};

// --- CONSTANTS ---
const BLOCKLIST = ["chrome://", "edge://", "awin.com", "google.com", "microsoftedge", "force.com"];

// Map background item IDs to TECH_CONFIG keys (techConfig.js)
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

const EASE_RANK  = { chipEasy: 0, chipModerate: 1, chipDifficult: 2 };
const EASE_LABEL = { chipEasy: "Easy", chipModerate: "Moderate", chipDifficult: "Difficult" };

let glanceWindowId = null;

// --- HELPERS ---
function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function glCopyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
  }
}

// --- GLANCE RENDERING ---
function renderCompat(items) {
  const compatChip = document.getElementById("compatChip");
  const compatText = document.getElementById("compatData");
  if (!compatText) return;

  // Easiest detected platform wins (MasterTag and CMP aren't platforms)
  let best = null;
  items.forEach(it => {
    if (it.id === "dwin1" || it.id === "cmp") return;
    const tech = TECH_CONFIG[ID_TO_CONFIG[it.id]];
    if (!tech || !(tech.chipClass in EASE_RANK)) return;
    if (!best || EASE_RANK[tech.chipClass] < EASE_RANK[best.chipClass]) best = tech;
  });

  compatText.style.fontStyle = "";
  if (!best) {
    compatText.textContent = "Please submit integration for manual review.";
    if (compatChip) compatChip.classList.add("is-hidden");
    return;
  }

  compatText.textContent = best.chipClass === "chipDifficult"
    ? `${best.name} detected.`
    : `Site is compatible! ${best.name} detected.`;
  if (compatChip) {
    compatChip.className = `chip ${best.chipClass}`;
    compatChip.textContent = EASE_LABEL[best.chipClass];
  }
}

function renderTechSummary(items) {
  const container = document.getElementById("techContainer");
  if (!container) return;

  const rows = items.map(it => {
    if (it.id === "cmp") return ""; // shown in the Consent & Apps card instead
    const configKey = ID_TO_CONFIG[it.id];
    const tech = TECH_CONFIG[configKey];
    if (!configKey || !tech) return "";

    let chipText = tech.chipText;
    let tooltip = "";

    // 1. Awin MasterTag: show MID, +N for additional tags
    if (it.id === "dwin1") {
      const all = it.meta?.all || [];
      chipText = all.length > 1 ? `${it.label} +${all.length - 1}` : it.label;
      if (all.length > 1) tooltip = all.slice(1).join(", ");
    }
    // 2. GTM: container ID
    else if (it.id === "gtm" && it.label && it.label !== "GTM Found") {
      tooltip = it.label;
    }

    const tipAttr  = tooltip ? `data-tooltip="${escapeHTML(tooltip)}"` : "";
    const tipClass = tooltip ? "tooltip" : "";

    // 3. Shopify: copyable myshopify.com URL directly under the Shopify row
    const shopifyDomain = it.id === "shopify" ? (it.meta?.shopifyDomain || "") : "";
    const subRow = shopifyDomain
      ? `
      <div class="glanceSubRow" id="myShopifyInfo">
        <p id="myShopifyText" title="Click to copy">${escapeHTML(shopifyDomain)}</p>
      </div>`
      : "";

    return `
      <div class="glanceRow${subRow ? " has-sub" : ""}" id="${configKey}Display">
        <div class="glanceRow__icon">${tech.svg}</div>
        <p class="glanceRow__name" id="${configKey}Text">${escapeHTML(tech.name)}</p>
        <span class="chip ${tech.chipClass} ${tipClass}" id="${configKey}Chip" ${tipAttr}>${escapeHTML(chipText)}</span>
      </div>${subRow}
    `;
  }).join("");

  container.innerHTML = rows || `<p class="glanceEmpty">No tags detected.</p>`;
  glInitShopifyCopy(); // no-op when no Shopify URL was rendered
}

function renderConsentApp(items) {
  const consentEl = document.getElementById("glanceConsentText");
  const appEl = document.getElementById("glanceAppText");

  if (consentEl) {
    const providers = items.find(it => it.id === "cmp")?.meta?.providers || [];
    consentEl.textContent = providers.length ? providers.join(", ") : "None detected";
  }

  // App detection lands in Step 5; read it if present
  if (appEl) {
    const app = items.find(it => it.id === "app");
    appEl.textContent = app ? (app.label || "Detected") : "Not checked";
  }
}

function renderGlance(items) {
  const list = Array.isArray(items) ? items : [];
  renderCompat(list);
  renderTechSummary(list);
  renderConsentApp(list);
}

function renderScanning() {
  const compatText = document.getElementById("compatData");
  const container = document.getElementById("techContainer");
  if (compatText) compatText.textContent = "Scanning…";
  if (container) container.innerHTML = `<p class="glanceEmpty">Scanning…</p>`;
}

function renderRestricted() {
  const compatText = document.getElementById("compatData");
  const compatChip = document.getElementById("compatChip");
  const siteURLText = document.getElementById("siteURLText");
  const container = document.getElementById("techContainer");
  const consentEl = document.getElementById("glanceConsentText");

  if (compatText) { compatText.textContent = "Restricted URL"; compatText.style.fontStyle = "italic"; }
  if (compatChip) compatChip.classList.add("is-hidden");
  if (siteURLText) siteURLText.textContent = "Restricted URL";
  if (container) container.innerHTML = "";
  if (consentEl) consentEl.textContent = "—";
}

// --- Shopify "click-to-copy" helper ---
function glInitShopifyCopy() {
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
    // Text node only, not the icon markup
    const value = textEl.childNodes[0]?.nodeValue?.trim() || "";
    if (!value) return;

    await glCopyText(value);

    const icon = document.getElementById("copyMyShopifyIcon");
    if (icon) icon.innerHTML = CHECK_SVG;

    infoEl.classList.add("copyFlash");
    clearTimeout(infoEl.__flashTimer);
    infoEl.__flashTimer = setTimeout(() => {
      if (icon) icon.innerHTML = COPY_SVG;
      infoEl.classList.remove("copyFlash");
    }, 900);
  });
}

// --- GLANCE INIT ---
async function initGlance() {
  try {
    const win = await chrome.windows.getCurrent();
    glanceWindowId = win?.id ?? null;
  } catch {
    // resolved again on Open Dock click
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const url = tab.url || "";

  if (BLOCKLIST.some(d => url.includes(d))) {
    renderRestricted();
    return;
  }

  // hostname display
  const siteURLText = document.getElementById("siteURLText");
  try {
    if (siteURLText) siteURLText.textContent = new URL(url).hostname;
  } catch {
    if (siteURLText) siteURLText.textContent = url;
  }

  // 1. Instant render from cached session state
  const DET_KEY = "awh_det_" + tab.id;
  let cached = [];
  try {
    const obj = await chrome.storage.session.get(DET_KEY);
    cached = obj?.[DET_KEY]?.items || [];
  } catch {
    // session storage unavailable; fall through to background
  }
  if (cached.length) renderGlance(cached);
  else renderScanning();

  // 2. Live updates whenever the content script reports for this tab
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "session" || !changes[DET_KEY]) return;
    const items = changes[DET_KEY].newValue?.items;
    if (items) renderGlance(items);
  });

  // 3. Non-blocking background refresh (triggers a re-detect if cache is empty)
  const { items } = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_TECH_DETECTIONS", tabId: tab.id },
      (r) => {
        if (chrome.runtime.lastError) return resolve({ items: [] });
        resolve(r || { items: [] });
      }
    );
  });
  if (items?.length) renderGlance(items);
  else if (!cached.length) setTimeout(() => {
    // Nothing reported after a grace period: show the empty state
    const container = document.getElementById("techContainer");
    if (container?.querySelector(".glanceEmpty")?.textContent === "Scanning…") renderGlance([]);
  }, 2500);
}

// --- Open Dock ---
async function openDock() {
  try {
    // windowId is cached at init so open() normally runs with no prior await (keeps the user gesture)
    if (glanceWindowId === null) {
      const win = await chrome.windows.getCurrent();
      glanceWindowId = win?.id ?? null;
    }
    await chrome.sidePanel.open({ windowId: glanceWindowId });
    window.close();
  } catch {
    // side panel unavailable; keep popup open
  }
}

// --- Attribution Link Buttons ---
const openGitURL = () => {
  chrome.tabs.create({ url: "https://github.com/ajaxburger/Aw-Helper-Extension/wiki/Extension-Attributions" });
};

const openPersonalAttribURL = () => {
  chrome.tabs.create({
    url: "https://www.andrewniziolek.com/?utm_source=awhelper&utm_medium=extension&utm_campaign=personal_attribution"
  });
};

// ==========================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================

// Update version in the popup
chrome.runtime.sendMessage({ getVersion: true }, (response) => {
  if (chrome.runtime.lastError) return;
  const versionElement = document.querySelector(".headVer");
  if (versionElement && response?.version) versionElement.textContent = response.version;
});

document.getElementById("attribText")?.addEventListener("click", openGitURL);
document.getElementById("personalAttrib")?.addEventListener("click", openPersonalAttribURL);
document.getElementById("openDockBtn")?.addEventListener("click", openDock);

initGlance();

/**
 * Awin Helper
 * Copyright (c) 2023-2026 Andrew Niziolek
 * Licensed under AGPL-3.0-or-later
 * https://www.gnu.org/licenses/agpl-3.0.html
 * https://github.com/andrewNiziolek/Aw-Helper-Extension
 * Fingerprint: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 */
