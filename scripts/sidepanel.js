// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// scripts/sidepanel.js — "Dock" view: deep-dive readout that follows the active tab live

// --- CONSTANTS (mirror popup.js / Glance) ---
const BLOCKLIST = ["chrome://", "edge://", "awin.com", "google.com", "microsoftedge", "force.com"];

// Map background item IDs to TECH_CONFIG keys (techConfig.js)
const ID_TO_CONFIG = {
  "dwin1":        "awc",
  "gtm":          "gtm",
  "gtss":         "gtSS",
  "shopify":      "shopify",
  "adobe_launch": "launch",
  "woocommerce":  "wooComm",
  "tealium":      "tealium",
  "cmp":          "consent",
  "magento":      "magento"
};

const EASE_RANK  = { chipEasy: 0, chipModerate: 1, chipDifficult: 2 };
const EASE_LABEL = { chipEasy: "Easy", chipModerate: "Moderate", chipDifficult: "Difficult" };
const EMPTY_GRACE_MS = 2500;

let dockWindowId = null;
let dockTabId    = null;
let refreshSeq   = 0; // bumps on every refresh so stale async results get dropped

// --- HELPERS ---
function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function dkCopyText(value) {
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

function setSiteURL(text, isPlaceholder) {
  const siteEl = document.getElementById("dockSiteURL");
  if (!siteEl) return;
  siteEl.textContent = text;
  siteEl.style.fontStyle = isPlaceholder ? "italic" : "normal";
}

// --- DOCK RENDERING ---
function renderCompat(items) {
  const compatChip = document.getElementById("dockCompatChip");
  const compatText = document.getElementById("dockCompatText");
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

function renderTechReadout(items) {
  const container = document.getElementById("techContainer");
  if (!container) return;

  const rows = items.map(it => {
    if (it.id === "cmp") return ""; // shown in the Consent card instead
    const configKey = ID_TO_CONFIG[it.id];
    const tech = TECH_CONFIG[configKey];
    if (!configKey || !tech) return "";

    let chipText = tech.chipText;
    let details = [];

    // 1. Awin MasterTag: first MID on the chip, every MID listed below
    if (it.id === "dwin1") {
      const all = it.meta?.all || [];
      chipText = it.label || chipText;
      if (all.length > 1) details = all.map((mid, n) => `MasterTag ${n + 1}: ${mid}`);
    }
    // 2. GTM: container ID
    else if (it.id === "gtm" && it.label && it.label !== "GTM Found") {
      details = [`Container: ${it.label}`];
    }
    // 3. Tealium: product label
    else if (it.id === "tealium" && it.label) {
      details = [it.label];
    }

    // 4. Shopify: copyable myshopify.com URL
    const shopifyDomain = it.id === "shopify" ? (it.meta?.shopifyDomain || "") : "";
    const subRow = shopifyDomain
      ? `
      <div class="dockSubRow" id="myShopifyInfo">
        <p id="myShopifyText" title="Click to copy">${escapeHTML(shopifyDomain)}</p>
      </div>`
      : "";

    const detailRow = details.length
      ? `
      <div class="dockRow__details">
        ${details.map(d => `<p class="dockRow__detail">${escapeHTML(d)}</p>`).join("")}
      </div>`
      : "";

    const hasSub = subRow || detailRow;
    return `
      <div class="dockRow${hasSub ? " has-sub" : ""}" id="${configKey}Display">
        <div class="dockRow__icon">${tech.svg}</div>
        <p class="dockRow__name" id="${configKey}Text">${escapeHTML(tech.name)}</p>
        <span class="chip ${tech.chipClass}" id="${configKey}Chip">${escapeHTML(chipText)}</span>
      </div>${detailRow}${subRow}
    `;
  }).join("");

  container.innerHTML = rows || `<p class="dockEmpty">No tags detected.</p>`;
  dkInitShopifyCopy(); // no-op when no Shopify URL was rendered
}

function renderConsent(items) {
  const consentEl = document.getElementById("dockConsent");
  if (!consentEl) return;

  const providers = items.find(it => it.id === "cmp")?.meta?.providers || [];
  if (!providers.length) {
    consentEl.innerHTML = `<p class="dockEmpty">None detected</p>`;
    return;
  }

  consentEl.innerHTML = providers.map((name, n) => `
    <div class="dockKV">
      <span class="dockKV__key">${n === 0 ? "Providers" : ""}</span>
      <span class="dockKV__val">${escapeHTML(name)}</span>
    </div>
  `).join("");
}

function renderApp(items) {
  const appEl = document.getElementById("dockApp");
  if (!appEl) return;

  // App detection lands in Step 5; read it if present
  const app = items.find(it => it.id === "app");
  if (!app) {
    appEl.innerHTML = `
      <p class="dockEmpty">Not checked</p>
      <p class="dockNote">Advertiser app detection is coming soon.</p>`;
    return;
  }

  const signals = Array.isArray(app.meta?.signals) ? app.meta.signals : [];
  appEl.innerHTML = `
    <div class="dockKV">
      <span class="dockKV__key">Status</span>
      <span class="dockKV__val">${escapeHTML(app.label || "Detected")}</span>
    </div>
    ${signals.map(s => `
    <div class="dockKV">
      <span class="dockKV__key">Signal</span>
      <span class="dockKV__val">${escapeHTML(typeof s === "string" ? s : JSON.stringify(s))}</span>
    </div>`).join("")}`;
}

function renderDock(items) {
  const list = Array.isArray(items) ? items : [];
  renderCompat(list);
  renderTechReadout(list);
  renderConsent(list);
  renderApp(list);
}

function renderScanning() {
  const compatText = document.getElementById("dockCompatText");
  const compatChip = document.getElementById("dockCompatChip");
  const container = document.getElementById("techContainer");
  const consentEl = document.getElementById("dockConsent");

  if (compatText) { compatText.textContent = "Scanning…"; compatText.style.fontStyle = ""; }
  if (compatChip) compatChip.classList.add("is-hidden");
  if (container) container.innerHTML = `<p class="dockEmpty">Scanning…</p>`;
  if (consentEl) consentEl.innerHTML = `<p class="dockEmpty">Scanning…</p>`;
}

function renderRestricted() {
  const compatText = document.getElementById("dockCompatText");
  const compatChip = document.getElementById("dockCompatChip");
  const container = document.getElementById("techContainer");
  const consentEl = document.getElementById("dockConsent");
  const appEl = document.getElementById("dockApp");

  setSiteURL("Restricted URL", true);
  if (compatText) { compatText.textContent = "Restricted URL"; compatText.style.fontStyle = "italic"; }
  if (compatChip) compatChip.classList.add("is-hidden");
  if (container) container.innerHTML = "";
  if (consentEl) consentEl.innerHTML = `<p class="dockEmpty">—</p>`;
  if (appEl) appEl.innerHTML = `<p class="dockEmpty">—</p>`;
}

// --- Shopify "click-to-copy" helper ---
function dkInitShopifyCopy() {
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

    await dkCopyText(value);

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

// --- LIVE REFRESH ---
async function refreshDock() {
  const seq = ++refreshSeq;

  let tab = null;
  try {
    const query = dockWindowId !== null
      ? { active: true, windowId: dockWindowId }
      : { active: true, currentWindow: true };
    [tab] = await chrome.tabs.query(query);
  } catch {
    // tab query failed; leave the last render in place
  }
  if (seq !== refreshSeq) return;
  if (!tab) return;

  dockTabId = tab.id;
  const url = tab.url || "";

  if (!url || BLOCKLIST.some(d => url.includes(d))) {
    renderRestricted();
    return;
  }

  try {
    setSiteURL(new URL(url).hostname, false);
  } catch {
    setSiteURL(url, false);
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
  if (seq !== refreshSeq) return;
  if (cached.length) renderDock(cached);
  else renderScanning();

  // 2. Non-blocking background refresh (triggers a re-detect if cache is empty)
  const { items } = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_TECH_DETECTIONS", tabId: tab.id },
      (r) => {
        if (chrome.runtime.lastError) return resolve({ items: [] });
        resolve(r || { items: [] });
      }
    );
  });
  if (seq !== refreshSeq) return;

  if (items?.length) renderDock(items);
  else if (!cached.length) setTimeout(() => {
    // Nothing reported after a grace period: show the empty state
    if (seq !== refreshSeq) return;
    const container = document.getElementById("techContainer");
    if (container?.querySelector(".dockEmpty")?.textContent === "Scanning…") renderDock([]);
  }, EMPTY_GRACE_MS);
}

// ==========================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================

// Tab switches inside this Dock's window
chrome.tabs.onActivated.addListener(({ windowId }) => {
  if (dockWindowId === null || windowId === dockWindowId) refreshDock();
});

// Navigation / reload of the tab the Dock is showing
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== dockTabId) return;
  if (changeInfo.url || changeInfo.status === "complete") refreshDock();
});

// Live detection results written by background.js
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "session" || dockTabId === null) return;
  const change = changes["awh_det_" + dockTabId];
  if (!change) return;

  const items = change.newValue?.items;
  if (items) renderDock(items);
  else renderScanning(); // cleared on page load; content script will report again
});

async function initDock() {
  try {
    const win = await chrome.windows.getCurrent();
    dockWindowId = win?.id ?? null;
  } catch {
    // falls back to currentWindow queries
  }

  chrome.runtime.sendMessage({ getVersion: true }, (response) => {
    if (chrome.runtime.lastError) return;
    const versionEl = document.querySelector(".headVer");
    if (versionEl && response?.version) versionEl.textContent = response.version;
  });

  refreshDock();
}

initDock();
