// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// --- Linking to docs from detection Chips ---
// Chips are rendered dynamically by techPanel.js (id = `${configKey}Chip`),
// so a single delegated listener on the container handles every chip.
const CHIP_DOCS = {
  gtmChip: "https://developer.awin.com/docs/gtm-client-side",
  gtSSChip: "https://developer.awin.com/docs/gtm-s2s",
  shopifyChip: "https://developer.awin.com/docs/shopify",
  wooCommChip: "https://developer.awin.com/docs/wordpress-woocommerce",
  magentoChip: "https://developer.awin.com/docs/magento",
  launchChip: "https://wiki.awin.com/index.php/Adobe_Tag_Manager",
  tealiumChip: "https://developer.awin.com/docs/client-side-tracking"
};

const techContainer = document.getElementById("techContainer");

techContainer?.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;

  const url = CHIP_DOCS[chip.id];
  if (url) chrome.tabs.create({ url, active: false });
});
