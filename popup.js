document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
});