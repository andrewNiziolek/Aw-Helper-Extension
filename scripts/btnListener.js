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

function sendMID(MIDValue) {
    chrome.runtime.sendMessage({action: "createNewImplTabs", mid: MIDValue });
}

implBtn.addEventListener("click", () => {
    const saniMID = implMIDBox.value.replace(/\D/g, "");
    if (saniMID) sendOrders(saniMID);
});

implCollapse.addEventListener("keydown", (e) => {
    enterControl(implCollapse, implBtn, e);
});