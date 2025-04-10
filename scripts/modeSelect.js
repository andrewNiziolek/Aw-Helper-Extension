document.addEventListener('DOMContentLoaded', function() {
    const modeSwitch = document.getElementById('modeSwitch');
    const newImplView = document.getElementById('newImplView');
    const intReviewView = document.getElementById('intReviewView');
    const testURLTech = document.getElementById('testURLTech');
    const clipboardView = document.getElementById('clipboard');
    const compatibleView = document.getElementById('compatibleBox');
    const ratingDiv = document.getElementById('ratingBox');

    // Function to update the visibility of page elements.
    function updateButtonVisibility() {
        if (modeSwitch.checked) {
            // If tech mode enabled, display (block/flex) or hide (none) these elements.
            // fp: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            newImplView.style.display = 'block';
            intReviewView.style.display = 'block';
            testURLTech.style.display = 'block';
            clipboardView.style.display = 'block';
            compatibleView.style.display = 'none';
            ratingDiv.style.display = 'none';
        } else { // If simple mode enabled...
            newImplView.style.display = 'none';
            intReviewView.style.display = 'none';
            testURLTech.style.display = 'none';
            clipboardView.style.display = 'none';
            compatibleView.style.display = 'flex';
            ratingDiv.style.display = 'flex';
        }
    }

    // Restore the state of the checkbox and update element visibility
    chrome.storage.local.get(['modeSwitch'], function(result) {
        if (result.modeSwitch !== undefined) {
            modeSwitch.checked = result.modeSwitch;
        }
        updateButtonVisibility(); // Ensure visibility is updated after state restoration
    });

    // Save the state of the checkbox and update element visibility when it is changed
    modeSwitch.addEventListener('change', function() {
        chrome.storage.local.set({modeSwitch: modeSwitch.checked}, function() {
            updateButtonVisibility();
        });
    });

    // Initial visibility update in case the storage retrieval is slow
    updateButtonVisibility();
});