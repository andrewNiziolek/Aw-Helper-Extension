// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// New update page popup.
let disableUpdatePopup = "1";
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update" && disableUpdatePopup === "0") {
    chrome.tabs.create({ url: "https://aniziolek.notion.site/Awin-Helper-Updates-1ec7c46530f34c3691e307f498284fd4?pvs=74", active: true }, (tab) => {
      chrome.tabs.group({ tabIds: [tab.id] }, (groupId) => {
        chrome.tabGroups.update(groupId, {
          title: "AWH Update",
          color: "orange"
        });
      });
    });
  }
});

// --- One-time storage key migration (pre-awh_ keys -> awh_ prefix) ---
const LEGACY_KEY_MAP = {
  modeSwitch: "awh_modeSwitch",
  dismissedAnnIds: "awh_dismissedAnnIds",
  MIDSave: "awh_MIDSave",
  CRSave: "awh_CRSave",
  NFSave: "awh_NFSave"
};

async function migrateStorageKeys() {
  try {
    const oldKeys = Object.keys(LEGACY_KEY_MAP);
    const newKeys = Object.values(LEGACY_KEY_MAP);
    const stored = await chrome.storage.local.get([...oldKeys, ...newKeys]);

    const toSet = {};
    const toRemove = [];
    for (const oldKey of oldKeys) {
      if (stored[oldKey] === undefined) continue;
      const newKey = LEGACY_KEY_MAP[oldKey];
      if (stored[newKey] === undefined) toSet[newKey] = stored[oldKey];
      toRemove.push(oldKey);
    }

    if (Object.keys(toSet).length) await chrome.storage.local.set(toSet);
    if (toRemove.length) await chrome.storage.local.remove(toRemove);
  } catch {
    // migration is best-effort; old values are simply left in place
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") migrateStorageKeys();
});

//Theme Controller
function switchTheme(theme) {
  document.body.classList = theme
}

// Call switchTheme("theme-dark") or not as necessary. Build indicator in UI for this controll and have it's storage state control this call on extension load.

// Link Version Display in popup to manifest version number.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.getVersion) {
    const manifestData = chrome.runtime.getManifest();
    sendResponse({ version: manifestData.version });
  }
});

// TSE__c MID links + IR Start now live in scripts/bootstrap.js / scripts/injected.js
// fp: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

// Grouped Tab Creator
function createTabGroup(urls, mid, toolName) {
  const tabIds = [];

    urls.forEach((url) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab || typeof tab.id !== "number") return;
      tabIds.push(tab.id);

      // When all tabs are open, group and label them.
      if (tabIds.length === urls.length) {
        chrome.tabs.group({ tabIds }, (groupId) => {
          if (typeof groupId !== "number") return;
          if (toolName == "irTool") {
            chrome.tabGroups.update(groupId, { title: `${mid} IR`, color: "orange" });
          }
          chrome.tabGroups.update(groupId, { title: mid, color: "orange" });
        });
      }
    });
  });
}

// New Implementation Tool
chrome.runtime.onMessage.addListener((request) => {
  if (request?.action !== "createNITabs") return;

  const MIDValue = String(request.mid);
  const URLs = [
    `https://ui.awin.com/tracking-settings/us/awin/advertiser/${MIDValue}/main-settings`,
    `https://ui.awin.com/awin/merchant/${MIDValue}/settings/invite-user`,
    `https://ui.awin.com/commission-manager/us/awin/merchant/${MIDValue}/commission-groups`,
    `https://ui.awin.com/advertiser-mastertag/us/awin/${MIDValue}/plugins`,
    `https://ui.awin.com/advertiser-mastertag/us/awin/${MIDValue}/trackingtagsettings`,
    `https://ui.awin.com/provider/merchant-settings/${MIDValue}/account-details/network/awin`,
    `https://ui.awin.com/provider/finance/fee-manager/en/${MIDValue}`,
    `https://ui.awin.com/provider/merchant-settings/${MIDValue}/mobile-tracking/network/awin`,
    `https://ui.awin.com/provider/migrated-advertiser-settings/${MIDValue}`,
    `https://ui.awin.com/provider/pre-join-publishers?advertiserId=${MIDValue}`
  ];

  createTabGroup(URLs, MIDValue, "implTool");
});

// Internal Review Tool
chrome.runtime.onMessage.addListener((request) => {
  if (request?.action !== "createIRTabs") return;

  const MIDValue = String(request.mid); // already sanitized in popup
  const URLs = [
    `https://ui.awin.com/tracking-settings/us/awin/advertiser/${MIDValue}/main-settings`,
    `https://ui.awin.com/commission-manager/us/awin/merchant/${MIDValue}/commission-groups`,
    `https://ui.awin.com/advertiser-mastertag/us/awin/${MIDValue}/plugins`,
    `https://ui.awin.com/awin/merchant/${MIDValue}/validate-pending/network/awin`,
    `https://ui.awin.com/advertiser-integration-tool/trackingwizard/us/awin/merchant/${MIDValue}`,
    `https://ui.awin.com/provider/test-transactions`,
    `https://ui.awin.com/provider/merchant-settings/${MIDValue}/account-details/network/awin`,
    `https://ui.awin.com/provider/merchant-settings/${MIDValue}/mobile-tracking/network/awin`,
    `https://ui.awin.com/provider/finance/fee-manager/en/${MIDValue}`,
    `https://ui.awin.com/provider/pre-join-publishers?advertiserId=${MIDValue}`,
    `https://ui.awin.com/provider/migrated-advertiser-settings/${MIDValue}`
  ];

  createTabGroup(URLs, MIDValue, "irTool");
});

// Tech Detection Script Listeners and Badge
const mem = new Map();

async function setDetections(tabId, items) {
  mem.set(tabId, items);
  await chrome.storage.session.set({ ["awh_det_" + tabId]: { items, ts: Date.now() } });
}

async function getDetections(tabId) {
  if (mem.has(tabId)) return mem.get(tabId);
  const obj = await chrome.storage.session.get("awh_det_" + tabId);
  return obj?.["awh_det_" + tabId]?.items || [];
}

function setBadge(tabId, count) {
  chrome.action.setBadgeText({ tabId, text: count ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#FF9550" });
}

// Content script reports
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Salesforce page MID (bootstrap.js) -> session storage for Dock auto fill
  if (msg?.type === "AWH_SF_MID") {
    const tabId = sender?.tab?.id;
    if (Number.isInteger(tabId)) {
      const key = "awh_sf_mid_" + tabId;
      const mid = /^\d+$/.test(String(msg.mid || "")) ? String(msg.mid) : "";
      (mid
        ? chrome.storage.session.set({ [key]: { mid, ts: Date.now() } })
        : chrome.storage.session.remove(key)
      ).catch(() => {}); // session storage unavailable; Dock just won't offer auto fill
    }
    sendResponse({ success: true });
    return;
  }
  if (msg?.type === "TECH_DETECTIONS") {
    const tabId = sender?.tab?.id;
    if (Number.isInteger(tabId)) {
      setDetections(tabId, msg.items || []).then(() => setBadge(tabId, msg.items?.length || 0));
      sendResponse({ success: true });
    }
    return true;
  }
  if (msg?.type === "GET_TECH_DETECTIONS") {
    const tabId = msg.tabId;
    if (!Number.isInteger(tabId)) {
      sendResponse({ items: [] });
      return;
    }
    (async () => {
      const items = await getDetections(tabId);
      if (!items.length) {
        // ask the content script in that tab to re-run immediately
        chrome.tabs.sendMessage(tabId, { type: "REDETECT_NOW" }).catch(() => {}); // no content script on this tab
      }
      sendResponse({ items });
    })();
    return true; // async
  }
});

// Keep badge coherent when focus changes
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const items = await getDetections(tabId);
  setBadge(tabId, items.length);
});
chrome.windows.onFocusChanged.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const items = await getDetections(tab.id);
    setBadge(tab.id, items.length);
  }
});

// Clear state when tabs truly go away or reload
chrome.tabs.onRemoved.addListener((tabId) => {
  mem.delete(tabId);
  chrome.storage.session.remove(["awh_det_" + tabId, "awh_sf_mid_" + tabId]);
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.discarded === true) { // tab got discarded
    // keep storage; badge can reflect last known
    return;
  }
  if (info.status === "loading") {
    mem.delete(tabId);
    chrome.storage.session.remove("awh_det_" + tabId); // don't let Glance render the previous page's cache
    // awh_sf_mid_ is kept: Lightning SPA navigations can report "loading", and bootstrap.js only republishes on change
    setBadge(tabId, 0);
    // content script will re-emit on DOMContentLoaded; if it doesn’t, popup will ping via GET handler
  }
});

