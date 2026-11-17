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

const EMPTY_GRACE_MS = 2500;

let dockWindowId = null;
let dockTabId    = null;
let dockAwinTab  = null; // Awin UI tab + MID the Provider Area button acts on
let dockAwinMID  = "";
let dockSFMID    = ""; // MID published by the Salesforce tab (bootstrap.js -> background.js)
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

// --- CONSENT & APP DETAIL HELPERS ---
const SOURCE_LABEL = { script: "Script", cookie: "Cookie", dom: "Page element" };
const GCM_STATE    = { granted: ["is-granted", "Granted"], denied: ["is-denied", "Denied"] };

function dkKV(key, valHTML) {
  return `
    <div class="dockKV">
      <span class="dockKV__key">${escapeHTML(key)}</span>
      <span class="dockKV__val">${valHTML}</span>
    </div>`;
}

function dkStateText(flag) {
  if (flag === true)  return `<span class="dockState is-granted">Granted</span>`;
  if (flag === false) return `<span class="dockState is-denied">Denied</span>`;
  return "Unset";
}

function dkGcmText(state) {
  const entry = GCM_STATE[state];
  return entry ? `<span class="dockState ${entry[0]}">${entry[1]}</span>` : "Unset";
}

function renderConsent(items) {
  const consentEl = document.getElementById("dockConsent");
  if (!consentEl) return;

  const meta = items.find(it => it.id === "cmp")?.meta;
  if (!meta) {
    consentEl.innerHTML = `<p class="dockEmpty">None detected</p>`;
    return;
  }

  // Legacy payload (names only): cached from before the Step 5 content script
  const details = meta.details;
  if (!details) {
    consentEl.innerHTML = (meta.providers || []).map((name, n) => dkKV(n === 0 ? "Providers" : "", escapeHTML(name))).join("");
    return;
  }

  const parts = [];

  // 1. Providers: detection sources + parsed category choices
  (details.providers || []).forEach(p => {
    const via = (p.sources || []).map(s => SOURCE_LABEL[s] || s).join(" · ");
    parts.push(dkKV("Provider", `${escapeHTML(p.name)}${via ? `<p class="dockRow__detail">via ${escapeHTML(via)}</p>` : ""}`));

    const categories = Object.entries(p.state?.categories || {});
    if (categories.length) {
      categories.forEach(([label, flag]) => parts.push(dkKV(label, dkStateText(flag))));
      if (!p.state.interacted) parts.push(`<p class="dockNote">Defaults: the visitor hasn't answered the ${escapeHTML(p.name)} banner yet.</p>`);
    } else if (p.state?.note) {
      parts.push(dkKV("Choices", escapeHTML(p.state.note)));
    } else {
      parts.push(dkKV("Choices", p.state?.interacted ? "Answered (categories unreadable)" : "Not set yet"));
    }
  });

  // 2. Frameworks
  const fw = details.frameworks || {};
  if (fw.tcf?.present) parts.push(dkKV("IAB TCF v2", fw.tcf.tcString ? "TC string stored" : "Detected · no TC string yet"));
  if (fw.gpp?.present) parts.push(dkKV("IAB GPP", "Detected"));
  if (fw.gcm?.present) {
    parts.push(dkKV("GCM ads", dkGcmText(fw.gcm.ad_storage)));
    parts.push(dkKV("GCM analytics", dkGcmText(fw.gcm.analytics_storage)));
  }

  // 3. Banner
  parts.push(dkKV("Banner", details.banner ? "Visible" : "Not shown"));

  consentEl.innerHTML = parts.join("");
}

function renderApp(items) {
  const appEl = document.getElementById("dockApp");
  if (!appEl) return;

  const details = items.find(it => it.id === "app")?.meta?.details;
  if (!details || (!details.ios && !details.android)) {
    appEl.innerHTML = `
      <p class="dockEmpty">None detected</p>
      <p class="dockNote">Only signals carrying a valid App Store / Google Play ID are counted.</p>`;
    return;
  }

  const PLATFORMS = [["ios", "iOS"], ["android", "Android"]];
  const rows = PLATFORMS.map(([key, name]) => {
    const app = details[key];
    if (!app?.id) return "";
    const lines = [
      `via ${(app.sources || []).join(" · ")}`,
      ...(app.otherIds?.length ? [`Also seen: ${app.otherIds.join(", ")}`] : [])
    ];
    return dkKV(name, `
      <a href="${escapeHTML(app.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(app.id)}</a>
      ${lines.map(l => `<p class="dockRow__detail">${escapeHTML(l)}</p>`).join("")}`);
  }).join("");

  const note = details.preferRelated ? `<p class="dockNote">Web manifest prefers the native app.</p>` : "";
  appEl.innerHTML = rows + note;
}

function renderDock(items) {
  const list = Array.isArray(items) ? items : [];
  renderTechReadout(list);
  renderConsent(list);
  renderApp(list);
}

function renderScanning() {
  const container = document.getElementById("techContainer");
  const consentEl = document.getElementById("dockConsent");
  const appEl = document.getElementById("dockApp");

  if (container) container.innerHTML = `<p class="dockEmpty">Scanning…</p>`;
  if (consentEl) consentEl.innerHTML = `<p class="dockEmpty">Scanning…</p>`;
  if (appEl) appEl.innerHTML = `<p class="dockEmpty">Scanning…</p>`;
}

function renderRestricted() {
  const container = document.getElementById("techContainer");
  const consentEl = document.getElementById("dockConsent");
  const appEl = document.getElementById("dockApp");

  setSiteURL("Restricted URL", true);
  if (container) container.innerHTML = `<p class="dockEmpty">—</p>`;
  if (consentEl) consentEl.innerHTML = `<p class="dockEmpty">—</p>`;
  if (appEl) appEl.innerHTML = `<p class="dockEmpty">—</p>`;
}

// --- Awin UI: Provider Area jump ---
function renderAwinUI(tab) {
  const cardEl = document.getElementById("dockAwin");
  const midEl = document.getElementById("dockAwinMID");
  const btnEl = document.getElementById("dockProviderAreaBtn");
  if (!cardEl) return;

  dockAwinTab = tab;
  dockAwinMID = awGetAdvertiserMID(tab?.url || "");

  cardEl.classList.remove("is-hidden");
  setSiteURL(awHostOf(tab?.url || ""), false);
  if (midEl) midEl.textContent = dockAwinMID || "No advertiser in view";
  if (btnEl) btnEl.disabled = !dockAwinMID;
}

function hideAwinUI() {
  dockAwinTab = null;
  dockAwinMID = "";
  document.getElementById("dockAwin")?.classList.add("is-hidden");
}

// --- Salesforce MID: auto fill New Implementation / Internal Review ---
function isSalesforceURL(url) { return String(url || "").includes("lightning.force.com"); }

function setSFMID(mid) {
  const rowEl = document.getElementById("dockSFMIDRow");
  const midEl = document.getElementById("dockSFMID");
  dockSFMID = /^\d+$/.test(String(mid || "")) ? String(mid) : "";
  if (midEl) midEl.textContent = dockSFMID || "—";
  rowEl?.classList.toggle("is-hidden", !dockSFMID);
}

async function renderSFMID(tab) {
  if (!tab || !isSalesforceURL(tab.url)) return setSFMID("");
  const SF_KEY = "awh_sf_mid_" + tab.id;
  try {
    const obj = await chrome.storage.session.get(SF_KEY);
    if (tab.id !== dockTabId) return; // tab switched while reading
    setSFMID(obj?.[SF_KEY]?.mid || "");
  } catch {
    setSFMID(""); // session storage unavailable; keep the row hidden
  }
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
    if (awIsAwinUI(url)) renderAwinUI(tab); // detections don't apply, but the Provider Area jump does
    else hideAwinUI();
    renderSFMID(tab); // Salesforce: offer the page MID to the Tools inputs
    return;
  }
  hideAwinUI();
  setSFMID("");

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

// Provider Area jump (bound once; reads the tab/MID from the latest refresh)
document.getElementById("dockProviderAreaBtn")?.addEventListener("click", () => {
  awOpenProviderArea(dockAwinTab, dockAwinMID);
});

// Salesforce MID auto fill (bound once; reads the MID from the latest render)
document.getElementById("dockSFFillBtn")?.addEventListener("click", (e) => {
  if (!dockSFMID) return;
  const btnEl = e.currentTarget;
  ["implMIDBox", "inRevMIDBox"].forEach(id => {
    const inputEl = document.getElementById(id);
    if (inputEl) inputEl.value = dockSFMID;
  });
  btnEl.textContent = "Filled ✓";
  clearTimeout(btnEl.__fillTimer);
  btnEl.__fillTimer = setTimeout(() => { btnEl.textContent = "Auto fill"; }, 1200);
});

// Live detection results written by background.js
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "session" || dockTabId === null) return;

  const sfChange = changes["awh_sf_mid_" + dockTabId];
  if (sfChange) {
    chrome.tabs.get(dockTabId)
      .then(tab => { if (tab.id === dockTabId && isSalesforceURL(tab.url)) setSFMID(sfChange.newValue?.mid || ""); })
      .catch(() => setSFMID("")); // tab closed
  }

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
