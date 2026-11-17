// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

// Capturing text boxes
const MIDBox = document.getElementById("clipMID");
const CRBox = document.getElementById("clipCR");
const NFBox = document.getElementById("clipNF");

// Clear button
const clearBtn = document.getElementById("clearClipBtn");

// recallAndSet Function for use with Chrome Storage API
function recallAndSet(box, key) {
  chrome.storage.local.get(key, function(data) {
    if (data[key]) {
      box.value = data[key];
    }
  });

  box.addEventListener("input", function () {
    clearBtn.textContent = "Saving...";
    chrome.storage.local.set({ [key]: box.value }, function() {
      setTimeout(function() {
        clearBtn.textContent = "Clear";
      }, 500); // 1/2 second delay for better visibility
    });
  });
}

function initClipSaver() {
  if (!MIDBox || !CRBox || !NFBox || !clearBtn) return;

  // Calling rAS function with desired values
  recallAndSet(MIDBox, "awh_MIDSave");
  recallAndSet(CRBox, "awh_CRSave");
  recallAndSet(NFBox, "awh_NFSave");

  clearBtn.addEventListener("click", function () {
    MIDBox.value = "";
    CRBox.value = "";
    NFBox.value = "";

    chrome.storage.local.set({
      awh_MIDSave: "",
      awh_CRSave: "",
      awh_NFSave: ""
    });
  });
}

initClipSaver();
