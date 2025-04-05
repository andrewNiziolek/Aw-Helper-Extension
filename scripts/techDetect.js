chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
  const url = tabs[0].url;

  const blocklist = [
    "chrome://", "edge://", "awin.com", "google.com",
    "microsoftedge", "force.com"
  ];

  if (blocklist.some(domain => url.includes(domain))) return;

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

      const waitForShopify = (timeout = 5) => {
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

      checkGTM();
      checkGTSS();

      let detected = checkPresence("myshopify.com");
      waitForShopify().then(shopDomain => {
        if (detected || shopDomain) {
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

const modeCheck = document.getElementById("modeSwitch");

chrome.runtime.onMessage.addListener((request) => {
  try {
    const { status, shopifyDomain } = request;

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

    if (!modeCheck.checked && status && /(GTM|WooCommerce|Shopify)/.test(status)) {
      const compatText = document.getElementById("compatData");
      const easeMSG = document.getElementById("ratingBox");
      if (compatText && easeMSG) {
        compatText.textContent = "Site is compatible!";
        compatText.style.fontWeight = "bold";
        compatText.style.color = "#18a45b";
        easeMSG.style.display = 'flex';
      }
    }

    if (status.includes("GTM")) {
      show("gtmDisplay", { id: "gtmText", value: status });
    }

    if (status.startsWith("GTSS")) {
      show("gtSSDisplay", { id: "gtSSText", value: "GTM Server-Side" });
    }

    if (status === "Shopify Detected") {
      show("shopifyDisplay");
      show("myShopifyInfo", { id: "myShopifyText", value: shopifyDomain });
    }

    if (status === "Adobe Launch Found") {
      show("launchDisplay", { id: "launchText", value: "Adobe Launch" });
    }

    if (status === "WooCommerce Detected") {
      show("wooCommDisplay", { id: "wooCommStatus", value: "WooCommerce" });
    }

  } catch (error) {
    console.log("Error in onMessage listener:", error);
  }
});
