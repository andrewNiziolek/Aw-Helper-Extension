// --- bootstrap.js ---
(() => {
  // --- Configuration ---
  const OBSERVER_TARGET_SELECTOR = '.oneCenterStage'; // High-level container
  const CHECK_INTERVAL_MS = 400;
  const CHECK_TIMEOUT_MS = 10000;
  const OBSERVER_START_DELAY_MS = 700;

  // --- State Variables ---
  let lastProcessedCaseId = null;
  let targetCaseId = null; // The case ID we are *currently* trying to inject for
  let needsInjectionCheck = false;
  let checkIntervalId = null;
  let checkStartTime = 0;
  let injectionModule = null;
  let observer = null;

  console.log('[Awin Helper] Bootstrapper v4.2 (Prioritize Removal) initializing...');

  function getCaseIdFromPath() {
    const match = window.location.pathname.match(/\/lightning\/r\/Case\/([^/]+)\/view/);
    return match ? match[1] : null;
  }

  async function loadInjectionModule() {
    if (!injectionModule) {
      try {
        injectionModule = await import(chrome.runtime.getURL('scripts/injected.js'));
        console.log('[Awin Helper] Injected script module loaded.');
      } catch (error) {
        console.error('[Awin Helper] Failed to load injected script module:', error);
        injectionModule = null;
      }
    }
    return injectionModule;
  }

  // Helper function to attempt removal
  async function tryRemovePanel(caller = "unknown") {
      // console.log(`[Awin Helper] tryRemovePanel called by: ${caller}`); // Debug log
      const mod = await loadInjectionModule(); // Ensure module is loaded
      if (mod && mod.removeCasePanel) {
          try {
              // console.log('[Awin Helper] Attempting removal via removeCasePanel()');
              mod.removeCasePanel(); // Call the exported function
          } catch(e) {
              console.error('[Awin Helper] Error calling removeCasePanel():', e);
          }
      } else {
          // Fallback if module/function isn't available
          try {
              const existingPanel = document.getElementById('awin-helper-panel');
              if (existingPanel) {
                  console.log('[Awin Helper] Attempting removal via direct getElementById');
                  existingPanel.remove();
              } else {
                // console.log('[Awin Helper] Removal check: No panel found directly.');
              }
          } catch (e) {
             console.error('[Awin Helper] Error removing panel directly:', e);
          }
      }
  }


  // Tries to inject *once*. Called by the interval.
  async function attemptSingleInjection(expectedCaseId) {
    if (getCaseIdFromPath() !== expectedCaseId) {
        // console.log(`[Awin Helper] attemptSingleInjection: Case ID mismatch. Aborting for ${expectedCaseId}.`);
        stopInjectionCheck("stale target");
        return false;
    }

    const mod = await loadInjectionModule();
    if (!mod || !mod.injectCasePanelOnce) {
      console.warn('[Awin Helper] Injection module or injectCasePanelOnce function not available.');
      stopInjectionCheck("module load fail");
      return false;
    }

    try {
        const success = await mod.injectCasePanelOnce(); // Call the function from injected.js
        return success; // Return the boolean result directly
    } catch (error) {
         console.error(`[Awin Helper] Error during injectCasePanelOnce call for ${expectedCaseId}:`, error);
         return false; // Treat errors as failure
    }
  }

  // Clean up the interval check state
  function stopInjectionCheck(reason = "unknown") {
      if (checkIntervalId) {
          // console.log(`[Awin Helper] Stopping injection check interval (Reason: ${reason}).`);
          clearInterval(checkIntervalId);
          checkIntervalId = null;
      }
      needsInjectionCheck = false;
      // Keep targetCaseId until handlePossibleNavigation explicitly clears it or sets a new one
      checkStartTime = 0;
  }

  // Start the process of checking periodically until injection succeeds or times out
  async function startInjectionCheck(caseId) { // Make async to await immediate attempt
      if (checkIntervalId && targetCaseId === caseId) {
           return; // Already checking for this exact case
      }
      if (checkIntervalId) {
          stopInjectionCheck("starting new check"); // Stop previous interval if any
      }

      console.log(`[Awin Helper] Starting injection check sequence for case: ${caseId}`);
      targetCaseId = caseId;
      needsInjectionCheck = true;
      checkStartTime = Date.now();

      // --- Try immediately (AFTER potential removal in handlePossibleNavigation) ---
      try {
          const immediateSuccess = await attemptSingleInjection(targetCaseId);
          if (!needsInjectionCheck) return; // Check if cancelled while awaiting

          if (immediateSuccess) {
                console.log(`[Awin Helper] Immediate injection successful for ${targetCaseId}.`);
                lastProcessedCaseId = targetCaseId; // Mark as done
                targetCaseId = null; // Clear target
                stopInjectionCheck("immediate success");
                return;
          }
      } catch (err) {
          console.error("[Awin Helper] Error during immediate injection attempt:", err);
          stopInjectionCheck("immediate attempt error");
          targetCaseId = null;
          return; // Don't proceed to interval if immediate attempt errored
      }


      // --- Start interval if immediate failed ---
      if (needsInjectionCheck && !checkIntervalId) { // Check flags again
            // console.log(`[Awin Helper] Immediate injection failed for ${targetCaseId}, starting interval check.`);
            checkIntervalId = setInterval(async () => {
                if (!needsInjectionCheck) {
                    stopInjectionCheck("flag turned false in interval");
                    return;
                }

                if (Date.now() - checkStartTime > CHECK_TIMEOUT_MS) {
                    console.warn(`[Awin Helper] Injection check TIMED OUT after ${CHECK_TIMEOUT_MS}ms for case ${targetCaseId}.`);
                    lastProcessedCaseId = targetCaseId; // Mark as processed (timed out)
                    targetCaseId = null;
                    stopInjectionCheck("timeout");
                    return;
                }

                const currentCaseIdNow = getCaseIdFromPath();
                if (currentCaseIdNow !== targetCaseId) {
                    console.log(`[Awin Helper] URL changed during interval (expected ${targetCaseId}, now ${currentCaseIdNow || 'null'}). Stopping check.`);
                    stopInjectionCheck("URL mismatch during check");
                    // Re-evaluate navigation immediately
                    setTimeout(handlePossibleNavigation, 0);
                    return;
                }

                const success = await attemptSingleInjection(targetCaseId);
                if (success) {
                    console.log(`[Awin Helper] Interval injection successful for ${targetCaseId}. Stopping check.`);
                    lastProcessedCaseId = targetCaseId;
                    targetCaseId = null;
                    stopInjectionCheck("interval success");
                }
            }, CHECK_INTERVAL_MS);
      } else if (!needsInjectionCheck) {
           // console.log("[Awin Helper] Check cancelled before interval could start.")
           stopInjectionCheck("cancelled before interval");
      }
  }


  // Main logic triggered by observer
  async function handlePossibleNavigation() { // Make async to allow await for removal
    const currentCaseId = getCaseIdFromPath();
    // console.log(`[Awin Helper] handlePossibleNavigation: Current=${currentCaseId}, LastProc=${lastProcessedCaseId}, Target=${targetCaseId}`);

    // --- Case 1: On a Case Page ---
    if (currentCaseId) {
        if (currentCaseId !== lastProcessedCaseId && currentCaseId !== targetCaseId) {
            // This is a NEW case ID we haven't successfully processed OR are currently targeting
            console.log(`[Awin Helper] Navigation detected to unprocessed case: ${currentCaseId}.`);
            stopInjectionCheck("new navigation detected"); // Stop any previous checks

            // *** PRIORITIZE REMOVAL ***
            console.log(`[Awin Helper] Attempting removal before starting check for ${currentCaseId}...`);
            await tryRemovePanel("new case nav"); // Ensure any old panel is gone

            // Now start the check sequence
            startInjectionCheck(currentCaseId); // This is now async
        }
        // Else: either already processed or currently being checked. Let interval handle it.
    }
    // --- Case 2: Not on a Case Page ---
    else {
        if (lastProcessedCaseId || targetCaseId) { // If we *were* on a case or checking for one
             console.log(`[Awin Helper] Navigation detected AWAY from a case page (Last Proc: ${lastProcessedCaseId}, Target: ${targetCaseId}).`);
             const oldTarget = targetCaseId;
             stopInjectionCheck("navigated away"); // Stop any running checks
             lastProcessedCaseId = null; // Clear the last processed case
             targetCaseId = null; // Clear target

            // Attempt removal
            await tryRemovePanel("nav away");
        }
        // Else: not on a case page and wasn't previously.
    }
  }

  // --- Observer Setup ---
  let debounceTimeout;
  const debouncedHandler = () => {
    handlePossibleNavigation();
  };

  function startObserver() {
    if (observer) {
      observer.disconnect();
    }
    const targetNode = document.querySelector(OBSERVER_TARGET_SELECTOR) || document.body;
    console.log(`[Awin Helper] Starting MutationObserver on:`, targetNode);

    observer = new MutationObserver((mutationsList, obs) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(debouncedHandler, 150); // Debounce
    });

    observer.observe(targetNode, { childList: true, subtree: true });

    // Initial check slightly delayed
    console.log('[Awin Helper] Performing initial check after observer setup.');
    setTimeout(handlePossibleNavigation, 200);
  }

  // Delay observer setup
  console.log('[Awin Helper] Scheduling observer setup...');
  setTimeout(startObserver, OBSERVER_START_DELAY_MS);

})();