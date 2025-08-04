// Default settings
const DEFAULT_SETTINGS = {
    enabled: true,
    position: 'top-right',
    format: 'full',
    dataExport: true,
    exportFormat: 'csv'
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

// Update data export status text
function updateDataExportStatus() {
    const enabled = document.getElementById('dataExport').checked;
    const status = document.getElementById('dataExport-status');
    status.textContent = enabled ? 'Enabled' : 'Disabled';
    status.style.color = enabled ? '#27ae60' : '#e74c3c';
}

// Export marketplace data
async function exportMarketplaceData() {
    try {
        const result = await chrome.storage.local.get({ marketplace_records: [] });
        const records = result.marketplace_records;
        
        if (records.length === 0) {
            showStatus('No data to export', 'warning');
            return;
        }
        
        const format = document.getElementById('exportFormat').value;
        let content = '';
        let filename = '';
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-') ;
        
        switch (format) {
            case 'csv':
                content = convertToCSV(records);
                filename = `r6_marketplace_data_${timestamp}.csv`;
                break;
            case 'json':
                content = JSON.stringify(records, null, 2);
                filename = `r6_marketplace_data_${timestamp}.json`;
                break;
            case 'txt':
                content = convertToTXT(records);
                filename = `r6_marketplace_data_${timestamp}.txt`;
                break;
        }
        
        // Create and download file
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus(`Exported ${records.length} records as ${format.toUpperCase()}`, 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showStatus('Error exporting data', 'error');
    }
}

// Convert records to CSV format
function convertToCSV(records) {
    const headers = [
        'Timestamp', 'Item ID', 'Name', 'Type', 'Weapon/Character', 'Season', 'Rarity',
        'Sell Lowest', 'Sell Highest', 'Sell Orders', 'Buy Lowest', 'Buy Highest', 'Buy Orders',
        'Last Sold Price', 'Last Sold Date', 'Asset URL', 'User Owned', 'User Quantity',
        'Active Trade', 'Trade Category', 'Trade Price', 'All Tags'
    ];
    
    let csv = headers.join(',') + '\n';
    
    records.forEach(record => {
        const row = [
            record.timestamp,
            record.itemId || '',
            `"${(record.name || '').replace(/"/g, '""')}"`, 
            record.type || '',
            record.weaponCharacter || '',
            record.season || '',
            record.rarity || '',
            record.sellLowest || '',
            record.sellHighest || '',
            record.sellOrders || '',
            record.buyLowest || '',
            record.buyHighest || '',
            record.buyOrders || '',
            record.lastSoldPrice || '',
            record.lastSoldDate || '',
            `"${record.assetUrl || ''}"`, 
            record.userOwned || '',
            record.userQuantity || '',
            record.activeTrade || '',
            record.tradeCategory || '',
            record.tradePrice || '',
            `"${(record.tags || []).join('; ')}"`
        ];
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// Convert records to TXT format
function convertToTXT(records) {
    let txt = '=== R6 MARKETPLACE DATA EXPORT ===\n\n';
    txt += `Generated: ${new Date().toLocaleString()}\n`;
    txt += `Total Records: ${records.length}\n\n`;
    
    records.forEach((record, index) => {
        txt += `--- RECORD ${index + 1} ---\n`;
        txt += `Timestamp: ${record.timestamp}\n`;
        txt += `Name: ${record.name}\n`;
        txt += `Type: ${record.type}\n`;
        txt += `Weapon/Character: ${record.weaponCharacter}\n`;
        txt += `Season: ${record.season}\n`;
        txt += `Rarity: ${record.rarity}\n`;
        txt += `Sell: ${record.sellLowest} - ${record.sellHighest} (${record.sellOrders} orders)\n`;
        txt += `Buy: ${record.buyLowest} - ${record.buyHighest} (${record.buyOrders} orders)\n`;
        txt += `Last Sold: ${record.lastSoldPrice} at ${record.lastSoldDate}\n`;
        txt += `User: Owned=${record.userOwned}, Qty=${record.userQuantity}\n`;
        if (record.activeTrade) {
            txt += `Active Trade: ${record.tradeCategory} - ${record.tradePrice}\n`;
        }
        txt += `Tags: ${(record.tags || []).join(', ')}\n`;
        txt += `Asset: ${record.assetUrl}\n\n`;
    });
    
    return txt;
}

// Load export statistics
async function loadExportStats() {
    try {
        const result = await chrome.storage.local.get({ marketplace_records: [] });
        const records = result.marketplace_records;
        
        if (records.length === 0) {
            document.getElementById('export-stats-content').innerHTML = '<div>No marketplace data recorded yet</div>';
            return;
        }
        
        // Calculate statistics
        const stats = {
            totalRecords: records.length,
            uniqueItems: new Set(records.map(r => r.itemId)).size,
            dateRange: {
                first: new Date(Math.min(...records.map(r => new Date(r.timestamp)))),
                last: new Date(Math.max(...records.map(r => new Date(r.timestamp))))
            },
            itemTypes: {},
            rarities: {},
            seasons: {}
        };
        
        records.forEach(record => {
            stats.itemTypes[record.type] = (stats.itemTypes[record.type] || 0) + 1;
            stats.rarities[record.rarity] = (stats.rarities[record.rarity] || 0) + 1;
            stats.seasons[record.season] = (stats.seasons[record.season] || 0) + 1;
        });
        
        // Display statistics
        const statsHtml = `
            <div style="margin: 5px 0;"><strong>Total Records:</strong> ${stats.totalRecords}</div>
            <div style="margin: 5px 0;"><strong>Unique Items:</strong> ${stats.uniqueItems}</div>
            <div style="margin: 5px 0;"><strong>Date Range:</strong> ${stats.dateRange.first.toLocaleDateString()} - ${stats.dateRange.last.toLocaleDateString()}</div>
            <div style="margin: 10px 0;"><strong>Item Types:</strong></div>
            ${Object.entries(stats.itemTypes).map(([type, count]) => 
                `<div style="margin: 2px 0; padding-left: 10px;">• ${type}: ${count}</div>`
            ).join('')}
            <div style="margin: 10px 0;"><strong>Top Rarities:</strong></div>
            ${Object.entries(stats.rarities)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([rarity, count]) => 
                    `<div style="margin: 2px 0; padding-left: 10px;">• ${rarity}: ${count}</div>`
                ).join('')}
        `;
        
        document.getElementById('export-stats-content').innerHTML = statsHtml;
    } catch (error) {
        console.error('Error loading export stats:', error);
        document.getElementById('export-stats-content').innerHTML = '<div style="color: #e74c3c;">Error loading statistics</div>';
    }
}

// Clear export data
async function clearExportData() {
    try {
        await chrome.storage.local.set({ marketplace_records: [] });
        showStatus('Export data cleared', 'success');
        
        // Hide stats if shown
        document.getElementById('export-stats').style.display = 'none';
    } catch (error) {
        console.error('Error clearing export data:', error);
        showStatus('Error clearing export data', 'error');
    }
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

// --- Tab Navigation ---
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            document.getElementById(tabName).classList.add('active');
        });
    });
}


// Initialize the options page
async function init() {
    try {
        setupTabs(); // Set up tab navigation first

        const settings = await loadSettings();
        
        // Apply loaded settings to UI
        const enabledEl = document.getElementById('enabled');
        const positionEl = document.getElementById('position');
        const formatEl = document.getElementById('format');
        const dataExportEl = document.getElementById('dataExport');
        const exportFormatEl = document.getElementById('exportFormat');
        
        if (!enabledEl || !positionEl || !formatEl || !dataExportEl || !exportFormatEl) {
            throw new Error('Required DOM elements not found');
        }
        
        enabledEl.checked = settings.enabled;
        positionEl.value = settings.position;
        formatEl.value = settings.format;
        dataExportEl.checked = settings.dataExport;
        exportFormatEl.value = settings.exportFormat;
        
        // Update UI
        updateEnabledStatus();
        updateDataExportStatus();
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
        
        dataExportEl.addEventListener('change', () => {
            try {
                updateDataExportStatus();
                saveCurrentSettings();
            } catch (error) {
                console.error('Error handling data export change:', error);
                showStatus('Error updating data export setting', 'error');
            }
        });
        
        exportFormatEl.addEventListener('change', () => {
            try {
                saveCurrentSettings();
            } catch (error) {
                console.error('Error handling export format change:', error);
                showStatus('Error updating export format', 'error');
            }
        });
        
        // Export buttons
        document.getElementById('export-data').addEventListener('click', exportMarketplaceData);
        
        document.getElementById('clear-export-data').addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all marketplace records? This cannot be undone.')) {
                await clearExportData();
            }
        });
        
        document.getElementById('view-export-stats').addEventListener('click', async () => {
            try {
                const statsDiv = document.getElementById('export-stats');
                if (statsDiv.style.display === 'none') {
                    await loadExportStats();
                    statsDiv.style.display = 'block';
                } else {
                    statsDiv.style.display = 'none';
                }
            } catch (error) {
                console.error('Error viewing export stats:', error);
                showStatus('Error loading export statistics', 'error');
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
        format: document.getElementById('format').value,
        dataExport: document.getElementById('dataExport').checked,
        exportFormat: document.getElementById('exportFormat').value
    };
    
    await saveSettings(settings);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Version display
try {
    const version = chrome.runtime.getManifest().version;
    document.querySelector('.version').textContent = `Version ${version}`;
} catch (error) {
    console.error('Error getting manifest version:', error);
}
