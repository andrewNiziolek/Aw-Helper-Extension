// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
  if (!tabs?.[0]) return;
  const url = tabs[0].url || "";

  // Checks to see if the URL is a chrome browser page or awin.com URL and cancels if so.
  if (url.includes("chrome://") || url.includes("edge://") ||url.includes("awin.com") || url.includes("google.com") || url.includes("microsoftedge") || url.includes("force.com") || url.includes("edge://")) {
    const restrictedStatus = document.getElementById("restrictedStatus");
    if (restrictedStatus) restrictedStatus.textContent = "Restricted URL";
  } else {
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id}, // Targets active tab
      function: () => {
        // Checks for "gtm.js" in page <script> tags.
        const checkJS = () => {
          const scripts = document.getElementsByTagName("script");
          for (let i = 0; i < scripts.length; i++) {
            if (scripts[i].src.includes("awin1.com/sread.js")) {
              return true;
            }
          }
          return false;
        };

        const checkNS = () => {
          const images = document.getElementsByTagName("img");
          for (let i = 0; i < images.length; i++) {
            if (images[i].src.includes("awin1.com/sread.img")) {
              return true;
            }
          }
          return false;
        };

        const checkConversion = () => {
          const scripts = document.getElementsByTagName("script");
          for (let i = 0; i < scripts.length; i++) {
            if (scripts[i].innerHTML.includes("AWIN.Tracking.Sale")) {
              return true;
            }
          }
          return false;
        };
  
        // If checkGTM function returns true, fire runtime message to pull status out of current tab.
        if (checkJS()) {
          chrome.runtime.sendMessage({status: "JS Detected"});
        }

        if (checkNS()) {
          chrome.runtime.sendMessage({status: "NS Detected"});
        }

        if (checkConversion()) {
          chrome.runtime.sendMessage({status: data});
        }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.status === "JS Detected") {
    const conversionJS = document.getElementById("conversionJS");
    if (conversionJS) {
      conversionJS.textContent = request.status;
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.status === "NS Detected") {
    const conversionNS = document.getElementById("conversionNS");
    if (conversionNS) {
      conversionNS.textContent = request.status;
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.status.includes("AWIN.Tracking.Sale")) {
    const data = request.status

    amountReg = data.match(/Sale.amount\s*=\s*'([^']*)'/)[1]; 
    channelReg = data.match(/Sale.channel\s*=\s*'([^']*)'/)[1]; 
    currencyReg = data.match(/Sale.currency\s*=\s*'([^']*)'/)[1]; 
    orderRefReg = data.match(/Sale.orderRef\s*=\s*'([^']*)'/)[1]; 
    partsReg = data.match(/Sale.parts\s*=\s*'([^']*)'/)[1]; 
    testReg = data.match(/Sale.test\s*=\s*(\d+)/)[1];

    const amount = document.getElementById("amount");
    if (amount) {
      amount.textContent = "Amount: " + amountReg;
    }

    const channel = document.getElementById("channel");
    if (channel) {
      channel.textContent = "Channel: " + channelReg;
    }

    const currency = document.getElementById("currency");
    if (currency) {
      currency.textContent = "Currency: " + currencyReg;
    }

    const orderRef = document.getElementById("orderRef");
    if (orderRef) {
      orderRef.textContent = "Ref: " + orderRefReg;
    }

    const parts = document.getElementById("parts");
    if (parts) {
      parts.textContent = "Parts: " + partsReg;
    }

    const test = document.getElementById("test");
    if (test) {
      test.textContent = "Test Mode: " + testReg;
    }

    // const custom = document.getElementById("custom");
    // if (custom) {
    //   custom.textContent = data[6];
    // }
  }
});