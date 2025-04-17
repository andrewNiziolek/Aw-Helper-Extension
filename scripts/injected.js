export async function injectCasePanel() {
    const iconUrl = chrome.runtime.getURL("assets/icon48.png");
  
    const headings = Array.from(document.querySelectorAll('.slds-card__header-title'));
    const caseDetailsHeader = headings.find(el =>
      el.textContent?.trim().toLowerCase() === 'case details'
    );
  
    if (!caseDetailsHeader) {
      console.log('[Awin Helper] Case Details not yet ready. Waiting...');
      return false;
    }
  
    const container = caseDetailsHeader.closest('.slds-card');
    const parent = container?.parentElement;
    if (!container || !parent || !document.body.contains(parent)) {
      console.warn('[Awin Helper] Container or parent not visible. Aborting injection.');
      return false;
    }
  
    // Remove existing panel if present in this container
    const existingPanel = parent.querySelector('#awin-helper-panel');
    if (existingPanel) {
      existingPanel.remove();
      console.log('[Awin Helper] Removed existing panel before reinjection.');
    }
  
    // MID detection
    let mid = null;
    document.querySelectorAll('lightning-formatted-text').forEach(el => {
      const textContent = el.textContent.trim();
      if (/^\d+$/.test(textContent) && !mid) mid = textContent;
    });
  
    const links = mid
      ? [
          { label: "Tracking Diagnosis", href: `https://ui.awin.com/diagnostics?advertiserId=${mid}` },
          { label: "Invite User", href: `https://ui.awin.com/invite?advertiserId=${mid}` },
          { label: "Placeholder Link 1", href: "#" },
          { label: "Placeholder Link 2", href: "#" },
        ]
      : [];
  
    const listHtml = mid
      ? `<ul class="slds-list_dotted slds-list_vertical slds-text-body_regular" style="padding-left: 1rem;">
          ${links.map(link => `<li><a href="${link.href}" target="_blank">${link.label}</a></li>`).join('')}
         </ul>`
      : `<p style="margin-left: 1rem;">No MID found. Sorry!</p>`;
  
    const panel = document.createElement('article');
    panel.id = 'awin-helper-panel';
    panel.className = 'slds-card';
    panel.style.border = '1px solid #ddd';
    panel.style.marginBottom = '1rem';
  
    panel.innerHTML = `
      <div class="slds-card__header slds-grid">
        <div class="slds-media slds-media_center slds-has-flexi-truncate">
          <div class="slds-media__figure">
            <span class="slds-icon_container" title="Helper">
              <img src="${iconUrl}" style="height: 16px; width: 16px;" />
            </span>
          </div>
          <div class="slds-media__body">
            <h2 class="slds-card__header-title">Awin Helper</h2>
          </div>
        </div>
      </div>
      <div class="slds-card__body slds-card__body_inner">
        ${listHtml}
      </div>
    `;
  
    try {
      parent.insertBefore(panel, container);
      console.log('[Awin Helper] Panel injected into:', parent);
      return true;
    } catch (e) {
      console.error('[Awin Helper] Failed to inject panel:', e);
      return false;
    }
  }  