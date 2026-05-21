// === Generic Controllers & Helpers ===

//Open Side Panel
const spButton = document.getElementById("spButton");

spButton?.addEventListener("click", async () => {
  // 1. Get the current window
  const currentWindow = await chrome.windows.getCurrent();
  
  // 2. Pass the windowId to the open command
  await chrome.sidePanel.open({ windowId: currentWindow.id });
  
  // Optional: Close the popup so the user can focus on the side panel
  window.close(); 
});

// Collapsible Sections
var coll = document.getElementsByClassName("collapsible");
var i;

for (i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function () {
    // Close others
    for (var j = 0; j < coll.length; j++) {
      if (coll[j] !== this && coll[j].classList.contains("active")) {
        coll[j].classList.remove("active");
        coll[j].nextElementSibling.style.maxHeight = null;
        const otherIcon = coll[j].querySelector(".collapsible-icon");
        if (otherIcon) otherIcon.textContent = "+";
      }
    }
  
    // Toggle this
    this.classList.toggle("active");
    const content = this.nextElementSibling;
    if (content.style.maxHeight) {
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  
    // Update this icon
    const icon = this.querySelector(".collapsible-icon");
    if (icon) icon.textContent = this.classList.contains("active") ? "−" : "+";
  });
  
}

// Action on Enter Press
function enterControl(openCol, btnPoint, kbKey) {
    if (kbKey.key == "Enter") {
        const isOpen =
        openCol.classList.contains("active") ||
        openCol.classList.contains("open");

        if (isOpen) {
            kbKey.preventDefault();
            btnPoint.click();
        }
    }
};

// === Core Actions ===
function sendImplMID(MIDValue) {
    chrome.runtime.sendMessage({action: "createNewImplTabs", mid: MIDValue });
}

function sendIRMID(MIDValue) {
    chrome.runtime.sendMessage({ action: "createIRTabs", mid: MIDValue });
}

// === Pop-up Triggers===

//New Implementation Tool
const implMIDBox = document.getElementById("");
const implBtn = document.getElementById("");
const implCollapse = document.getElementById("");

implBtn?.addEventListener("click", () => {
    const saniImplMID = implMIDBox.value.replace(/\D/g, "");
    if (saniImplMID) sendImplMID(saniImplMID);
});

implCollapse?.addEventListener("keydown", (e) => {
    enterControl(implCollapse, implBtn, e);
});

// Internal Review Tool
const irMIDBox = document.getElementById("");
const irBtn = document.getElementById("");
const irCollapse = document.getElementById("");

irBtn?.addEventListener("click", () => {
    const saniIRMID = irMIDBox.value.replace(/\D/g, "");
    if (saniIRMID) sendIRMID(saniIRMID);
});

irCollapse?.addEventListener("keydown", (e) => {
    enterControl(irCollapse, irBtn, e);
});

// Test URL Tool
const testURLMIDBox = document.getElementById("");
const testURLBtn = document.getElementById("");
const testURLCollapse = document.getElementById("");

function createtestTabs(MID) {
    const URL = [`http://awin1.com/awclick.php?mid=${MID}&id=45628&clickref=TESTURLGen`];

    chrome.tabs.create({URL});
}

testURLBtn?.addEventListener("click", () => {
    const saniTestMID = testURLMIDBox.value.replace(/\D/g, "");
    if (saniTestMID) createtestTabs(saniTestMID);
})

testURLCollapse?.addEventListener("keydown", (e) => {
    enterControl(testURLCollapse, testURLBtn, e);
});

// === Dynamic Page Triggers or Injections ===

//AWC Chip Injecting and Binding
const tryBindAwcChip = (chipEl) => {
    if (!chipEl || chipEl.__irBound) return;
    
    chipEl.__irBound = true;
    chipEl.classList.add("tooltip");
    chipEl.setAttribute("data-tooltip", "Click for IR.");
    
    chipEl.addEventListener("click", () => {
        const saniChipMID = chipEl.textContent.replace(/\D/g, "");
        // Calls the Core Action from Section 2
        if (saniChipMID) sendIRMID(saniChipMID);
    });
};

const immediateChip = document.getElementById("awcChip");
if (immediateChip) tryBindAwcChip(immediateChip);

const chipObserver = new MutationObserver(() => {
    const el = document.getElementById("awcChip");
    if (el && el.textContent && el.textContent.trim() !== "Detected") {
        tryBindAwcChip(el);
    }
});
chipObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });