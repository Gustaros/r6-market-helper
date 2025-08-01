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
    try {
        const status = document.getElementById('status');
        if (!status) {
            console.error('Status element not found');
            return;
        }
        
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Error showing status:', error);
    }
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


// Load and display analytics stats
async function loadAnalyticsStats() {
    try {
        const result = await chrome.storage.local.get({ analytics_events: [] });
        const events = result.analytics_events;
        
        if (events.length === 0) {
            document.getElementById('stats-content').innerHTML = '<div>No usage data available</div>';
            return;
        }
        
        const stats = {
            totalEvents: events.length,
            sessions: new Set(events.map(e => e.sessionId)).size,
            extensionUsage: {},
            errorCount: 0,
            firstUsed: new Date(Math.min(...events.map(e => e.timestamp))),
            lastUsed: new Date(Math.max(...events.map(e => e.timestamp)))
        };
        
        // Count event types
        events.forEach(event => {
            stats.extensionUsage[event.event] = (stats.extensionUsage[event.event] || 0) + 1;
            if (event.event.includes('error') || event.event.includes('failed')) {
                stats.errorCount++;
            }
        });
        
        // Display stats
        const statsHtml = `
            <div style="margin: 5px 0;"><strong>Total Events:</strong> ${stats.totalEvents}</div>
            <div style="margin: 5px 0;"><strong>Sessions:</strong> ${stats.sessions}</div>
            <div style="margin: 5px 0;"><strong>Errors:</strong> ${stats.errorCount}</div>
            <div style="margin: 5px 0;"><strong>First Used:</strong> ${stats.firstUsed.toLocaleDateString()}</div>
            <div style="margin: 5px 0;"><strong>Last Used:</strong> ${stats.lastUsed.toLocaleDateString()}</div>
            <div style="margin: 10px 0;"><strong>Event Types:</strong></div>
            ${Object.entries(stats.extensionUsage)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([event, count]) => `<div style="margin: 2px 0; padding-left: 10px;">• ${event}: ${count}</div>`)
                .join('')}
        `;
        
        document.getElementById('stats-content').innerHTML = statsHtml;
    } catch (error) {
        console.error('Error loading analytics stats:', error);
        document.getElementById('stats-content').innerHTML = '<div style="color: #e74c3c;">Error loading stats</div>';
    }
}

// Clear analytics data
async function clearAnalyticsData() {
    try {
        await chrome.storage.local.set({ analytics_events: [] });
        showStatus('Analytics data cleared', 'success');
        
        // Hide stats if shown
        document.getElementById('analytics-stats').style.display = 'none';
    } catch (error) {
        console.error('Error clearing analytics data:', error);
        showStatus('Error clearing analytics data', 'error');
    }
}

// Initialize the options page
async function init() {
    try {
        const settings = await loadSettings();
        
        // Apply loaded settings to UI
        const enabledEl = document.getElementById('enabled');
        const positionEl = document.getElementById('position');
        const formatEl = document.getElementById('format');
        
        if (!enabledEl || !positionEl || !formatEl) {
            throw new Error('Required DOM elements not found');
        }
        
        enabledEl.checked = settings.enabled;
        positionEl.value = settings.position;
        formatEl.value = settings.format;
        
        // Update UI
        updateEnabledStatus();
        updatePreview();
        updateFormatPreview();
        
        // Add event listeners
        enabledEl.addEventListener('change', () => {
            try {
                updateEnabledStatus();
                saveCurrentSettings();
            } catch (error) {
                console.error('Error handling enabled change:', error);
                showStatus('Error updating setting', 'error');
            }
        });
        
        positionEl.addEventListener('change', () => {
            try {
                updatePreview();
                saveCurrentSettings();
            } catch (error) {
                console.error('Error handling position change:', error);
                showStatus('Error updating position', 'error');
            }
        });
        
        formatEl.addEventListener('change', () => {
            try {
                updateFormatPreview();
                saveCurrentSettings();
            } catch (error) {
                console.error('Error handling format change:', error);
                showStatus('Error updating format', 'error');
            }
        });
        
        
        // Analytics buttons
        document.getElementById('view-analytics').addEventListener('click', async () => {
            try {
                const statsDiv = document.getElementById('analytics-stats');
                if (statsDiv.style.display === 'none') {
                    await loadAnalyticsStats();
                    statsDiv.style.display = 'block';
                } else {
                    statsDiv.style.display = 'none';
                }
            } catch (error) {
                console.error('Error viewing analytics:', error);
                showStatus('Error loading analytics', 'error');
            }
        });
        
        document.getElementById('clear-analytics').addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
                await clearAnalyticsData();
            }
        });
        
        showStatus('Settings loaded successfully!', 'success');
    } catch (error) {
        console.error('Error initializing options page:', error);
        showStatus('Error loading settings page', 'error');
    }
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