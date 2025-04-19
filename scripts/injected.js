// --- injected.js ---

// Export the function so it can be imported by bootstrap.js
export function injectCasePanelOnce() { // Keep async for potential future await inside
  const iconUrl = chrome.runtime.getURL("assets/icon48.png");
  const panelId = 'awin-helper-panel';
  // console.log(`[Awin Helper Inject V4.4] Running injectCasePanelOnce`); // Keep log minimal unless debugging

  // --- 1. Find the Anchor Point ("Case Details" header) ---
  const targetHeaderSelector = '.slds-card__header-title';
  const targetHeaderText = 'case details';
  const searchRoot = document; // Search globally

  const headings = Array.from(searchRoot.querySelectorAll(targetHeaderSelector));
  if (headings.length === 0) {
      // console.warn('[Awin Helper Inject V4.4] Failed: No header candidates found.');
      return false;
  }

  // Find the *first visible* header that matches and is connected to the DOM
  const caseDetailsHeader = headings.find(el =>
    el.textContent?.trim().toLowerCase() === targetHeaderText &&
    el.offsetParent !== null && // Basic visibility check
    document.body.contains(el)
  );

  if (!caseDetailsHeader) {
    // console.warn('[Awin Helper Inject V4.4] Failed: "Case Details" header not found/visible.');
    return false;
  }

  // --- 2. Find the Container and Parent ---
  const container = caseDetailsHeader.closest('.slds-card');
  if (!container || !document.body.contains(container)) {
      console.warn('[Awin Helper Inject V4.4] Failed: Could not find attached ".slds-card".');
      return false;
  }

  const parent = container.parentElement;
  if (!parent || !document.body.contains(parent)) {
    console.warn('[Awin Helper Inject V4.4] Failed: Could not find attached parentElement.');
    return false;
  }

  // --- 3. Extract Data (MID - Refined Logic) ---
  let mid = null;
  const programSignedProductDetailsTitle = 'program (signed product) details';
  const awinIdLabelText = 'awin id';

  console.log('[Awin Helper Inject V4.4] Searching for MID...');

  // Find all related record cards (assuming they are siblings or near the Case Details)
  const relatedRecordCards = Array.from(document.querySelectorAll('support-lwc-related-record article.slds-card'));

  // Find the specific "Program (Signed Product) Details" card by its title
  const programCard = relatedRecordCards.find(card => {
      // Check if the card is still attached to the document body
      if (!document.body.contains(card)) return false;
      // Find the title link within the card header
      const titleLink = card.querySelector('.slds-card__header-title a');
      // Check if title link exists and its text matches
      return titleLink?.textContent?.trim().toLowerCase() === programSignedProductDetailsTitle;
  });


  if (programCard) {
      console.log('[Awin Helper Inject V4.4] Found "Program (Signed Product) Details" card.');
      // Within that card, find the label "Awin ID"
      // Use querySelectorAll for robustness in case of multiple labels, then find the right one
      const labelElement = Array.from(programCard.querySelectorAll('span.test-id__field-label'))
          .find(label => label.textContent?.trim().toLowerCase() === awinIdLabelText);

      if (labelElement && programCard.contains(labelElement)) { // Check label exists and is inside the card
          console.log('[Awin Helper Inject V4.4] Found "Awin ID" label.');
          // Find the <dd> element containing the value: navigate up to the form item, then find the <dd>
          const formItem = labelElement.closest('.slds-form-element');
          const ddElement = formItem?.querySelector('dd'); // Find dd within the form item

          if (ddElement && programCard.contains(ddElement)) { // Check dd exists and is inside card
               // The value is inside a lightning-formatted-text, possibly within records-formula-output
               // More specific selector based on your provided HTML:
               const midElement = ddElement.querySelector('.test-id__field-value records-formula-output lightning-formatted-text, .test-id__field-value lightning-formatted-text');

               if (midElement && ddElement.contains(midElement)) { // Check value element is inside dd
                    const potentialMid = midElement.textContent?.trim();
                    console.log(`[Awin Helper Inject V4.4] Found potential MID value: "${potentialMid}"`);
                    // Validate: Must be digits and not "0" or empty
                    if (potentialMid && /^\d+$/.test(potentialMid) && potentialMid !== "0") {
                         mid = potentialMid;
                    } else {
                         console.log('[Awin Helper Inject V4.4] Potential MID is invalid (empty, "0", or not digits).');
                    }
               } else {
                   console.warn('[Awin Helper Inject V4.4] Found "Awin ID" label/dd, but could not find its value element (lightning-formatted-text).');
               }
          } else {
               console.warn('[Awin Helper Inject V4.4] Found "Awin ID" label, but could not find its value container (<dd>) within the form item.');
          }
      } else {
          console.log('[Awin Helper Inject V4.4] Could not find "Awin ID" label within the Program Details card.');
      }
  } else {
       console.log('[Awin Helper Inject V4.4] Could not find "Program (Signed Product) Details" card.');
  }

  // Final log after attempts
  if (mid) {
      console.log(`[Awin Helper Inject V4.4] Successfully extracted MID: ${mid}`);
  } else {
       console.log('[Awin Helper Inject V4.4] MID extraction failed or yielded invalid/no result.');
  }


  // --- 4. Prepare Panel Content ---
  const links = mid
    ? [
        { label: "Tracking Diagnosis", href: `https://ui.awin.com/diagnostics?advertiserId=${mid}` },
        { label: "Invite User", href: `https://ui.awin.com/invite?advertiserId=${mid}` },
        // Add other relevant links based on MID availability if needed
      ]
    : []; // Empty array if no valid MID

  // Use the specific "Couldn't find..." message if MID is null/invalid
  const listHtml = mid
    ? `<ul class="slds-list_dotted slds-list_vertical slds-text-body_regular" style="padding-left: 1rem; margin: 0;">
        ${links.map(link => `<li><a href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label}</a></li>`).join('')}
       </ul>`
    : `<p class="slds-text-body_regular" style="padding-left: 1rem; margin: 0;">Couldn't find the MID. Sorry!</p>`;


  // --- 5. Create the Panel Element ---
  const panel = document.createElement('article');
  panel.id = panelId;
  panel.className = 'slds-card';
  panel.style.marginBottom = 'var(--lwc-spacingSmall, 0.75rem)';
  panel.style.border = '1px solid #dddbda';

  panel.innerHTML = `
    <div class="slds-card__header slds-grid">
      <header class="slds-media slds-media_center slds-has-flexi-truncate">
        <div class="slds-media__figure">
          <span class="slds-icon_container slds-icon-standard-custom" title="Awin Helper">
             <img src="${iconUrl}" style="height: 1.5rem; width: 1.5rem;" alt="Awin Helper Icon" />
             <span class="slds-assistive-text">Awin Helper</span>
          </span>
        </div>
        <div class="slds-media__body">
          <h2 class="slds-card__header-title">
            <span class="slds-text-heading_small">Awin Helper</span>
          </h2>
        </div>
      </header>
    </div>
    <div class="slds-card__body slds-card__body_inner">
      ${listHtml}
    </div>
  `;

  // --- 6. Inject the Panel ---
  try {
    // Ensure panel doesn't already exist from a rapid previous attempt
     if (document.getElementById(panelId)) {
        console.warn('[Awin Helper Inject V4.4] Panel already exists just before injection, skipping.');
        return true; // Consider it successful if it's already there now
     }
    // Final check: ensure container is still a child of parent
    if (!parent.contains(container)) {
        console.warn('[Awin Helper Inject V4.4] Failed: Container detached just before insert.');
        return false;
    }
    parent.insertBefore(panel, container);
    console.log('[Awin Helper Inject V4.4] Panel successfully injected.');
    return true; // SUCCESS!
  } catch (e) {
    // Catch potential error if panel already exists from a race condition
    if (e.name === 'HierarchyRequestError' && document.getElementById(panelId)) {
       console.warn('[Awin Helper Inject V4.4] Caught HierarchyRequestError, panel likely exists. Assuming success.');
       return true;
    }
    console.error('[Awin Helper Inject V4.4] Error during insertBefore:', e);
    // Clean up the panel we tried to insert if it's somehow partially attached
    if (panel.parentElement) panel.remove();
    return false; // FAIL!
  }
}

// Keep the explicit removal function (no changes needed)
export function removeCasePanel() {
    const panelId = 'awin-helper-panel';
    const existingPanel = document.getElementById(panelId);
    if (existingPanel) {
        // console.log('[Awin Helper Inject V4.4] Explicitly removing panel.'); // Can be noisy
        try {
           existingPanel.remove();
           return true;
        } catch(e) {
           console.error("[Awin Helper Inject V4.4] Error removing panel:", e);
           return false;
        }
    }
    return false;
}