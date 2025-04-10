console.log('Content script loaded');
window.__awin_helper_meta = {
  by: 'Andrew Niziolek',
  license: 'AGPL-3.0',
  fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
};

// Update version in the popup
chrome.runtime.sendMessage({ getVersion: true }, (response) => {
  if (response && response.version) {
    const versionElement = document.querySelector('.headVer');
    if (versionElement) {
      versionElement.textContent = response.version;
    }
  }
});

// Handle element clicks
document.addEventListener('click', (event) => {
  const interactionID = event.target.id;
  if (interactionID) {
    console.log('Element clicked:', interactionID); // Log the clicked element ID
    chrome.runtime.sendMessage({ elementId: interactionID });
  }
});

// ---------- Attribution Link Buttons ----------
const openGitURL = () => {
  chrome.tabs.create({ url: "https://github.com/ajaxburger/Aw-Helper-Extension/wiki/Extension-Attributions" });
};

const openPersonalAttribURL = () => {
  chrome.tabs.create({
    url: "https://www.andrewniziolek.com/?utm_source=awhelper&utm_medium=extension&utm_campaign=personal_attribution"
  });
};

document.getElementById("attribText")?.addEventListener("click", openGitURL);
document.getElementById("personalAttrib")?.addEventListener("click", openPersonalAttribURL);

/**
 * Awin Helper
 * Copyright (c) 2025 Andrew Niziolek
 * Licensed under AGPL-3.0
 * https://www.gnu.org/licenses/agpl-3.0.html
 * https://github.com/andrewNiziolek/Aw-Helper-Extension
 * Fingerprint: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 */