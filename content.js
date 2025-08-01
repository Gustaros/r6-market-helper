// == R6 Market Helper - content.js ==
// Version: 6.2 (Cross-frame communication)

console.log('[R6 Market Helper] Main content script loaded');

// Сообщаем фоновому скрипту, что нужно подключить отладчик
chrome.runtime.sendMessage({ type: 'attachDebugger' });

// Глобальное хранилище для данных API
let apiItemsData = {};

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
