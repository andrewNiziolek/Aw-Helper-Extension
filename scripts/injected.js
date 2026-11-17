// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// scripts/injected.js — Salesforce Lightning panel module, loaded by bootstrap.js via import()
// (runs in the content-script world, so chrome.runtime is available)

// --- CONSTANTS ---
const PANEL_ID            = "awin-helper-panel";
const ACTIVE_VIEW_SEL     = "div.windowViewMode-normal.oneContent.active.lafPageHost";
const TSE_ACTIVE_VIEW_SEL = "div.oneContent.active";

const SF_LINKS = {
  trackingSettings: mid => `https://ui.awin.com/tracking-settings/us/awin/advertiser/${mid}/main-settings`,
  testDiagnosis:    mid => `https://ui.awin.com/advertiser-integration-tool/trackingwizard/us/awin/merchant/${mid}`,
  inviteUser:       mid => `https://ui.awin.com/awin/merchant/${mid}/settings/invite-user`,
  commissionGroups: mid => `https://ui.awin.com/commission-manager/us/awin/merchant/${mid}/commission-groups`,
  deleteTests:      ()  => "https://ui.awin.com/provider/test-transactions",
  clientSite:       mid => `https://www.awin1.com/awclick.php?mid=${mid}&id=45628&clickref=AWH-test-click`,
  advertiserUI:     mid => `https://ui.awin.com/dashboard/awin/advertiser/${mid}`
};

let menuAbort = null; // aborts the document-level menu listeners when the panel goes away

// --- HELPERS ---
function isMID(value) { return /^\d+$/.test(String(value || "")) && String(value) !== "0"; }

// Opens the full IR tab group (background.js createIRTabs)
function awhStartIR(mid) {
  if (!isMID(mid)) return;
  try {
    chrome.runtime.sendMessage({ action: "createIRTabs", mid: String(mid) }, () => {
      void chrome.runtime.lastError; // background asleep or reloaded; nothing to report
    });
  } catch {
    // extension context invalidated (extension reloaded); page needs a refresh
  }
}

// --- MID LOOKUP (Case pages) ---
// Searches the ACTIVE case view for the MID in the "Program (Signed Product) Details" card,
// retrying while Lightning renders. Resolves with the MID string or null.
export async function findMidOnPage(maxAttempts = 8, delayMs = 350) {

  const programSignedProductDetailsTitle = 'program (signed product) details';
  const awinIdLabelText = 'awin ui link';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[Awin Helper Inject] MID Search Attempt ${attempt}/${maxAttempts}...`);

      //  Step 1: Find the ACTIVE case view container
      const activeCaseViewElement = document.querySelector(ACTIVE_VIEW_SEL);

      if (!activeCaseViewElement) {
          console.warn(`[Awin Helper Inject] Attempt ${attempt}: Active case container ('${ACTIVE_VIEW_SEL}') not found yet.`);
          if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          continue; // Move to the next attempt
      }

      //  Step 2: Search for the "Program..." card *within the active container*
      const programCard = findProgramCard(activeCaseViewElement, programSignedProductDetailsTitle);

      if (programCard) {
          //  Step 3: Search for the Awin ID label within this specific card
          const labelElement = Array.from(programCard.querySelectorAll('span.test-id__field-label, .slds-form-element__label'))
              .find(label => label.textContent?.trim().toLowerCase() === awinIdLabelText);

          if (labelElement) {
              const formItem = labelElement.closest('.slds-form-element');
              if (formItem) {
                  //  Step 4: Find the value element
                  const valueElement = formItem.querySelector(
                      'lightning-formatted-rich-text, span.test-id__field-value, .slds-form-element__control output, .slds-form-element__control slot[name="outputField"] lightning-formatted-number, .slds-form-element__control lightning-formatted-number, .slds-form-element__control a lightning-formatted-text'
                  );
                  if (valueElement) {
                      const potentialMid = valueElement.textContent?.trim();
                      if (potentialMid && /^\d+$/.test(potentialMid) && potentialMid !== "0") {
                          return potentialMid; // Success! Return the MID.
                      } else {
                           console.log(`[Awin Helper Inject] Attempt ${attempt}: Found value element, but content '${potentialMid}' is not a valid MID.`);
                      }
                  } else {
                       console.log(`[Awin Helper Inject] Attempt ${attempt}: Found label, found form item, but couldn't find value element.`);
                  }
              } else {
                   console.log(`[Awin Helper Inject] Attempt ${attempt}: Found label, but couldn't find parent '.slds-form-element'.`);
              }
          } else {
               console.log(`[Awin Helper Inject] Attempt ${attempt}: Found Program Card, but couldn't find 'Awin ID' label within it.`);
          }
      }

      // If MID not found yet in the active view, wait before the next attempt
      if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
      }
  }

  console.log('[Awin Helper Inject] MID Search Failed within active view after all attempts.');
  return null; // Failed to find MID after all attempts
}

// Finds the program card by its (lowercase) title text inside scopeElement
function findProgramCard(scopeElement, titleText) {
  const relatedRecordCards = Array.from(scopeElement.querySelectorAll('article.slds-card'));
  return relatedRecordCards.find(card => {
      const titleElement = card.querySelector('div[role="heading"] a.slds-card__header-link, div[role="heading"] span.slds-card__header-title, .slds-card__header-link span');
      return titleElement?.textContent?.trim().toLowerCase() === titleText;
  });
}

// --- PANEL MARKUP ---
function buildHeaderHtml(mid, iconUrl) {
  const midHtml = mid
    ? `<button type="button" class="awhHead__mid" data-awh-mid-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="awhMidMenu" title="Quick links for this MID">
         MID ${mid} <span class="awhHead__caret" aria-hidden="true">▾</span>
       </button>`
    : `<span class="awhHead__mid awhHead__noMid">No MID</span>`;

  const menuHtml = mid
    ? `<div id="awhMidMenu" data-awh-mid-menu role="menu" aria-label="MID quick links">
         <button type="button" class="awhMenu__item" role="menuitem" data-awh-action="quickIR">Quick IR View</button>
         <a class="awhMenu__item" role="menuitem" href="${SF_LINKS.trackingSettings(mid)}" target="_blank" rel="noopener noreferrer">Tracking Settings</a>
         <a class="awhMenu__item" role="menuitem" href="${SF_LINKS.testDiagnosis(mid)}" target="_blank" rel="noopener noreferrer">Test Diagnosis</a>
       </div>`
    : "";

  return `
    <div class="awhHeadWrap">
      <div class="slds-card__header">
        <header class="awhHead">
          <div class="awhHead__title">
            <span class="awhHead__icon" title="Awin Helper">
              <img src="${iconUrl}" alt="" />
              <span class="slds-assistive-text">Awin Helper</span>
            </span>
            <h2 class="awhHead__text">Awin Helper</h2>
          </div>
          ${midHtml}
        </header>
      </div>
      ${menuHtml}
    </div>
    <div class="slds-card__body slds-card__body_inner">
      <!-- Shadow Root will be attached here -->
    </div>
  `;
}

function buildBodyHtml(mid) {
  if (!mid) {
    return `<div data-awh-body><p data-awh-error>The Signed Product may not contain the MID yet.</p></div>`;
  }
  return `
    <div data-awh-body>
      <div data-awh-section>
        <p class="awhSection__label">Quick actions</p>
        <div data-awh-actions>
          <a class="awhPill" href="${SF_LINKS.clientSite(mid)}" target="_blank" rel="noopener noreferrer" title="Open a test click to the client site">Client Site</a>
          <a class="awhPill" href="${SF_LINKS.inviteUser(mid)}" target="_blank" rel="noopener noreferrer">Invite User</a>
        </div>
      </div>
      <div data-awh-section>
        <p class="awhSection__label">Links</p>
        <div data-awh-actions>
          <a class="awhPill" href="${SF_LINKS.commissionGroups(mid)}" target="_blank" rel="noopener noreferrer">Commission Groups</a>
          <a class="awhPill" href="${SF_LINKS.deleteTests()}" target="_blank" rel="noopener noreferrer">Delete Tests</a>
        </div>
      </div>
    </div>
  `;
}

// --- MID MENU ---
function bindMidMenu(panel, mid) {
  const toggleEl = panel.querySelector("[data-awh-mid-toggle]");
  const menuEl = panel.querySelector("[data-awh-mid-menu]");
  if (!toggleEl || !menuEl) return;

  menuAbort?.abort();
  menuAbort = new AbortController();
  const { signal } = menuAbort;

  const setOpen = (open) => {
    menuEl.classList.toggle("is-open", open);
    toggleEl.setAttribute("aria-expanded", String(open));
  };

  toggleEl.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!menuEl.classList.contains("is-open"));
  }, { signal });

  menuEl.addEventListener("click", (e) => {
    const item = e.target.closest(".awhMenu__item");
    if (!item) return;
    if (item.dataset.awhAction === "quickIR") awhStartIR(mid);
    setOpen(false);
  }, { signal });

  // Close on outside click / Escape
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target)) setOpen(false);
  }, { signal, capture: true });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !menuEl.classList.contains("is-open")) return;
    setOpen(false);
    toggleEl.focus();
  }, { signal });
}

// --- PANEL INJECTION ---
// Injects the panel above the "Case Details" card in the active view. Returns true on success.
export function injectCasePanelOnce(mid) {
  console.log(`[Awin Helper Inject] Attempting to inject panel. Received MID: ${mid}`);
  const safeMid = isMID(mid) ? String(mid) : null;
  const iconUrl = chrome.runtime.getURL("assets/icon48.png");
  const customCSSUrl = chrome.runtime.getURL("css/sfpanel.css");

  //  Find Anchor Point & Validate Active View (Sections 1 & 2)
  const activeCaseViewElement = document.querySelector(ACTIVE_VIEW_SEL);
  if (!activeCaseViewElement) {
      console.warn('[Awin Helper Inject] Injection failed: Active case view container not found when trying to find anchor.');
      return false;
  }
  const targetHeaderSelector = '.slds-card__header-title';
  const targetHeaderText = 'case details';
  const headings = Array.from(activeCaseViewElement.querySelectorAll(targetHeaderSelector));
  const caseDetailsHeader = headings.find(el => el.textContent?.trim().toLowerCase() === targetHeaderText && el.offsetParent !== null && document.body.contains(el));
  if (!caseDetailsHeader) {
      console.warn('[Awin Helper Inject] Injection failed: Anchor "Case Details" header not found or not visible *within the active view*.');
      return false;
  }
  const container = caseDetailsHeader.closest('.slds-card');
  if (!container || !activeCaseViewElement.contains(container)) {
      console.warn('[Awin Helper Inject] Injection failed: Container card for "Case Details" not found within the active view.');
      return false;
  }
  const parent = container.parentElement;
  if (!parent || !activeCaseViewElement.contains(parent)) {
      console.warn('[Awin Helper Inject] Injection failed: Parent element for "Case Details" card not found or not within the active view.');
      return false;
  }

  //  Check if Panel Already Exists (Section 3)
  if (parent.querySelector(`#${PANEL_ID}`)) {
      console.log('[Awin Helper Inject] Panel already exists in the target location.');
      return true;
  }

  //  Create Panel Element (Sections 4 & 5)
  const panel = document.createElement('article');
  panel.id = PANEL_ID;
  panel.className = 'slds-card';
  panel.style.marginBottom = 'var(--lwc-spacingSmall, 0.75rem)';
  panel.style.border = '1px solid #dddbda';
  panel.innerHTML = buildHeaderHtml(safeMid, iconUrl);

  //  Attach Shadow DOM and Inject Content/Styles (Section 5b)
  const cardBody = panel.querySelector('.slds-card__body_inner');
  if (!cardBody) {
      console.error('[Awin Helper Inject] Could not find .slds-card__body_inner to attach shadow DOM.');
      return false;
  }
  try {
      const shadow = cardBody.attachShadow({ mode: 'open' });
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.href = customCSSUrl;
      shadow.appendChild(styleLink);

      const contentWrapper = document.createElement('div');
      contentWrapper.innerHTML = buildBodyHtml(safeMid);
      while (contentWrapper.firstChild) {
          shadow.appendChild(contentWrapper.firstChild);
      }
  } catch {
      cardBody.innerHTML = "<!-- Failed to initialize custom panel content -->";
      return false;
  }

  //  Inject Panel into Page (Section 6)
  try {
      // Final check: ensure container/parent still valid before insertion
      if (!parent.contains(container) || !activeCaseViewElement.contains(parent)) {
          console.warn('[Awin Helper Inject] Injection failed: Target container/parent detached or no longer in active view before insertion.');
          return false;
      }
      parent.insertBefore(panel, container);
      if (safeMid) bindMidMenu(panel, safeMid);
      return true;
  } catch (e) {
      console.error('[Awin Helper Inject] Error during panel insertion:', e);
      return false;
  }
}

// Removes the panel (and its document-level listeners). Returns true if a panel was removed.
export function removeCasePanel() {
  menuAbort?.abort();
  menuAbort = null;

  const existingPanel = document.getElementById(PANEL_ID);
  if (!existingPanel) return false;
  try {
    existingPanel.remove();
    console.log('[Awin Helper Inject] Panel successfully removed.');
    return true;
  } catch (e) {
    console.error('[Awin Helper Inject] Error removing panel:', e);
    return false;
  }
}

// --- TSE__c (Implementation) MID LINKS + IR START ---
// Turns numeric lightning-formatted-text values in the active TSE view into Awin UI links with an
// "IR Start" button. Idempotent. Returns the first MID on the page, or null.
export function decorateTseMids() {
  const viewEl = document.querySelector(TSE_ACTIVE_VIEW_SEL);
  if (!viewEl) return null;

  // 1. Fresh numeric values (same heuristic as the old background.js transformNumbersToLinks)
  viewEl.querySelectorAll("lightning-formatted-text").forEach(el => {
    const value = el.textContent?.trim() || "";
    if (!isMID(value)) return;

    const linkEl = document.createElement("a");
    linkEl.href = SF_LINKS.advertiserUI(value);
    linkEl.textContent = value;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.title = "Jump to the UI.";
    linkEl.dataset.awhMidLink = value;

    el.replaceWith(linkEl);
  });

  // 2. Make sure every MID link has its IR Start button (Lightning can re-render siblings)
  let firstMid = null;
  viewEl.querySelectorAll("a[data-awh-mid-link]").forEach(linkEl => {
    const mid = linkEl.dataset.awhMidLink;
    if (!isMID(mid)) return;
    firstMid = firstMid || mid;

    if (linkEl.nextElementSibling?.matches?.("button[data-awh-ir-start]")) return;

    const btnEl = document.createElement("button");
    btnEl.type = "button";
    btnEl.textContent = "IR Start";
    btnEl.title = `Open the Internal Review tabs for ${mid}`;
    btnEl.dataset.awhIrStart = mid;
    btnEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); // don't trigger Lightning's inline edit / row handlers
      awhStartIR(mid);
    });
    linkEl.after(btnEl);
  });

  return firstMid;
}

try {
CSS.registerProperty({
    name: '--case-insensitive-text-matcher',
    syntax: '<string>',
    initialValue: '""',
    inherits: false
  });
} catch {
  // already registered on a previous import
}
