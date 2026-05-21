document.getElementById('open-ToolBtn').addEventListener('click', async () => { 
    const window = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: window.id });
});