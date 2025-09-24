// ===== Config =====
const ANN_ENDPOINT = "https://github.com/andrewNiziolek/Aw-Helper-Extension/wiki/announcements.json";
const EXT_VERSION  = chrome.runtime.getManifest().version;

const ICON_MAP  = { info:"#ann-info", warning:"#ann-warn", critical:"#ann-crit" };
const CHIP_TEXT = { info:"Info", warning:"Attention", critical:"Important" };

// Call during your popup init:
initAnnouncement();

async function initAnnouncement() {
  const mount = document.getElementById("announceMount");
  const more  = document.getElementById("announceMore");
  if (!mount || !more) return;

  const { dismissedAnnIds = [] } = await chrome.storage.local.get("dismissedAnnIds");

  let items = [];
  try {
    const res = await fetch(ANN_ENDPOINT, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      items = Array.isArray(data?.items) ? data.items : [];
    }
  } catch { /* offline? keep hidden */ }

  const now = Date.now();
  const valid = items.filter(it => {
    if (!it?.active) return false;
    if (!it?.id) return false;
    if (dismissedAnnIds.includes(it.id)) return false;
    if (it.min_version && semverLt(EXT_VERSION, it.min_version)) return false;
    if (it.expires_at && Date.parse(it.expires_at) < now) return false;
    return true;
  });
  if (!valid.length) return;

  // Highest severity, then newest
  const rank = { critical:3, warning:2, info:1 };
  valid.sort((a,b)=> (rank[b.class]||0)-(rank[a.class]||0) || Date.parse(b.ts||0)-Date.parse(a.ts||0));
  const it = valid[0];
  const iconHref = ICON_MAP[it.class] || ICON_MAP.info;
  const chipText = CHIP_TEXT[it.class] || CHIP_TEXT.info;

  // Build the main bar (your announceDisplay)
  mount.innerHTML = `
    <div class="announceIcon">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="color:currentColor">
        <use href="${iconHref}"></use>
      </svg>
    </div>
    <div class="announceReadout">${escapeHtml(it.title || "Announcement")}</div>
    <div class="announceChip">${chipText}</div>
  `;
  // Make it visible and grid-based per your CSS
  mount.style.display = "grid";

  // Build the expandable info panel (using your .announceAdditionalInfo)
  more.innerHTML = `
    <div style="padding:8px 10px; display:flex; align-items:center; justify-content:space-between;">
      <div style="font-size:13px;">${escapeHtml(it.body || "")}</div>
      <div style="display:flex; gap:8px; margin-left:12px;">
        ${it.url ? `<a class="annLink" href="${escapeAttr(it.url)}" target="_blank" rel="noopener">Learn more</a>` : ""}
        <button class="annDismiss" type="button" style="cursor:pointer;">Dismiss</button>
      </div>
    </div>
  `;

  // Toggle behavior: clicking the bar opens/closes the extra panel
  let open = false;
  const toggle = () => {
    open = !open;
    more.style.display = open ? "block" : "none";
  };
  mount.addEventListener("click", toggle);
  mount.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  mount.setAttribute("role","button");
  mount.setAttribute("tabindex","0");
  mount.setAttribute("aria-expanded","false");

  // Keep ARIA in sync
  const syncAria = () => mount.setAttribute("aria-expanded", String(open));
  mount.addEventListener("click", syncAria);
  mount.addEventListener("keydown", syncAria);

  // Dismiss handling
  more.querySelector(".annDismiss")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const { dismissedAnnIds = [] } = await chrome.storage.local.get("dismissedAnnIds");
    const next = Array.from(new Set([...(dismissedAnnIds||[]), it.id]));
    await chrome.storage.local.set({ dismissedAnnIds: next });
    // Hide everything
    more.style.display = "none";
    mount.style.display = "none";
  });
}

// --- helpers ---
function escapeHtml(s=""){ return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function escapeAttr(s=""){ return String(s).replace(/"/g,"&quot;"); }
function semverLt(a,b){
  const pa=(a||"").split(".").map(n=>parseInt(n||"0",10));
  const pb=(b||"").split(".").map(n=>parseInt(n||"0",10));
  for (let i=0;i<3;i++){ if((pa[i]||0)!==(pb[i]||0)) return (pa[i]||0)<(pb[i]||0); }
  return false;
}
