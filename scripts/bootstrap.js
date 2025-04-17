(() => {
    let lastCaseId = null;
  
    console.log('[Awin Helper] Bootstrapper initialized');
  
    function getCaseIdFromPath() {
      const match = window.location.pathname.match(/\/lightning\/r\/Case\/([^/]+)\/view/);
      return match ? match[1] : null;
    }
  
    async function tryInjectionWithRetries(attempts = 10, delay = 300) // 10 attempts, 300ms delay
    {
      for (let i = 0; i < attempts; i++) {
        const mod = await import(chrome.runtime.getURL('scripts/injected.js'));
        const injected = mod.injectCasePanel;
        const success = await injected();
  
        if (success) return;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
  
      console.warn('[Awin Helper] Max retries reached — panel not injected.');
    }
  
    function monitorPathChanges() {
      new MutationObserver(() => {
        const caseId = getCaseIdFromPath();
        if (caseId && caseId !== lastCaseId) {
          lastCaseId = caseId;
          console.log(`[Awin Helper] Navigated to new case: ${caseId}`);
          tryInjectionWithRetries(); // reset and retry
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  
    monitorPathChanges();
  })();
  