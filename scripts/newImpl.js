const importMIDBox = document.getElementById("implMIDBox");
const goBtn = document.getElementById("newImplBtn");
const collapsible = document.getElementById("newImplView");

function sendOrders(MIDValue) {
  chrome.runtime.sendMessage({ action: "createNITabs", mid: MIDValue });
}

goBtn.addEventListener("click", () => {
  const rawMIDValue = importMIDBox.value;
  const saniMID = rawMIDValue.replace(/\D/g, "");
  if (saniMID) sendOrders(saniMID);
});

// Only trigger Go on Enter when the collapsible is open and the input is focused
importMIDBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const isOpen =
      collapsible.classList.contains("active") ||
      collapsible.classList.contains("open"); // adapt to your toggle code

    if (isOpen) {
      e.preventDefault();
      goBtn.click();
    }
  }
});