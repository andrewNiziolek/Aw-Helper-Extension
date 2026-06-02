// sidepanel.js
async function updateSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab) {
    chrome.runtime.sendMessage({ action: "getTabDetections", tabId: tab.id }, (response) => {
      // Assuming your background script returns an array of keys like: ["awc", "gtm"]
      const detections = response?.detections || [];
      renderDetections(detections);
    });
  }
}

chrome.tabs.onActivated.addListener(() => {
  updateSidePanel();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateSidePanel();
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "techDetectedLive") {
    // If the message comes from the active tab, re-render immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && sender.tab && tabs[0].id === sender.tab.id) {
        updateSidePanel();
      }
    });
  }
});

updateSidePanel();