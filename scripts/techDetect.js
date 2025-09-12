chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
  const url = tabs[0].url;

  const blocklist = [
    "chrome://", "edge://", "awin.com", "google.com",
    "microsoftedge", "force.com"
  ];

  const compatText = document.getElementById("compatData");
  const siteURLText = document.getElementById("siteURLText");

  if (blocklist.some(domain => url.includes(domain))) {
    if (compatText) {
      compatText.textContent = "Restricted URL";
      compatText.style.fontStyle = "italic";
    }
    if (siteURLText) siteURLText.textContent = "Restricted URL";
    return;
  }

  // Set domain text
  const getDomain = (url) => {
    let domain = url.split('//')[1] || url;
    return domain.split('/')[0];
  };
  if (siteURLText) siteURLText.textContent = getDomain(url);

  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    function: () => {
      const getScripts = () => Array.from(document.getElementsByTagName("script"));

      const checkGTM = () => {
        for (const script of getScripts()) {
          if (script.src.includes("gtm.js")) {
            const gtmID = script.src.slice(-11).replace("=", "");
            chrome.runtime.sendMessage({ status: gtmID });
            return;
          }
        }
      };

      const checkGTSS = () => {
        for (const script of getScripts()) {
          const src = script.src;
          if (src.includes("googletagmanager.com")) {
            const params = new URLSearchParams(src.split('?')[1]);
            if (params.has('id')) {
              chrome.runtime.sendMessage({ status: "GTSS Found" });
              return;
            }
          }
        }
      };

      const waitForShopify = (timeout = 50) => {
        return new Promise(resolve => {
          const start = Date.now();
          const regex = /Shopify\.shop\s*=\s*["']([^"']+)["']/;

          const check = () => {
            for (const script of getScripts()) {
              const match = (script.innerText || script.textContent).match(regex);
              if (match) return resolve(match[1]);
            }
            if (Date.now() - start < timeout) requestAnimationFrame(check);
            else resolve("");
          };

          check();
        });
      };

      const checkPresence = (keyword) => getScripts().some(script => script.src.includes(keyword));

      const checkDWIN = () => {
        const scripts = getScripts();
        const masterTags = [];
        const regex = /([^/]*).js(\?.*)?$/gm;
        for (const script of scripts) {
          if (script.src.includes("dwin1.com")) {
            const match = regex.exec(script.src);
            regex.lastIndex = 0;
            if (match) masterTags.push(match[1]);
          }
        }
        if (masterTags.length > 0) {
          chrome.runtime.sendMessage({ masterTags });
        }
      };

      // Run detections
      checkGTM();
      checkGTSS();
      checkDWIN();

      const isShopify = checkPresence("myshopify.com");
      waitForShopify().then(shopDomain => {
        if (isShopify || shopDomain) {
          chrome.runtime.sendMessage({
            status: "Shopify Detected",
            shopifyDomain: shopDomain || ""
          });
        }
      });

      if (checkPresence("woocommerce")) {
        chrome.runtime.sendMessage({ status: "WooCommerce Detected" });
      }

      if (checkPresence("adobedtm")) {
        chrome.runtime.sendMessage({ status: "Adobe Launch Found" });
      }
    }
  });
});

// --- Shopify "click-to-copy" helper  ---
function shInitShopifyCopy() {
  const textEl = document.getElementById('myShopifyText');
  const infoEl = document.getElementById('myShopifyInfo');
  if (!textEl || !infoEl) return;

  const COPY_SVG = `
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
    </svg>`;
  const CHECK_SVG = `
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
    </svg>`;

  // inject icon once
  if (!document.getElementById('copyMyShopifyIcon')) {
    const span = document.createElement('span');
    span.id = 'copyMyShopifyIcon';
    span.innerHTML = COPY_SVG;
    textEl.appendChild(span);
  }

  if (textEl.__shBound) return;
  textEl.__shBound = true;

  textEl.addEventListener('click', async () => {
    const value = (textEl.textContent || '').trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }

    // flash bg + swap icon to check, then restore
    const icon = document.getElementById('copyMyShopifyIcon');
    const prevMarkup = icon?.innerHTML;
    if (icon) icon.innerHTML = CHECK_SVG;

    infoEl.classList.add('copyFlash');
    clearTimeout(infoEl.__flashTimer);
    infoEl.__flashTimer = setTimeout(() => {
      if (icon && prevMarkup) icon.innerHTML = prevMarkup; // back to clipboard
      infoEl.classList.remove('copyFlash');
    }, 900);
  });
}

// Unified runtime listener
const modeCheck = document.getElementById("modeSwitch");

chrome.runtime.onMessage.addListener((request) => {
  try {
    const { status, shopifyDomain, masterTags } = request;

    const show = (id, text = null) => {
      const panel = document.getElementById(id);
      if (panel) {
        panel.style.display = 'grid';
        if (text) {
          const textEl = document.getElementById(text.id);
          if (textEl) textEl.textContent = text.value;
        }
      }
    };

    if (!modeCheck?.checked && status && /(GTM|WooCommerce|Shopify)/.test(status)) {
      const compatText = document.getElementById("compatData");
      const easeMSG = document.getElementById("ratingBox");
      if (compatText && easeMSG) {
        compatText.textContent = "Site is compatible!";
        compatText.style.fontWeight = "bold";
        compatText.style.color = "#18a45b";
        easeMSG.style.display = 'flex';
      }
    }

    if (status?.includes("GTM")) {
      show("gtmDisplay", { id: "gtmText", value: status });
    }

    if (status?.startsWith("GTSS")) {
      show("gtSSDisplay", { id: "gtSSText", value: "GTM Server-Side" });
    }

    if (status === "Shopify Detected") {
      show("shopifyDisplay");
      show("myShopifyInfo", { id: "myShopifyText", value: shopifyDomain });
      shInitShopifyCopy(); 
    }

    if (status === "Adobe Launch Found") {
      show("launchDisplay", { id: "launchText", value: "Adobe Launch" });
    }

    if (status === "WooCommerce Detected") {
      show("wooCommDisplay", { id: "wooCommStatus", value: "WooCommerce" });
    }

    if (masterTags?.length > 0) {
      const [firstTag, ...rest] = masterTags;
      const message = rest.length ? `${firstTag} +${rest.length}` : firstTag;
      const tooltipText = rest.join(", ");
      const dwin1Status = document.getElementById("awcChip");
      const awinPanel = document.getElementById("awcDisplay");
      // fp: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      if (dwin1Status && awinPanel) {
        dwin1Status.textContent = message;
        awinPanel.style.display = "grid";
        if (tooltipText) {
          dwin1Status.setAttribute("data-tooltip", tooltipText);
          dwin1Status.classList.add("tooltip");
        }
      }
    }

  } catch (error) {
    console.error("Error in unified runtime listener:", error);
  }
});

window.__awin_helper_meta = {
  by: 'Andrew Niziolek',
  license: 'AGPL-3.0',
  fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
};