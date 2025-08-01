// Default settings
const DEFAULT_SETTINGS = {
    enabled: true,
    position: 'top-right',
    format: 'full'
};

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
        return result;
    } catch (error) {
        console.error('Error loading settings:', error);
        return DEFAULT_SETTINGS;
    }
}

// Save settings to storage
async function saveSettings(settings) {
    try {
        await chrome.storage.sync.set(settings);
        showStatus('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Error saving settings', 'error');
    }
}

// Show status message
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// Update position preview
function updatePreview() {
    const position = document.getElementById('position').value;
    const previewPrice = document.getElementById('preview-price');
    
    // Reset all positions
    previewPrice.style.top = 'auto';
    previewPrice.style.bottom = 'auto';
    previewPrice.style.left = 'auto';
    previewPrice.style.right = 'auto';
    
    // Apply selected position
    switch (position) {
        case 'top-right':
            previewPrice.style.top = '8px';
            previewPrice.style.right = '8px';
            break;
        case 'top-left':
            previewPrice.style.top = '8px';
            previewPrice.style.left = '8px';
            break;
        case 'bottom-right':
            previewPrice.style.bottom = '8px';
            previewPrice.style.right = '8px';
            break;
        case 'bottom-left':
            previewPrice.style.bottom = '8px';
            previewPrice.style.left = '8px';
            break;
    }
}

// Update format preview
function updateFormatPreview() {
    const format = document.getElementById('format').value;
    const previewPrice = document.getElementById('preview-price');
    
    let buyText, sellText;
    
    switch (format) {
        case 'full':
            buyText = 'Buy now: 1000';
            sellText = 'Sell now: 900';
            break;
        case 'short':
            buyText = 'Buy: 1000';
            sellText = 'Sell: 900';
            break;
        case 'icons':
            buyText = '🔺 1000';
            sellText = '🔻 900';
            break;
    }
    
    previewPrice.innerHTML = `
        <div style="color: #51cf66; margin-bottom: 2px; font-weight: 600; font-size: 10px;">${buyText}</div>
        <div style="color: #ff6b6b; font-weight: 600; font-size: 10px;">${sellText}</div>
    `;
}

// Update enabled status text
function updateEnabledStatus() {
    const enabled = document.getElementById('enabled').checked;
    const status = document.getElementById('enabled-status');
    status.textContent = enabled ? 'Enabled' : 'Disabled';
    status.style.color = enabled ? '#27ae60' : '#e74c3c';
}

// Initialize the options page
async function init() {
    const settings = await loadSettings();
    
    // Apply loaded settings to UI
    document.getElementById('enabled').checked = settings.enabled;
    document.getElementById('position').value = settings.position;
    document.getElementById('format').value = settings.format;
    
    // Update UI
    updateEnabledStatus();
    updatePreview();
    updateFormatPreview();
    
    // Add event listeners
    document.getElementById('enabled').addEventListener('change', () => {
        updateEnabledStatus();
        saveCurrentSettings();
    });
    
    document.getElementById('position').addEventListener('change', () => {
        updatePreview();
        saveCurrentSettings();
    });
    
    document.getElementById('format').addEventListener('change', () => {
        updateFormatPreview();
        saveCurrentSettings();
    });
}

// Save current settings from UI
async function saveCurrentSettings() {
    const settings = {
        enabled: document.getElementById('enabled').checked,
        position: document.getElementById('position').value,
        format: document.getElementById('format').value
    };
    
    await saveSettings(settings);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);