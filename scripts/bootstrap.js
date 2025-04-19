// --- bootstrap.js ---
(() => {
  // --- Configuration ---
  const OBSERVER_TARGET_SELECTOR = '.oneCenterStage'; // Monitor the main content area where case details load
  const OBSERVER_START_DELAY_MS = 1000; // Slightly longer delay to allow initial Salesforce load
  const HANDLE_DELAY_MS = 400; // Debounce/delay for handling mutations (adjust based on how quickly SF updates)

  // --- State ---
  let currentInjectedCaseId = null; // Track the case ID for which the panel is currently injected
  let injectionModule = null;
  let observer = null;
  let handleTimeout = null;
  let isHandling = false; // Flag to prevent concurrent executions of handleStateChange

  console.log('[Awin Helper] Bootstrapper v5.1 (Async MID Fetch) initializing...');

  // --- Utilities ---
  function getCaseIdFromPath() {
    const match = window.location.pathname.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})\/view/); // More specific ID match
    return match ? match[1] : null;
  }

  async function loadInjectionModule() {
    if (!injectionModule) {
      try {
        // Use dynamic import to load the module
        injectionModule = await import(chrome.runtime.getURL('scripts/injected.js'));
        // Check if necessary functions exist
        if (!injectionModule.findMidOnPage || !injectionModule.injectCasePanelOnce || !injectionModule.removeCasePanel) {
             console.error('[Awin Helper] Critical Error: Required functions (findMidOnPage, injectCasePanelOnce, removeCasePanel) not found in injected.js module.');
             injectionModule = null; // Invalidate module
             return null;
        }
      } catch (error) {
        console.error('[Awin Helper] Failed to load injected script module:', error);
        injectionModule = null; // Reset on failure
      }
    }
    return injectionModule;
  }

  //Core Logic (Handler for Observer/Initial Check)
  async function handleStateChange() {
    // Prevent multiple simultaneous runs caused by rapid mutations
    if (isHandling) {
        console.log('[Awin Helper] State change handling already in progress. Skipping.');
        return;
    }
    isHandling = true;

    const mod = await loadInjectionModule();
    if (!mod) {
      console.warn('[Awin Helper] Injection module not available. Aborting state check.');
      isHandling = false;
      return;
    }

    const caseIdOnPage = getCaseIdFromPath();

    try {
      //Scenario 1: We are on a Case Page
      if (caseIdOnPage) {
        // If the panel isn't injected OR it's injected for the wrong case
        if (currentInjectedCaseId !== caseIdOnPage) {
          console.log(`[Awin Helper] State change detected: Need panel for Case ${caseIdOnPage}.`);

          // Remove any existing panel first (important when switching cases)
          if (currentInjectedCaseId !== null) {
            console.log(`[Awin Helper] Removing panel for previous case: ${currentInjectedCaseId}`);
            await mod.removeCasePanel(); // Use await if removeCasePanel is async (it's not here, but good practice)
          }
          currentInjectedCaseId = null; // Panel is conceptually gone, even if removal fails momentarily

          //Find MID
          const mid = await mod.findMidOnPage(); // This now handles the waiting

          //Inject panel with found MID
          if (getCaseIdFromPath() !== caseIdOnPage) {
             console.warn(`[Awin Helper] User navigated away from Case ${caseIdOnPage} during MID search. Aborting injection.`);
             isHandling = false;
             return; // Avoid injecting if the context changed *during* the async MID search
          }

          console.log(`[Awin Helper] Attempting injection for case: ${caseIdOnPage} with MID: ${mid}`);
          const success = mod.injectCasePanelOnce(mid); // Pass the found MID (or null)

          if (success) {
            console.log(`[Awin Helper] Injection successful for case: ${caseIdOnPage}`);
            currentInjectedCaseId = caseIdOnPage; // Update state *only on successful injection*
          } else {
            console.warn(`[Awin Helper] Injection attempt failed for case: ${caseIdOnPage}. Panel anchor might not be ready yet. Will retry on next relevant mutation.`);
            currentInjectedCaseId = null; // Ensure we retry injection next time if it failed
          }
        } else {
        }
      }
      //Scenario 2: We are NOT on a Case Page
      else {
        // If a panel *is* currently injected, remove it
        if (currentInjectedCaseId !== null) {
          console.log(`[Awin Helper] State change: Navigated away from case ${currentInjectedCaseId}. Removing panel.`);
          await mod.removeCasePanel();
          currentInjectedCaseId = null; // Update state
        } else {
          // console.log('[Awin Helper] State check: Not on a case page, no panel injected.');
        }
      }
    } catch (error) {
       console.error('[Awin Helper] Error during handleStateChange:', error);
       // Cautious reset? Maybe try removing panel just in case.
       try { await mod?.removeCasePanel(); } catch (_) {}
       currentInjectedCaseId = null;
    } finally {
        isHandling = false; // Allow next handling run
    }
  }

  // --- Observer Setup ---
  function startObserver() {
    if (observer) {
        console.log('[Awin Helper] Disconnecting previous MutationObserver.');
        observer.disconnect();
    }

    const targetNode = document.querySelector(OBSERVER_TARGET_SELECTOR);
    if (!targetNode) {
        console.warn(`[Awin Helper] Observer target ('${OBSERVER_TARGET_SELECTOR}') not found. Using document.body. This might be inefficient.`);
        // Fallback to body, but ideally the target selector should work
        // Consider retrying finding the target node after a delay if needed.
    }
    const nodeToObserve = targetNode || document.body;

    observer = new MutationObserver((mutationsList, obs) => {
      // Debounce the handler: Wait for mutations to "settle" before acting.
      clearTimeout(handleTimeout);
      handleTimeout = setTimeout(handleStateChange, HANDLE_DELAY_MS);
    });

    observer.observe(nodeToObserve, {
      childList: true, // Detect additions/removals of nodes
      subtree: true    // Observe descendants as well (crucial for SPAs)
    });

    // Perform an initial check shortly after the observer starts.
    setTimeout(handleStateChange, HANDLE_DELAY_MS + 200);
  }

  // Initialization
  // Delay observer setup slightly to allow initial page elements to settle
  setTimeout(startObserver, OBSERVER_START_DELAY_MS);

})();