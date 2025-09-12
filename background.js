// Variable to control whether the update popup should open. "1" to disable.
let disableUpdatePopup = "0 ";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update' && disableUpdatePopup === "0") {
    // Open a new tab in a new group when the extension is updated
    chrome.tabs.create({ url: 'https://aniziolek.notion.site/Awin-Helper-Updates-1ec7c46530f34c3691e307f498284fd4?pvs=74', active: true }, (tab) => {
      chrome.tabs.group({ tabIds: [tab.id] }, (groupId) => {
        chrome.tabGroups.update(groupId, {
          title: 'AWH Update',
          color: 'orange'
        });
      });
    });
  }
});

// Send the version from manifest.json to the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.getVersion) {
    const manifestData = chrome.runtime.getManifest();
    sendResponse({ version: manifestData.version });
  }
});

// Replace MIDs with clickable links on specific SF pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes("https://awin.lightning.force.com/lightning/r/TSE__c")) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: transformNumbersToLinks
    });
  }
});

// Function to replace numbers with clickable links
function transformNumbersToLinks() {
  const replaceNumbers = (rootElement = document) => {
    rootElement.querySelectorAll('lightning-formatted-text').forEach(element => {
      // fp: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const textContent = element.textContent.trim();
      if (/^\d+$/.test(textContent)) {  // Check if the content is purely numbers
        const numberLink = document.createElement('a');
        numberLink.href = `https://ui.awin.com/dashboard/awin/advertiser/${textContent}`;
        numberLink.textContent = textContent;
        numberLink.style.color = '#fc8e45';
        numberLink.style.textDecoration = 'underline';
        numberLink.target = '_blank'; // Open in a new tab
        
        numberLink.title = 'Jump to the UI.'; // Tooltip text

        element.replaceWith(numberLink);
      }
    });
  };

  // Run once when the script is first injected
  replaceNumbers();

  // Set up a MutationObserver to monitor for changes in the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          replaceNumbers(node); // Re-run the replacement function only for added nodes
        }
      });
    });
  });

  // Start observing the document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}



// Start of New Implementation Tool
// Create tabs and group them; use the MID passed in from the popup for the group title.
function createImplTabs(urls, tabMID) {
  const tabIds = [];

  urls.forEach((url) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab || typeof tab.id !== 'number') return;
      tabIds.push(tab.id);

      // When all tabs are open, group and label them.
      if (tabIds.length === urls.length) {
        chrome.tabs.group({ tabIds }, (groupId) => {
          if (typeof groupId !== 'number') return;
          chrome.tabGroups.update(groupId, { title: tabMID, color: 'orange' });
        });
      }
    });
  });
}

// Listen for sanitized MID from the popup and invoke the tab creation.
chrome.runtime.onMessage.addListener((request) => {
  if (request?.action !== 'createNITabs') return;

  const MIDValue = String(request.mid); // already sanitized in popup
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

  createImplTabs(URLs, MIDValue);
});

// Start Internal Review Tool
function createIRGroupTabs(urls, mid) {
  const tabIds = [];

  urls.forEach((url) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab || typeof tab.id !== 'number') return;
      tabIds.push(tab.id);

      if (tabIds.length === urls.length) {
        chrome.tabs.group({ tabIds }, (groupId) => {
          if (typeof groupId !== 'number') return;
          chrome.tabGroups.update(groupId, { title: `${mid} IR`, color: 'orange' });
        });
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request?.action !== 'createIRTabs') return;

  const MIDValue = String(request.mid); // already sanitized in popup
  const URLs = [
    `https://ui.awin.com/tracking-settings/us/awin/advertiser/${MIDValue}/main-settings`,
    `https://ui.awin.com/commission-manager/us/awin/merchant/${MIDValue}/commission-groups`,
    `https://ui.awin.com/advertiser-mastertag/us/awin/${MIDValue}/plugins`,
    `https://ui.awin.com/awin/merchant/${MIDValue}/validate-pending/network/awin`,
    `https://ui.awin.com/advertiser-integration-tool/trackingwizard/us/awin/merchant/${MIDValue}`,
    `https://ui.awin.com/provider/merchant-settings/${MIDValue}/account-details/network/awin`,
    `https://ui.awin.com/provider/merchant-settings/${MIDValue}/mobile-tracking/network/awin`,
    `https://ui.awin.com/provider/finance/fee-manager/en/${MIDValue}`,
    `https://ui.awin.com/provider/pre-join-publishers?advertiserId=${MIDValue}`,
    `https://ui.awin.com/provider/migrated-advertiser-settings/${MIDValue}`
  ];

  createIRGroupTabs(URLs, MIDValue);
});

// Tech Detection Script Listener
const perTab = new Map();

function setBadge(tabId, count) {
  const text = count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ color: '#FF9550' });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'TECH_DETECTIONS') return;
  const tabId = sender?.tab?.id;
  if (!Number.isInteger(tabId)) return;
  perTab.set(tabId, msg.items || []);
  setBadge(tabId, (msg.items || []).length);
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') {
    perTab.delete(tabId);
    setBadge(tabId, 0);
  }
});

chrome.webNavigation?.onCommitted?.addListener(({ tabId }) => {
  perTab.delete(tabId);
  setBadge(tabId, 0);
});

chrome.webNavigation?.onHistoryStateUpdated?.addListener(({ tabId }) => {
  perTab.delete(tabId);
  setBadge(tabId, 0);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  perTab.delete(tabId);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "GET_TECH_DETECTIONS") {
    const tabId = msg.tabId;
    const items = (perTab.get(tabId) || []);
    sendResponse({ items });
    return true; // keep channel open for async response
  }
});
