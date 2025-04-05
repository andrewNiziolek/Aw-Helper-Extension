// Capture HTML Elements
const importIRBox = document.getElementById("inRevMIDBox");
const goIRBtn = document.getElementById("intRevBtn");

// MT Chip Element
const awcChip = document.getElementById("awcChip");


// createTabs and Group them using Chrome API
function createIRGroupTabs(URLs) {
  let tabIds = [];

  const titleMID = importIRBox.value;
  URLs.forEach((url, index) => {
    chrome.tabs.create({ url: url, active: false }, (tab) => {
      tabIds.push(tab.id);
      if (tabIds.length === URLs.length) {
        // Once all tabs are created, group them
        chrome.tabs.group({ tabIds: tabIds }, (groupId) => {
          // Update the group with a name and color
          chrome.tabGroups.update(groupId, {
            title: titleMID + " IR",
            color: 'orange'
          });
        });
      }
    });
  });
}

// Wait for awcChip to exist before binding click
function waitForAWCChip(callback) {
  const interval = setInterval(() => {
    const chip = document.getElementById("awcChip");
    if (chip && chip.textContent && chip.textContent !== "Detected") {
      clearInterval(interval);
      callback(chip);
    }
  }, 200);
}

// Add click listener when awcChip is available
waitForAWCChip((chip) => {
  chip.style.cursor = "pointer";
  chip.addEventListener("click", () => {
    let MIDValue = chip.textContent.split(" ")[0]; // Handles "123456 +2" format
    if (!MIDValue || MIDValue === "Detected") return;

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

    createIRGroupTabs(URLs);
  });
});


// goBtn activates the cT function.
goIRBtn.addEventListener("click", () => {
  const MIDValue = importIRBox.value;
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

  createIRGroupTabs(URLs);
});