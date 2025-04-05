console.log('Content script loaded');

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
