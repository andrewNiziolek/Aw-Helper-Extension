// --- injected.js ---

/**
 * Asynchronously searches the ACTIVE case view for the Awin ID (MID) within the
 * "Program (Signed Product) Details" section, waiting for elements if necessary.
 * @param {number} maxAttempts - Maximum number of attempts to find the MID.
 * @param {number} delayMs - Delay between attempts in milliseconds.
 * @returns {Promise<string|null>} A promise that resolves with the MID string if found, or null otherwise.
 */
export async function findMidOnPage(maxAttempts = 8, delayMs = 350) {
  console.log('[Awin Helper Inject] Starting asynchronous MID search targeting ACTIVE view...');

  // Selector for the container DIV of the *currently active* case view
  const activeCaseViewSelector = 'div.windowViewMode-normal.oneContent.active.lafPageHost'; // Target the specific active container

  const programSignedProductDetailsTitle = 'program (signed product) details';
  const awinIdLabelText = 'awin id';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[Awin Helper Inject] MID Search Attempt ${attempt}/${maxAttempts}...`);

      //Find the ACTIVE case view container
      const activeCaseViewElement = document.querySelector(activeCaseViewSelector);

      if (!activeCaseViewElement) {
          console.warn(`[Awin Helper Inject] Attempt ${attempt}: Active case container ('${activeCaseViewSelector}') not found yet.`);
          // Wait and retry if the active container isn't present
          if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          continue; // Move to the next attempt
      }

      console.log(`[Awin Helper Inject] Attempt ${attempt}: Active case container found. Searching within this container.`);

      //Search for the "Program..." card *within the active container*
      const programCard = findProgramCard(activeCaseViewElement, programSignedProductDetailsTitle); // Pass the active container as the scope

      if (programCard) {
          console.log(`[Awin Helper Inject] Attempt ${attempt}: Found 'Program Details' card within active view.`);
          //Search for the Awin ID label within this specific card
          const labelElement = Array.from(programCard.querySelectorAll('span.test-id__field-label, .slds-form-element__label'))
              .find(label => label.textContent?.trim().toLowerCase() === awinIdLabelText);

          if (labelElement) {
              console.log(`[Awin Helper Inject] Attempt ${attempt}: Found 'Awin ID' label.`);
              const formItem = labelElement.closest('.slds-form-element');
              if (formItem) {
                  //Find the value element
                  const valueElement = formItem.querySelector(
                      'lightning-formatted-text, span.test-id__field-value, .slds-form-element__control output, .slds-form-element__control slot[name="outputField"] lightning-formatted-number, .slds-form-element__control lightning-formatted-number, .slds-form-element__control a lightning-formatted-text'
                  );
                  if (valueElement) {
                      const potentialMid = valueElement.textContent?.trim();
                      if (potentialMid && /^\d+$/.test(potentialMid) && potentialMid !== "0") {
                          console.log(`[Awin Helper Inject] MID Found in active view: ${potentialMid}`);
                          return potentialMid; //Success! Return the MID.
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
           console.log(`[Awin Helper Inject] Attempt ${attempt}: 'Program Details' card not found within the active case view container.`);
      }

      // If MID not found yet in the active view, wait before the next attempt
      if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
      }
  }
  return null; // Failed to find MID after all attempts
}

/*** Searches for the "Program (Signed Product) Details" card within a specific scope element
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
* displaying information based on the provided MID, and styling the inner content
* @param {string|null} mid - The Merchant ID (Awin ID) found, or null if not found.
* @returns {boolean} True if the panel was successfully injected, false otherwise.
*/
export function injectCasePanelOnce(mid) {
  console.log(`[Awin Helper Inject] Attempting to inject panel. Received MID: ${mid}`);
  const iconUrl = chrome.runtime.getURL("assets/icon48.png");
  const panelId = 'awin-helper-panel';
  const customCSSUrl = chrome.runtime.getURL("assets/sfpanel.css"); // Get URL for your CSS

  //Find Anchor Point & Validate Active View (Sections 1 & 2)
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

  //Check if Panel Already Exists
  if (parent.querySelector(`#${panelId}`)) {
      console.log('[Awin Helper Inject] Panel already exists in the target location.');
      return true;
  }

  //Prepare Panel Content HTML
  const links = mid
      ? [
          { label: "Tracking Diagnosis", href: `https://ui.awin.com/diagnostics?advertiserId=${mid}` },
          { label: "Invite User", href: `https://ui.awin.com/invite?advertiserId=${mid}` },
        ]
      : [];
  // Added a wrapper div with class 'awin-helper-content' for styling from CSS
  const listHtml = mid
      ? `<div class="awin-helper-content"><ul>
           ${links.map(link => `<li><a href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label}</a></li>`).join('')}
          </ul></div>`
      : `<div class="awin-helper-content"><p class="error-message">MID couldn't be found.</p></div>`;


  //Create Panel Element
  const panel = document.createElement('article');
  panel.id = panelId;
  panel.className = 'slds-card'; // Keep SLDS class for the outer card
  panel.style.marginBottom = 'var(--lwc-spacingSmall, 0.75rem)';
  panel.style.border = '1px solid #dddbda';
  // Basic structure
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
      <!-- Shadow Root will be attached here by the code below -->
    </div>
  `;

  //Attach Shadow DOM and Inject Content/Styles
  const cardBody = panel.querySelector('.slds-card__body_inner'); // Target the inner body div
  if (cardBody) {
      try {
          // Create the shadow root
          const shadow = cardBody.attachShadow({ mode: 'open' });

          //Create a <link> element for CSS
          const styleLink = document.createElement('link');
          styleLink.rel = 'stylesheet';
          styleLink.href = customCSSUrl; // Use the URL obtained earlier

          // Append the <link> element to the shadow root
          shadow.appendChild(styleLink);

          // Create a temporary div to parse the HTML string
          const contentWrapper = document.createElement('div');
          contentWrapper.innerHTML = listHtml; // Put your content HTML here

          // Append all nodes from the temporary div to the shadow root
          while (contentWrapper.firstChild) {
              shadow.appendChild(contentWrapper.firstChild);
          }
           console.log('[Awin Helper Inject] Shadow DOM created and styles linked.');

      } catch (e) {
          console.error('[Awin Helper Inject] Error attaching shadow DOM or adding content:', e);
          cardBody.innerHTML = "<!-- Failed to initialize custom panel content -->";
          return false; // Fail injection if shadow DOM setup fails
      }
  } else {
      console.error('[Awin Helper Inject] Could not find .slds-card__body_inner to attach shadow DOM.');
      return false; // Cannot proceed if the target element isn't found
  }
  // --- END OF Shadow DOM Section ---


  //Inject Panel into Page
  try {
      // Final check: ensure container/parent still valid before insertion
      if (!parent.contains(container) || !activeCaseViewElement.contains(parent)) {
          console.warn('[Awin Helper Inject] Injection failed: Target container/parent detached or no longer in active view before insertion.');
          return false;
      }
      parent.insertBefore(panel, container);
      console.log('[Awin Helper Inject] Panel successfully injected.');
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

// --- Optional Helpers ---
try {
// This likely won't be useful now with Shadow DOM but doesn't hurt to leave
CSS.registerProperty({
    name: '--case-insensitive-text-matcher',
    syntax: '<string>',
    initialValue: '""',
    inherits: false
  });
} catch(e) {
console.info("[Awin Helper Inject] CSS.registerProperty not supported or failed."); //Can be silenced
}