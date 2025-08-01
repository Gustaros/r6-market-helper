// == R6 Market Helper - content.js ==
// Version: 6.2 (Cross-frame communication)

console.log('[R6 Market Helper] Main content script loaded');

// Сообщаем фоновому скрипту, что нужно подключить отладчик
chrome.runtime.sendMessage({ type: 'attachDebugger' });

// Глобальное хранилище для данных API
let apiItemsData = {};

// Инициализация системы уведомлений
let notificationSystem = null;

function initNotifications() {
    if (!notificationSystem) {
        // Создаем скрипт для системы уведомлений
        const script = document.createElement('script');
        script.textContent = `
            class R6Notifications {
                constructor() {
                    this.container = null;
                    this.createContainer();
                }
                
                createContainer() {
                    if (this.container) return;
                    
                    this.container = document.createElement('div');
                    this.container.id = 'r6-notifications-container';
                    this.container.style.cssText = \`
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 10000;
                        pointer-events: none;
                        font-family: "Ubisoft Sans", Arial, sans-serif;
                    \`;
                    
                    const target = document.body || document.documentElement;
                    target.appendChild(this.container);
                }
                
                show(message, type = 'info', duration = 4000) {
                    const notification = document.createElement('div');
                    
                    const baseStyle = \`
                        background: rgba(0, 0, 0, 0.9);
                        color: white;
                        padding: 12px 16px;
                        border-radius: 6px;
                        margin-bottom: 10px;
                        max-width: 300px;
                        font-size: 13px;
                        line-height: 1.4;
                        pointer-events: auto;
                        backdrop-filter: blur(4px);
                        border-left: 4px solid;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                        transform: translateX(100%);
                        opacity: 0;
                        transition: all 0.3s ease-out;
                    \`;
                    
                    let borderColor = '#3498db';
                    let icon = 'ℹ️';
                    
                    switch (type) {
                        case 'success':
                            borderColor = '#27ae60';
                            icon = '✅';
                            break;
                        case 'error':
                            borderColor = '#e74c3c';
                            icon = '❌';
                            break;
                        case 'warning':
                            borderColor = '#f39c12';
                            icon = '⚠️';
                            break;
                    }
                    
                    notification.style.cssText = baseStyle + \`border-left-color: \${borderColor};\`;
                    notification.innerHTML = \`
                        <div style="display: flex; align-items: flex-start; gap: 8px;">
                            <span style="flex-shrink: 0;">\${icon}</span>
                            <span>\${message}</span>
                        </div>
                    \`;
                    
                    this.container.appendChild(notification);
                    
                    // Анимация появления
                    setTimeout(() => {
                        notification.style.transform = 'translateX(0)';
                        notification.style.opacity = '1';
                    }, 10);
                    
                    // Автоматическое удаление
                    setTimeout(() => {
                        this.hide(notification);
                    }, duration);
                    
                    // Клик для закрытия
                    notification.addEventListener('click', () => {
                        this.hide(notification);
                    });
                    
                    return notification;
                }
                
                hide(notification) {
                    if (!notification || !notification.parentNode) return;
                    
                    notification.style.transform = 'translateX(100%)';
                    notification.style.opacity = '0';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }
                
                success(message, duration) { return this.show(message, 'success', duration); }
                error(message, duration) { return this.show(message, 'error', duration || 6000); }
                warning(message, duration) { return this.show(message, 'warning', duration); }
                info(message, duration) { return this.show(message, 'info', duration); }
            }
            
            window.R6Notify = new R6Notifications();
        `;
        document.head.appendChild(script);
        notificationSystem = true;
    }
}

// Слушаем данные от фонового скрипта
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GRAPHQL_DATA' && request.data) {
        console.log('[R6 Market Helper] Received GraphQL data in main script');
        processGraphQLData(request.data);
        // Отправляем данные в iframe через postMessage (безопасно)
        try {
            sendDataToIframe(request.data);
        } catch (e) {
            console.log('[R6 Market Helper] Error sending data to iframe:', e.message);
        }
    } else if (request.type === 'SHOW_NOTIFICATION') {
        // Показываем уведомление
        initNotifications();
        setTimeout(() => {
            if (window.R6Notify) {
                window.R6Notify.show(request.message, request.messageType, request.duration);
            }
        }, 100);
    }
});

// Отправка данных в iframe
function sendDataToIframe(data) {
    const ubisoftConnect = document.querySelector('ubisoft-connect');
    if (ubisoftConnect?.shadowRoot) {
        const iframe = ubisoftConnect.shadowRoot.querySelector('iframe');
        if (iframe?.contentWindow) {
            console.log('[R6 Market Helper] Found iframe with src:', iframe.src);
            // Убираем попытку доступа к iframe.contentWindow.location из-за cross-origin блокировки
            try {
                iframe.contentWindow.postMessage({
                    type: 'R6_MARKET_DATA_UPDATE',
                    data: data
                }, '*');
                console.log('[R6 Market Helper] Data sent to iframe via postMessage');
            } catch (e) {
                console.log('[R6 Market Helper] Failed to send data to iframe:', e.message);
            }
        } else {
            console.log('[R6 Market Helper] No iframe contentWindow found');
        }
    } else {
        console.log('[R6 Market Helper] No ubisoft-connect or shadowRoot found');
    }
}

// Обрабатываем данные из API для отладки
function processGraphQLData(responses) {
    console.log("[R6 Market Helper] Processing GraphQL data", responses);
    
    if (!Array.isArray(responses)) {
        responses = responses ? [responses] : [];
    }

    let itemsFound = false;
    for (const response of responses) {
        const marketableItems = response?.data?.game?.viewer?.meta?.marketableItems?.nodes;
        if (marketableItems && marketableItems.length > 0) {
            console.log(`[R6 Market Helper] Found ${marketableItems.length} items in API response`);
            itemsFound = true;
            break;
        }
    }
    
    if (!itemsFound) {
        console.log("[R6 Market Helper] No marketable items found in responses");
    }
}

// Наблюдатель за появлением iframe
function waitForIframe() {
    let attempts = 0;
    const maxAttempts = 60; // 30 секунд
    
    const checkInterval = setInterval(() => {
        attempts++;
        const ubisoftConnect = document.querySelector('ubisoft-connect');
        const iframe = ubisoftConnect?.shadowRoot?.querySelector('iframe');
        
        if (iframe) {
            console.log('[R6 Market Helper] iframe found, setting up communication');
            clearInterval(checkInterval);
            
            // Периодически пытаемся отправить данные в iframe
            const sendDataInterval = setInterval(() => {
                if (apiItemsData && Object.keys(apiItemsData).length > 0) {
                    sendDataToIframe({ data: { game: { viewer: { meta: { marketableItems: { nodes: apiItemsData } } } } } });
                }
            }, 2000);
            
        } else if (attempts >= maxAttempts) {
            console.log('[R6 Market Helper] iframe not found after maximum attempts');
            clearInterval(checkInterval);
        }
    }, 500);
}

// Запускаем наблюдатель
waitForIframe();
