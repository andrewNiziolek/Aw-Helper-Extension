// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// scripts/trackingDetect.js — detection config shared with techDetectCS.js (content-script world)
// Loaded before techDetectCS.js in the same manifest entry, so both share the isolated world.
// Content scripts can't read page globals (window.OneTrust etc.), so every signal here is
// something the isolated world CAN see: script/resource URLs, cookies, and DOM nodes.

(() => {
  if (globalThis.AWH_DETECT_CONFIG) return; // already loaded in this frame

  // --- SHARED VALIDATORS ---
  const IOS_ID_RX      = /^\d{6,12}$/;
  const ANDROID_PKG_RX = /^[a-zA-Z][\w]*(?:\.[a-zA-Z_][\w]*)+$/;

  // --- CONSENT PROVIDERS (CMPs) ---
  // scripts: URL regexes · dom: presence = provider loaded · banner: visible = banner on screen
  // cookies: { name | prefix, parse?, match?, interacted? }
  //   parse      -> parser key in techDetectCS.js (reads category state)
  //   match      -> cookie value must match to count (guards generic cookie names)
  //   interacted -> cookie's presence alone means the user has answered the banner
  const CONSENT_PROVIDERS = [
    {
      id: "onetrust", name: "OneTrust", priority: 10,
      scripts: [/(^|:\/\/)cdn\.cookielaw\.org\//i, /(^|:\/\/)optanon\.blob\.core\.windows\.net\//i, /(^|:\/\/)[^/]*\.onetrust\.com\//i],
      cookies: [{ name: "OptanonConsent", parse: "onetrust" }, { name: "OptanonAlertBoxClosed", interacted: true }],
      dom:     ["#onetrust-consent-sdk"],
      banner:  ["#onetrust-banner-sdk"]
    },
    {
      id: "cookiebot", name: "Cookiebot", priority: 20,
      scripts: [/(^|\/\/)consent\.cookiebot\.(com|eu)\//i, /(^|\/\/)[^/]*\.cookiebot\.(com|eu)\//i],
      cookies: [{ name: "CookieConsent", parse: "cookiebot", match: /stamp:|^-1$/ }],
      dom:     ["#CybotCookiebotDialog"],
      banner:  ["#CybotCookiebotDialog"]
    },
    {
      id: "iubenda", name: "Iubenda", priority: 30,
      scripts: [/(^|\/\/)cdn\.iubenda\.com\//i, /(^|\/\/)[^/]*\.iubenda\.com\/cookie-policy\//i],
      cookies: [{ prefix: "_iub_cs-", interacted: true }],
      dom:     ["#iubenda-cs-banner"],
      banner:  ["#iubenda-cs-banner"]
    },
    {
      id: "osano", name: "Osano", priority: 40,
      scripts: [/(^|\/\/)cmp\.osano\.com\//i, /(^|\/\/)[^/]*\.osano\.com\//i],
      cookies: [{ name: "osano_consentmanager", interacted: true }],
      dom:     [".osano-cm-window"],
      banner:  [".osano-cm-dialog"]
    },
    {
      id: "sourcepoint", name: "SourcePoint", priority: 50,
      scripts: [/(^|\/\/)cdn\.privacy-mgmt\.com\//i, /(^|\/\/)notice\.sp-prod\.net\//i],
      cookies: [{ name: "consentUUID", interacted: true }],
      dom:     ['iframe[id^="sp_message_iframe"]'],
      banner:  ['iframe[id^="sp_message_iframe"]']
    },
    {
      id: "shopify_native", name: "Shopify Native", priority: 100,
      scripts: [],
      cookies: [{ name: "_tracking_consent", parse: "shopify" }],
      dom:     ["#shopify-pc__banner"],
      banner:  ["#shopify-pc__banner"]
    }
  ];

  // Human labels for parsed consent categories
  const CONSENT_CATEGORY_LABELS = {
    onetrust: { C0001: "Strictly Necessary", C0002: "Performance", C0003: "Functional", C0004: "Targeting", C0005: "Social Media" },
    shopify:  { a: "Analytics", m: "Marketing", p: "Preferences", s: "Sale of Data" }
  };

  // --- CONSENT FRAMEWORKS ---
  const CONSENT_FRAMEWORKS = {
    tcf: { name: "IAB TCF v2",          cookies: ["euconsent-v2"], dom: ['iframe[name="__tcfapiLocator"]'] },
    gpp: { name: "IAB GPP",             cookies: [],               dom: ['iframe[name="__gppLocator"]'] },
    // gcs=G1<ad_storage><analytics_storage>  (1 granted · 0 denied · - unset)
    gcm: { name: "Google Consent Mode", param: "gcs", valueRx: /^G1([01-])([01-])$/, pathRx: /(^|\/)(gtm\.js|collect|g\/collect)$/ }
  };

  // --- ADVERTISER APP SIGNALS ---
  // Only signals that carry a store ID which passes the validator count as detections.
  const APP_SIGNALS = {
    dom: [
      { id: "apple-itunes-app",   platform: "ios",     label: "Smart App Banner meta",  selector: 'meta[name="apple-itunes-app"]',           attr: "content", rx: /app-id=(\d{6,12})\b/i },
      { id: "google-play-app",    platform: "android", label: "Google Play meta",       selector: 'meta[name="google-play-app"]',            attr: "content", rx: /app-id=([a-zA-Z][\w]*(?:\.[a-zA-Z_][\w]*)+)/ },
      { id: "al-ios",             platform: "ios",     label: "App Links (al:ios)",     selector: 'meta[property="al:ios:app_store_id"]',    attr: "content", rx: /^\s*(\d{6,12})\s*$/ },
      { id: "al-android",         platform: "android", label: "App Links (al:android)", selector: 'meta[property="al:android:package"]',     attr: "content", rx: /^\s*([a-zA-Z][\w]*(?:\.[a-zA-Z_][\w]*)+)\s*$/ },
      { id: "alternate-ios",      platform: "ios",     label: "ios-app:// alternate",   selector: 'link[rel="alternate"][href^="ios-app://"]',     attr: "href", rx: /^ios-app:\/\/(\d{6,12})(?:\/|$)/i },
      { id: "alternate-android",  platform: "android", label: "android-app:// alternate", selector: 'link[rel="alternate"][href^="android-app://"]', attr: "href", rx: /^android-app:\/\/([a-zA-Z][\w]*(?:\.[a-zA-Z_][\w]*)+)(?:\/|$)/ }
    ],
    // Web app manifest related_applications
    manifest: {
      selector:  'link[rel="manifest"]',
      label:     "Web manifest",
      platforms: { itunes: "ios", play: "android" },
      urlRx:     { ios: /\/id(\d{6,12})(?:[/?#]|$)/, android: /[?&]id=([a-zA-Z][\w]*(?:\.[a-zA-Z_][\w]*)+)/ }
    },
    validators: { ios: IOS_ID_RX, android: ANDROID_PKG_RX },
    storeURL:   { ios: "https://apps.apple.com/app/id", android: "https://play.google.com/store/apps/details?id=" }
  };

  // --- ADDITIONAL DATA POINTS TO REVIEW (not wired yet) ---
  const REVIEW_POINTS = [
    "twitter:app:id:iphone / twitter:app:id:googleplay meta (often stale template values)",
    "Branch.io Journeys / AppsFlyer Smart Script banners (vendor scripts, no store ID in DOM)",
    "Google Consent Mode v2 gcd= param (ad_user_data / ad_personalization)",
    "Global Privacy Control (navigator.globalPrivacyControl) — readable in isolated world",
    "TrustArc / Didomi / Usercentrics / Complianz CMP signatures"
  ];

  globalThis.AWH_DETECT_CONFIG = Object.freeze({
    CONSENT_PROVIDERS,
    CONSENT_CATEGORY_LABELS,
    CONSENT_FRAMEWORKS,
    APP_SIGNALS,
    REVIEW_POINTS
  });
})();
