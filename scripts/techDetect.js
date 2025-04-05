chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
  const url = tabs[0].url;

  // Checks to see if the URL is a chrome browser page or awin.com URL and cancels if so.
  if (url.includes("chrome://") || url.includes("edge://") ||url.includes("awin.com") || url.includes("google.com") || url.includes("microsoftedge") || url.includes("force.com") || url.includes("edge://")) {
  } else {
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id}, // Targets active tab
      function: () => {
        // Checks for "gtm.js" in page <script> tags.
        const checkGTM = () => {
          const scripts = document.getElementsByTagName("script");
          gtmID = "";
          for (let i = 0; i < scripts.length; i++) {
            if (scripts[i].src.includes("gtm.js")) {
              // Extract the GTM ID and remove any "=" character
              const gtmIDWithEqual = scripts[i].src.slice(-11);
              gtmID = gtmIDWithEqual.replace("=", "");
              return true;
            }
          }
          return false;
        };

        const checkGTSS = () => {
          const scripts = document.getElementsByTagName("script");
        
          for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src;
            if (src.includes("googletagmanager.com")) {
              const urlParams = new URLSearchParams(src.split('?')[1]);
              if (urlParams.has('id')) {
                return true;
              }
            }
          }
          return false;
        };

        const waitForShopify = (timeout = 5) => {
          return new Promise(resolve => {
            const start = Date.now();
        
            const extractShopFromInlineScripts = () => {
              const scripts = document.getElementsByTagName("script");
              const regex = /Shopify\.shop\s*=\s*["']([^"']+)["']/;
        
              for (let i = 0; i < scripts.length; i++) {
                const content = scripts[i].innerText || scripts[i].textContent;
                const match = content && content.match(regex);
                if (match) {
                  return match[1];
                }
              }
              return "";
            };
        
            const check = () => {
              const shop = extractShopFromInlineScripts();
              if (shop) {
                resolve(shop);
              } else if (Date.now() - start < timeout) {
                requestAnimationFrame(check);
              } else {
                resolve(""); // timeout fallback
              }
            };
        
            check();
          });
        };               

        const checkWooComm = () => {
          const scripts = document.getElementsByTagName("script");
          for (let i = 0; i < scripts.length; i++) {
            if(scripts[i].src.includes("woocommerce")) {
              return true;
            }
          }
          return false;
        };

        const checkAdobeLaunch = () => {
          const scripts = document.getElementsByTagName("script");
          for (let i = 0; i < scripts.length; i++) {
            if (scripts[i].src.includes("adobedtm")) {
              return true;
            }
          }
          return false;
        };

        // If checkGTM function returns true, fire runtime message to pull status out of current tab.
        if (checkGTM()) {
          chrome.runtime.sendMessage({status: gtmID});
        }

        if (checkGTSS()) {
          chrome.runtime.sendMessage({status: "GTSS Found"});
        }

        let detected = false;
        const scripts = document.getElementsByTagName("script");
        for (let i = 0; i < scripts.length; i++) {
          if (scripts[i].src.includes("myshopify.com")) {
            detected = true;
            break;
          }
        }

        waitForShopify().then((shopDomain) => {
          console.log("Resolved Shopify.shop:", shopDomain);
          if (detected || shopDomain) {
            chrome.runtime.sendMessage({
              status: "Shopify Detected",
              shopifyDomain: shopDomain || ""
            });
          }
        });



        if (checkWooComm()) {
          chrome.runtime.sendMessage({status: "WooCommerce Detected"});
        }

        if (checkAdobeLaunch()) {
          chrome.runtime.sendMessage({status: "Adobe Launch Found"});
        }        

      }
    });
  }
});

const modeCheck = document.getElementById("modeSwitch");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (!modeCheck.checked && request.status && (request.status.includes("GTM") || request.status.includes("WooCommerce Detected") || request.status.includes("Shopify Detected"))) {
      const compatText = document.getElementById("compatData");
      const easeMSG = document.getElementById("ratingBox");

      if (compatText && easeMSG) {
        compatText.textContent = "Site is compatible!";
        compatText.style.fontWeight = "bold";
        compatText.style.color = "#18a45b";
        easeMSG.style.display = 'flex';
      }
    }
  } catch (error) {
    console.error('Error in onMessage listener:', error);
  }
});

// Listens for "GTM Detected" and adjusts popup HTML based on response.
// These sections to remain modular for changes in their display type.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.status && request.status.includes("GTM")) {
      const gtmPanel = document.getElementById("gtmDisplay");
      const gtmStatus = document.getElementById("gtmText");

      if (gtmPanel && gtmStatus) {
        gtmPanel.style.display = 'grid';
        gtmStatus.textContent = request.status;
      } else {
        if (gtmPanel) {
          gtmPanel.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Error in onMessage listener:', error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.status && request.status.startsWith("GTSS")) {
      const gtssPanel = document.getElementById("gtSSDisplay");
      const gtSStatus = document.getElementById("gtSSText");

      if (gtssPanel && gtSStatus) {
        gtssPanel.style.display = 'grid';
        gtSStatus.textContent = "GTM Server-Side";
      } else {
        if (gtssPanel) {
          gtssPanel.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Error in onMessage listener:', error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.status === "Shopify Detected") {
    const shopifyPanel = document.getElementById("shopifyDisplay");
    const shopifyChip = document.getElementById("shopifyChip");
    const myShopifyPanel = document.getElementById("myShopifyInfo");
    const myshopifyText = document.getElementById("myShopifyText");
  
    if (shopifyPanel) {
      shopifyPanel.style.display = 'grid';
      myShopifyPanel.style.display = 'grid';
  
      if (request.shopifyDomain && myshopifyText) {
        myshopifyText.textContent = request.shopifyDomain;
      }
    }
  }
  
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.status === "Adobe Launch Found") {
      const adobeLaunchPanel = document.getElementById("launchDisplay");
      const adobeLaunchStatus = document.getElementById("launchText");
      if (adobeLaunchPanel) {
        adobeLaunchPanel.style.display = 'grid';
        adobeLaunchStatus.textContent = "Adobe Launch";
      }
    }
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.status === "WooCommerce Detected") {
    const wooPanel = document.getElementById("wooCommDisplay");
    const wooStatus = document.getElementById("wooCommStatus");
    if (wooStatus) {
      wooPanel.style.display = 'grid';
      wooStatus.textContent = "WooCommerce";
    }
    else {
      wooPanel.style.display = 'none';
    }
  }
});