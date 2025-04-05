// Attribution Link Function
const attriBtn = document.getElementById("attribText");

//Open link tab
function openGitURL(URL) {
  URL.forEach((url) => {
      chrome.tabs.create({ url });
  });
};

attriBtn.addEventListener("click", function(){
  const URL = [`https://github.com/ajaxburger/Aw-Helper-Extension/wiki/Extension-Attributions`];

  openGitURL(URL);
});

// Personal Attribution Link
const perSiteBtn = document.getElementById("personalAttrib");
function openPersonalAttribURL(URL) {
  URL.forEach((url) => {
        chrome.tabs.create({ url });
    });
};

perSiteBtn.addEventListener("click", function() {
    const URL = [`https://www.andrewniziolek.com/?utm_source=awhelper&utm_medium=extension&utm_campaign=personal_attribution`];

    openPersonalAttribURL(URL);
});

// DO NOT CHANGE the way that this system works. I've attempted to nest these
// functions and have not been able to get it functioning.
chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
  const url = tabs[0].url;

  // Checks to see if the URL is a chrome browser page or awin.com URL and cancels if so.
  if (url.includes("chrome://") || url.includes("awin.com") || url.includes("google.com") || url.includes("microsoftedge")) {
    const restrictedStatus = document.getElementById("siteURLText");
    const compatText = document.getElementById("compatData");
    compatText.textContent = "Restricted URL";
    compatText.style.fontStyle = "Italic";
    restrictedStatus.textContent = "Restricted URL";
  } else {
      function getDomain(url) {
          let domain = url.split('//')[1] || url;
          domain = domain.split('/')[0];
          return domain;
      }
        
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          let url = tabs[0].url;
          let domain = getDomain(url);
          document.getElementById('siteURLText').textContent = domain;
      });

      chrome.scripting.executeScript({
          target: {tabId: tabs[0].id}, // Targets active tab
          function: () => {
              const checkDWIN = () => {
                  const scripts = document.getElementsByTagName("script");
                  const masterTags = [];
                  const regex = /([^/]*).js(\?.*)?$/gm; // Updated regex to handle query parameters
                  for (let i = 0; i < scripts.length; i++) {
                      if (scripts[i].src.includes("dwin1.com")) {
                          const match = regex.exec(scripts[i].src);
                          regex.lastIndex = 0; // Reset regex index to ensure correct processing in loops
                          if (match) {
                              masterTags.push(match[1]); // Using the first group from regex, excluding ".js"
                          }
                      }
                  }
                  return masterTags;
              };

              const masterTags = checkDWIN();
              chrome.runtime.sendMessage({masterTags: masterTags});
          }
      }, () => {
          if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError.message);
          }
      });
  }
});

// Listens for messages and adjusts popup HTML based on response.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.masterTags) {
      const masterTags = request.masterTags;
      if (masterTags.length > 0) {
          const firstTag = masterTags[0];
          const additionalCount = masterTags.length - 1; // Count of additional tags
          let message = firstTag; // Directly using the number without ".js"
          let tooltipText = '';

          if (additionalCount > 0) {
              message += " +" + additionalCount;
              tooltipText = masterTags.slice(1).join(', ');
          }

          const dwin1Status = document.getElementById("awcChip");
          const awinPanel = document.getElementById("awcDisplay")
          if (dwin1Status) {
              dwin1Status.textContent = message;
              awinPanel.style.display = 'grid';
              if (tooltipText) {
                  dwin1Status.setAttribute('data-tooltip', tooltipText);
                  dwin1Status.classList.add('tooltip');
              }
          }
      }
  }
});