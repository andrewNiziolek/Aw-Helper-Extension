/**
 * Asynchronously searches the ACTIVE case view for the Awin ID (MID) within the
 * "Program (Signed Product) Details" section, waiting for elements if necessary.
 * @param {number} maxAttempts - Maximum number of attempts to find the MID.
 * @param {number} delayMs - Delay between attempts in milliseconds.
 * @returns {Promise<string|null>} A promise that resolves with the MID string if found, or null otherwise.
 */
export async function findMidOnPage(maxAttempts = 8, delayMs = 350) {

  // Selector for the container DIV of the *currently active* case view
  const activeCaseViewSelector = 'div.windowViewMode-normal.oneContent.active.lafPageHost';

  const programSignedProductDetailsTitle = 'program (signed product) details';
  const awinIdLabelText = 'awin ui link';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[Awin Helper Inject] MID Search Attempt ${attempt}/${maxAttempts}...`);

      //  Step 1: Find the ACTIVE case view container 
      const activeCaseViewElement = document.querySelector(activeCaseViewSelector);

      if (!activeCaseViewElement) {
          console.warn(`[Awin Helper Inject] Attempt ${attempt}: Active case container ('${activeCaseViewSelector}') not found yet.`);
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
      } else {
      }

      // If MID not found yet in the active view, wait before the next attempt
      if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
      }
  }

  console.log('[Awin Helper Inject] MID Search Failed within active view after all attempts.');
  return null; // Failed to find MID after all attempts
}

/**
* Helper to find the program card using text content matching, within a specific scope.
* @param {Element} scopeElement - The element to search within (e.g., the active case view container).
* @param {string} titleText - The lowercase title text to match.
* @returns {Element|null} The found card element or null.
*/
function findProgramCard(scopeElement, titleText) {
  // Search only within the provided scopeElement
  const relatedRecordCards = Array.from(scopeElement.querySelectorAll('article.slds-card'));
  return relatedRecordCards.find(card => {
      const titleElement = card.querySelector('div[role="heading"] a.slds-card__header-link, div[role="heading"] span.slds-card__header-title, .slds-card__header-link span');
      return titleElement?.textContent?.trim().toLowerCase() === titleText;
  });
}


/**
* Injects a custom UI panel into the page, relative to the "Case Details" section,
* @param {string|null} mid found, or null if not found.
* @returns {boolean} True if the panel was successfully injected, false otherwise.
*/
export function injectCasePanelOnce(mid) {
  console.log(`[Awin Helper Inject] Attempting to inject panel. Received MID: ${mid}`);
  const iconUrl = chrome.runtime.getURL("assets/icon48.png");
  const panelId = 'awin-helper-panel';
  const customCSSUrl = chrome.runtime.getURL("css/sfpanel.css"); 

  //  Find Anchor Point & Validate Active View (Sections 1 & 2) 
  const activeCaseViewSelector = 'div.windowViewMode-normal.oneContent.active.lafPageHost';
  const activeCaseViewElement = document.querySelector(activeCaseViewSelector);
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
  if (parent.querySelector(`#${panelId}`)) {
      console.log('[Awin Helper Inject] Panel already exists in the target location.');
      return true;
  }

  //  Prepare Panel Content HTML (Section 4) 
  const links = mid
      ? [
          { label: "Tracking Settings", href: `https://ui.awin.com/tracking-settings/us/awin/advertiser/${mid}/main-settings` },
          { label: "Commission Groups", href: `https://ui.awin.com/commission-manager/us/awin/merchant/${mid}/commission-groups` },
          { label: "Tracking Diagnosis", href: `https://ui.awin.com/advertiser-integration-tool/trackingwizard/us/awin/merchant/${mid}` },
          { label: "Delete Tests", href: `https://ui.awin.com/provider/test-transactions` }
        ]
      : [];
  const listHtml = mid
      ? `<div class="awin-helper-content"><ul>
           ${links.map(link => `<li><a href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label}</a></li>`).join('')}
          </ul></div>`
      : `<div class="awin-helper-content"><p class="error-message">The Signed Product may not contain the MID yet.</p></div>`;

  // Prepare the MID display HTML block for the header
  const midSubheadingHtml = mid
  ? `<div class="awin-helper-mid-display slds-text-body_small slds-text-color_weak">MID: ${mid}</div>`
  : `<div class="awin-helper-mid-display slds-text-body_small slds-text-color_weak" style="display: none;"></div>`; // Create the div even if no MID, but hide it

  //  Create Panel Element (Section 5) 
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
            ${midSubheadingHtml} <!-- Inject the MID display HTML block here -->
          </div>
        </header>
      </div>
      <div class="slds-card__body slds-card__body_inner">
        <!-- Shadow Root will be attached here -->
      </div>
    `;

  //  Attach Shadow DOM and Inject Content/Styles (Section 5b) 
  const cardBody = panel.querySelector('.slds-card__body_inner');
  if (cardBody) {
      try {
          const shadow = cardBody.attachShadow({ mode: 'open' });
          const styleLink = document.createElement('link');
          styleLink.rel = 'stylesheet';
          styleLink.href = customCSSUrl;
          shadow.appendChild(styleLink);

          const contentWrapper = document.createElement('div');
          contentWrapper.innerHTML = listHtml;
          while (contentWrapper.firstChild) {
              shadow.appendChild(contentWrapper.firstChild);
          }
      } catch (e) {
           cardBody.innerHTML = "<!-- Failed to initialize custom panel content -->";
           return false;
       }
  } else {
       console.error('[Awin Helper Inject] Could not find .slds-card__body_inner to attach shadow DOM.');
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
      return true;
  } catch (e) {
      console.error('[Awin Helper Inject] Error during panel insertion:', e);
      return false;
  }
}

/**
* Removes the custom UI panel from the page if it exists.
* @returns {boolean} True if the panel was found and removed, false otherwise.
*/
export function removeCasePanel() {
const panelId = 'awin-helper-panel';
const existingPanel = document.getElementById(panelId);
if (existingPanel) {
    try {
        existingPanel.remove();
        console.log('[Awin Helper Inject] Panel successfully removed.');
        return true;
    } catch (e) {
        console.error('[Awin Helper Inject] Error removing panel:', e);
        return false;
    }
}
return false; // Panel not found
}

try {
CSS.registerProperty({
    name: '--case-insensitive-text-matcher',
    syntax: '<string>',
    initialValue: '""',
    inherits: false
  });
} catch(e) {

}