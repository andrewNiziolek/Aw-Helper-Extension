// Generic Controllers & Helpers
// === Action on Enter Press ===
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

// Core Actions
function sendImplMID(MIDValue) {
    chrome.runtime.sendMessage({action: "createNewImplTabs", mid: MIDValue });
}

function sendIRMID(MIDValue) {
    chrome.runtime.sendMessage({ action: "createIRTabs", mid: MIDValue });
}

// ===============
// Pop-up Triggers
// ===============

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

// ===============
// Dynamic Page Triggers or Injections
// ===============

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