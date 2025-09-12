
const midInput = document.getElementById("inRevMIDBox");
const IRgoBtn = document.getElementById("intRevBtn");
const collapsibleBtn = document.getElementById("intReviewView");

const sanitizeMID = (v) => String(v || "").replace(/\D/g, "");

// Robust "is open" check: class, aria, or visible content sibling
function isIROpen() {
  if (!collapsibleBtn) return true;
  const content = collapsibleBtn.nextElementSibling; // .collapse-content
  const btnOpen =
    collapsibleBtn.classList.contains("open") ||
    collapsibleBtn.classList.contains("active") ||
    collapsibleBtn.getAttribute("aria-expanded") === "true";
  const contentOpen =
    content &&
    (content.classList.contains("open") || content.classList.contains("active"));
  const visible =
    content &&
    content.offsetParent !== null &&
    content.scrollHeight > 0 &&
    getComputedStyle(content).maxHeight !== "0px" &&
    getComputedStyle(content).display !== "none";
  return btnOpen || contentOpen || visible;
}

function sendIR(mid) {
  const sanitized = sanitizeMID(mid);
  if (!sanitized) return;
  chrome.runtime.sendMessage({ action: "createIRTabs", mid: sanitized });
}

// Button click → send
IRgoBtn?.addEventListener("click", () => {
  sendIR(midInput?.value);
});

// Enter inside the MID field only when the collapsible is open
midInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && isIROpen()) {
    e.preventDefault();
    IRgoBtn?.click();
  }
});

// AWC chip wiring (appears dynamically)
(function wireAwcChip() {
  const tryBind = (chipEl) => {
    if (!chipEl || chipEl.__irBound) return;
    chipEl.__irBound = true;
    chipEl.classList.add("tooltip");
    chipEl.setAttribute("data-tooltip", "Click for IR.");
    chipEl.addEventListener("click", () => {
      // Chip text may be like "12345 Detected" → sanitize to digits only
      sendIR(chipEl.textContent);
    });
  };

  // If already present
  const immediate = document.getElementById("awcChip");
  if (immediate) tryBind(immediate);

  // Observe future inserts/changes
  const obs = new MutationObserver(() => {
    const el = document.getElementById("awcChip");
    if (el && el.textContent && el.textContent.trim() !== "Detected") {
      tryBind(el);
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();