// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// scripts/theme.js — System / Light / Dark theme for Glance + Dock.
// Load synchronously as the first element in <head> so data-awh-theme lands before first paint.

const THEME_KEY   = "awh_theme_mode";  // chrome.storage.local (source of truth)
const THEME_CACHE = "awh_theme_cache"; // localStorage mirror for the synchronous pre-paint read
const THEME_MODES = ["system", "light", "dark"];

function normalizeTheme(mode) { return THEME_MODES.includes(mode) ? mode : "system"; }

function syncThemeSwitches(mode) {
  document.querySelectorAll(".themeSwitch__btn[data-theme-value]").forEach(btnEl => {
    const isActive = btnEl.dataset.themeValue === mode;
    btnEl.classList.toggle("is-active", isActive);
    btnEl.setAttribute("aria-checked", String(isActive));
  });
}

function applyTheme(mode) {
  const value = normalizeTheme(mode);
  document.documentElement.dataset.awhTheme = value;
  try {
    localStorage.setItem(THEME_CACHE, value);
  } catch {
    // storage blocked; chrome.storage still drives the theme
  }
  syncThemeSwitches(value);
  return value;
}

// --- 1. Pre-paint: apply the cached theme synchronously ---
let currentTheme = "system";
try {
  currentTheme = applyTheme(localStorage.getItem(THEME_CACHE));
} catch {
  currentTheme = applyTheme("system");
}

// --- 2. Reconcile with chrome.storage (source of truth) ---
async function initTheme() {
  try {
    const { [THEME_KEY]: stored } = await chrome.storage.local.get(THEME_KEY);
    const mode = normalizeTheme(stored);
    if (mode !== currentTheme) currentTheme = applyTheme(mode);
  } catch {
    // storage unavailable; keep the cached theme
  }
}

function bindThemeSwitches() {
  document.querySelectorAll(".themeSwitch__btn[data-theme-value]").forEach(btnEl => {
    if (btnEl.dataset.themeBound) return;
    btnEl.dataset.themeBound = "1";
    btnEl.addEventListener("click", async () => {
      const mode = normalizeTheme(btnEl.dataset.themeValue);
      currentTheme = applyTheme(mode); // instant local feedback
      try {
        await chrome.storage.local.set({ [THEME_KEY]: mode });
      } catch {
        // not persisted; this surface still switched
      }
    });
  });
  syncThemeSwitches(currentTheme);
}

// ==========================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================

// --- 3. Live sync across Glance, Dock (and Salesforce via bootstrap.js) ---
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[THEME_KEY]) return;
  currentTheme = applyTheme(changes[THEME_KEY].newValue);
});

// --- 4. Switcher buttons exist once the body has parsed ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindThemeSwitches);
} else {
  bindThemeSwitches();
}

initTheme();
