// Copyright (c) 2023-2026 Andrew Niziolek
// SPDX-License-Identifier: AGPL-3.0-or-later

document.addEventListener("DOMContentLoaded", function() {
  const modeSwitch = document.getElementById("modeSwitch");
  if (!modeSwitch) return;

  const newImplView = document.getElementById("newImplView");
  const intReviewView = document.getElementById("intReviewView");
  const testURLView = document.getElementById("testURLView");
  const clipboardView = document.getElementById("clipboard");
  const compatibleView = document.getElementById("compatibleBox");
  const ratingDiv = document.getElementById("ratingBox");

  const setDisplay = (el, value) => { if (el) el.style.display = value; };

  // Function to update the visibility of page elements.

  function updateButtonVisibility() {
    if (modeSwitch.checked) {
      // If tech mode enabled, display (block/flex) or hide (none) these elements.
      // fp: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      setDisplay(newImplView, "block");
      setDisplay(intReviewView, "block");
      setDisplay(testURLView, "block");
      setDisplay(clipboardView, "block");
      setDisplay(compatibleView, "none");
      setDisplay(ratingDiv, "none");
    } else { // If simple mode enabled...
      setDisplay(newImplView, "none");
      setDisplay(intReviewView, "none");
      setDisplay(testURLView, "none");
      setDisplay(clipboardView, "none");
      setDisplay(compatibleView, "flex");
      setDisplay(ratingDiv, "flex");
    }
  }

  // Restore the state of the checkbox and update element visibility
  chrome.storage.local.get(["awh_modeSwitch"], function(result) {
    if (result.awh_modeSwitch !== undefined) {
      modeSwitch.checked = result.awh_modeSwitch;
    }
    updateButtonVisibility(); // Ensure visibility is updated after state restoration
    // Re-render detections now that the saved Tech mode state is known
    if (typeof updateSidePanel === "function") updateSidePanel();
  });

  // Save the state of the checkbox and update element visibility when it is changed
  modeSwitch.addEventListener("change", function() {
    chrome.storage.local.set({ awh_modeSwitch: modeSwitch.checked }, function() {
      updateButtonVisibility();
    });
  });

  // Initial visibility update in case the storage retrieval is slow
  updateButtonVisibility();
});
