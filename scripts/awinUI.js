// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// scripts/awinUI.js — Awin UI context helpers shared by Glance (popup.js) and Dock (sidepanel.js)

const AWIN_UI_HOSTS     = ["ui.awin.com", "app.awin.com"]; // app.awin.com hosts the newer advertiser dashboard
const PROVIDER_AREA_URL = mid => `https://ui.awin.com/provider/merchant-settings/${mid}/index/network/awin`;

// Ordered: most specific first. Derived from the tool URLs in background.js / injected.js.
// Publisher paths (/affiliate/, /publisher/) are left out on purpose so a publisher ID is never taken as an MID.
const MID_PATTERNS = [
  /\/merchant-settings\/(\d+)(?:\/|$)/,
  /\/migrated-advertiser-settings\/(\d+)(?:\/|$)/,
  /\/advertiser-mastertag\/[a-z]{2}\/awin\/(\d+)(?:\/|$)/,
  /\/fee-manager\/[a-z]{2}\/(\d+)(?:\/|$)/,
  /\/advertiser\/(\d+)(?:\/|$)/, // dashboard (ui + app), tracking-settings
  /\/merchant\/(\d+)(?:\/|$)/    // awin/merchant, commission-manager, trackingwizard
];
const MID_PARAMS = ["advertiserId", "merchantId", "mid"];

function awParseURL(url) {
  try { return new URL(url); } catch { return null; }
}

function awHostOf(url){ return awParseURL(url)?.hostname || ""; }

function awIsAwinUI(url) {
  return AWIN_UI_HOSTS.includes(awHostOf(url));
}

// Active advertiser MID from an Awin UI URL, or "" when none is in view
function awGetAdvertiserMID(url) {
  if (!awIsAwinUI(url)) return "";
  const parsed = awParseURL(url);

  // 1. Query params (?advertiserId=123)
  for (const key of MID_PARAMS) {
    const value = parsed.searchParams.get(key) || "";
    if (/^\d+$/.test(value)) return value;
  }

  // 2. Path segments
  for (const pattern of MID_PATTERNS) {
    const match = parsed.pathname.match(pattern);
    if (match) return match[1];
  }

  return "";
}

// Open the Provider Area page in a new tab right beside the Awin UI tab
async function awOpenProviderArea(tab, mid) {
  if (!tab || !/^\d+$/.test(String(mid || ""))) return;
  try {
    const current = await chrome.tabs.get(tab.id).catch(() => tab); // tab may have moved since render
    await chrome.tabs.create({
      url: PROVIDER_AREA_URL(mid),
      index: current.index + 1,
      openerTabId: current.id,
      active: true
    });
  } catch {
    // tab closed or window gone; nothing to open beside
  }
}
