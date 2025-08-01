// R6 Market Helper Analytics
// Privacy-focused usage analytics

class R6Analytics {
    constructor() {
        this.enabled = true;
        this.sessionId = this.generateSessionId();
        this.events = [];
        this.loadSettings();
    }
    
    generateSessionId() {
        return 'r6mh_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get({ analyticsEnabled: true });
            this.enabled = result.analyticsEnabled;
        } catch (error) {
            console.log('Analytics: Failed to load settings, using defaults');
            this.enabled = true;
        }
    }
    
    async saveSettings(enabled) {
        try {
            await chrome.storage.sync.set({ analyticsEnabled: enabled });
            this.enabled = enabled;
        } catch (error) {
            console.error('Analytics: Failed to save settings:', error);
        }
    }
    
    track(event, data = {}) {
        if (!this.enabled) return;
        
        const eventData = {
            event: event,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            data: data,
            version: '1.2.0'
        };
        
        // Локальное логирование для отладки
        console.log('[R6 Analytics]', eventData);
        
        // Сохраняем в локальное хранилище для статистики
        this.saveEventLocally(eventData);
    }
    
    async saveEventLocally(eventData) {
        try {
            const result = await chrome.storage.local.get({ analytics_events: [] });
            const events = result.analytics_events;
            
            // Добавляем новое событие
            events.push(eventData);
            
            // Ограничиваем размер массива (последние 1000 событий)
            if (events.length > 1000) {
                events.splice(0, events.length - 1000);
            }
            
            await chrome.storage.local.set({ analytics_events: events });
        } catch (error) {
            console.error('Analytics: Failed to save event locally:', error);
        }
    }
    
    async getLocalStats() {
        try {
            const result = await chrome.storage.local.get({ analytics_events: [] });
            const events = result.analytics_events;
            
            if (events.length === 0) {
                return {
                    totalEvents: 0,
                    sessions: 0,
                    extensionUsage: {},
                    errorCount: 0
                };
            }
            
            const stats = {
                totalEvents: events.length,
                sessions: new Set(events.map(e => e.sessionId)).size,
                extensionUsage: {},
                errorCount: 0,
                firstUsed: new Date(Math.min(...events.map(e => e.timestamp))),
                lastUsed: new Date(Math.max(...events.map(e => e.timestamp)))
            };
            
            // Подсчитываем типы событий
            events.forEach(event => {
                stats.extensionUsage[event.event] = (stats.extensionUsage[event.event] || 0) + 1;
                if (event.event.includes('error')) {
                    stats.errorCount++;
                }
            });
            
            return stats;
        } catch (error) {
            console.error('Analytics: Failed to get local stats:', error);
            return null;
        }
    }
    
    async clearLocalData() {
        try {
            await chrome.storage.local.set({ analytics_events: [] });
            console.log('Analytics: Local data cleared');
        } catch (error) {
            console.error('Analytics: Failed to clear local data:', error);
        }
    }
    
    // Основные события для отслеживания
    extensionLoaded() {
        this.track('extension_loaded');
    }
    
    debuggerAttached() {
        this.track('debugger_attached');
    }
    
    dataReceived(itemCount) {
        this.track('marketplace_data_received', { itemCount });
    }
    
    pricesInjected(cardCount, position, format) {
        this.track('prices_injected', { 
            cardCount, 
            position, 
            format 
        });
    }
    
    settingsChanged(setting, value) {
        this.track('settings_changed', { 
            setting, 
            value: typeof value 
        });
    }
    
    errorOccurred(errorType, details) {
        this.track('error_occurred', { 
            errorType, 
            details: details?.substring(0, 100) // Ограничиваем длину
        });
    }
    
    pageVisited(page) {
        const validPages = ['buy', 'sell', 'browse', 'home'];
        if (validPages.some(p => page.toLowerCase().includes(p))) {
            this.track('page_visited', { page });
        }
    }
}

// Глобальный экземпляр
window.R6Analytics = new R6Analytics();