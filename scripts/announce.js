console.log("announce.js loaded");

const ANN_ENDPOINT = "https://www.andrewniziolek.com/aw-announce.json";
const EXT_VERSION  = chrome.runtime.getManifest().version;

const ICON_MAP  = { info:"#ann-info", warning:"#ann-warn", critical:"#ann-crit" };
const CHIP_TEXT = { info:"Info",      warning:"Attention",  critical:"Important" };

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
  } catch {
    // offline? keep hidden
  }

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

  const type = (it.class === "critical" || it.class === "warning") ? it.class : "info";
  const chipText = CHIP_TEXT[type] || CHIP_TEXT.info;
  const iconHref = ICON_MAP[type] || ICON_MAP.info;

  // Map severity to chip color classes
  const chipColorClass =
    type === "critical" ? "chipDifficult" :
    type === "warning"  ? "chipModerate"  :
                          "chipEasy";     // info

  // Toggle type classes on the container
  mount.classList.remove("is-info","is-warning","is-critical");
  mount.classList.add("is-visible", `is-${type}`);

  // Update the announcement title text
  const textEl = mount.querySelector("#announceText") || mount.querySelector(".announceReadout");
  if (textEl) {
    textEl.textContent = it.title || "Announcement";
  }

  let chipEl = document.getElementById("announceChip");
  if (!chipEl) {
    chipEl = document.createElement("span");
    chipEl.id = "announceChip";
    chipEl.className = "chip announceChip";
    mount.appendChild(chipEl);
  }

  chipEl.classList.remove("chipEasy","chipModerate","chipDifficult");
  chipEl.classList.add(chipColorClass);
  chipEl.setAttribute("aria-label", chipText);

  chipEl.innerHTML = `
    <svg class="chipIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <use href="${iconHref}"></use>
    </svg>
  `;

  //Expandable "More" panel
  more.innerHTML = `
    <div class="announceMore__inner">
      <div class="announceMore__body">${escapeHtml(it.body || "")}</div>
      <div class="announceMore__actions">
        ${it.url ? `<a class="annLink" href="${escapeAttr(it.url)}" target="_blank" rel="noopener">Learn more</a>` : ""}
        <button class="annDismiss" type="button">Dismiss</button>
      </div>
    </div>
  `;

  // Toggle behavior: clicking the bar opens/closes the extra panel
  let open = false;
  const toggle = () => {
    open = !open;
    more.classList.toggle("is-open", open);
    mount.setAttribute("aria-expanded", String(open));
  };

  mount.addEventListener("click", toggle);
  mount.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  mount.setAttribute("role","button");
  mount.setAttribute("tabindex","0");
  mount.setAttribute("aria-expanded","false");

  // Dismiss handling
  more.querySelector(".annDismiss")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const { dismissedAnnIds = [] } = await chrome.storage.local.get("dismissedAnnIds");
    const next = Array.from(new Set([...(dismissedAnnIds||[]), it.id]));
    await chrome.storage.local.set({ dismissedAnnIds: next });

    more.classList.remove("is-open");
    mount.classList.remove("is-visible", "is-info", "is-warning", "is-critical");
    mount.removeAttribute("aria-expanded");
    if (textEl) textEl.textContent = "";
    if (chipEl)  chipEl.innerHTML = "";
  });
}

function escapeHtml(s=""){ return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function escapeAttr(s=""){ return String(s).replace(/"/g,"&quot;"); }
function semverLt(a,b){
  const pa=(a||"").split(".").map(n=>parseInt(n||"0",10));
  const pb=(b||"").split(".").map(n=>parseInt(n||"0",10));
  for (let i=0;i<3;i++){ if((pa[i]||0)!==(pb[i]||0)) return (pa[i]||0)<(pb[i]||0); }
  return false;
}
