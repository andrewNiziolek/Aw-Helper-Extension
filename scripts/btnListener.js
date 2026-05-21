// Generic Controllers
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



// New Impl Tool
const implMIDBox = document.getElementById("");
const implBtn = document.getElementById("");
const implCollapse = document.getElementById("");

function sendImplMID(MIDValue) {
    chrome.runtime.sendMessage({action: "createNewImplTabs", mid: MIDValue });
}

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

function sendIRMID(MIDValue) {
    chrome.runtime.sendMessage({ action: "createIRTabs", mid: sanitized });
}

irBtn?.addEventListener("click", () => {
    const saniIRMID = irMIDBox.value.replace(/\D/g, "");
    if (saniIRMID) sendIRMID(saniIRMID);
});

irCollapse?.addEventListener("keydown", (e) => {
    enterControl(irCollapse, irBtn, e);
});