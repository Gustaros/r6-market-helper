const attachedTabs = {};
const version = "1.3";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'attachDebugger') {
        const tabId = sender.tab.id;
        if (attachedTabs[tabId]) return;

        chrome.debugger.attach({ tabId: tabId }, version, () => {
            if (chrome.runtime.lastError) return;
            attachedTabs[tabId] = true;
            chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable");
        });
    }
});

chrome.debugger.onEvent.addListener((source, method, params) => {
    if (method === "Network.responseReceived") {
        if (params.response.url.includes("public-ubiservices.ubi.com/v1/profiles/me/uplay/graphql")) {
            chrome.debugger.sendCommand(
                { tabId: source.tabId },
                "Network.getResponseBody",
                { requestId: params.requestId },
                (response) => {
                    if (chrome.runtime.lastError || !response || !response.body) return;
                    try {
                        const data = JSON.parse(response.body);
                        chrome.tabs.sendMessage(source.tabId, { type: "GRAPHQL_DATA", data: data });
                        
                        // Инъекция в возможные iframe
                        console.log('[R6 Market Helper Background] Attempting script injection for tabId:', source.tabId);
                        
                        // Проверяем, содержат ли данные marketableItems перед инъекцией
                        console.log('[R6 Market Helper Background] Full data structure:', JSON.stringify(data, null, 2));
                        
                        // Попробуем разные пути к данным
                        const path1 = data?.data?.game?.viewer?.meta?.marketableItems?.nodes;
                        const path2 = data?.data?.marketableItems?.nodes;
                        const path3 = data?.marketableItems?.nodes;
                        const path4 = Array.isArray(data) ? data.find(item => item?.data?.game?.viewer?.meta?.marketableItems) : null;
                        
                        console.log('[R6 Market Helper Background] Path1 (data.data.game.viewer.meta.marketableItems.nodes):', path1?.length || 'not found');
                        console.log('[R6 Market Helper Background] Path2 (data.data.marketableItems.nodes):', path2?.length || 'not found');
                        console.log('[R6 Market Helper Background] Path3 (data.marketableItems.nodes):', path3?.length || 'not found');
                        console.log('[R6 Market Helper Background] Path4 (array search):', path4 ? 'found' : 'not found');
                        
                        const hasMarketData = (path1?.length > 0) || (path2?.length > 0) || (path3?.length > 0) || (path4?.data?.game?.viewer?.meta?.marketableItems?.nodes?.length > 0);
                        console.log('[R6 Market Helper Background] Has market data?', hasMarketData);
                        
                        if (!hasMarketData) {
                            console.log('[R6 Market Helper Background] No market data in response, skipping injection');
                            return;
                        }
                        
                        // Пытаемся инжектировать через setTimeout для дожидания iframe
                        setTimeout(() => {
                            chrome.scripting.executeScript({
                                target: { tabId: source.tabId, allFrames: true },
                                func: (apiData) => {
                                    console.log('[R6 Market Helper] Script executed in frame:', window.location.href);
                                    console.log('[R6 Market Helper] Frame is iframe?', window.self !== window.top);
                                    console.log('[R6 Market Helper] Frame domain:', window.location.hostname);
                                    
                                    // Более широкая проверка iframe
                                    const isTargetFrame = window.location.href.includes('overlay.cdn.ubisoft.com') && 
                                                         window.location.href.includes('microApp=marketplace');
                                    
                                    if (isTargetFrame) {
                                    console.log('[R6 Market Helper] Script injected in iframe:', window.location.href);
                                    console.log('[R6 Market Helper] Received data:', apiData);
                                    
                                    
                                    // Показываем алерт для тестирования
                                    if (window.location.href.includes('connect.cdn.ubisoft.com')) {
                                        console.log('[R6 Market Helper] CONFIRMED: Running in connect iframe!');
                                    }
                                    
                                    // Обрабатываем данные
                                    const processedData = {};
                                    console.log('[R6 Market Helper] Raw API data structure:', apiData);
                                    
                                    // Пытаемся найти marketableItems в разных местах структуры данных
                                    let marketableItems = null;
                                    
                                    // Проверяем разные пути
                                    if (apiData?.data?.game?.viewer?.meta?.marketableItems?.nodes) {
                                        marketableItems = apiData.data.game.viewer.meta.marketableItems.nodes;
                                        console.log('[R6 Market Helper] Found marketableItems via path1');
                                    } else if (apiData?.data?.marketableItems?.nodes) {
                                        marketableItems = apiData.data.marketableItems.nodes;
                                        console.log('[R6 Market Helper] Found marketableItems via path2');
                                    } else if (apiData?.marketableItems?.nodes) {
                                        marketableItems = apiData.marketableItems.nodes;
                                        console.log('[R6 Market Helper] Found marketableItems via path3');
                                    } else if (Array.isArray(apiData)) {
                                        // Если данные представлены массивом, ищем в каждом элементе
                                        for (const item of apiData) {
                                            if (item?.data?.game?.viewer?.meta?.marketableItems?.nodes) {
                                                marketableItems = item.data.game.viewer.meta.marketableItems.nodes;
                                                console.log('[R6 Market Helper] Found marketableItems in array element');
                                                break;
                                            }
                                        }
                                    }
                                    
                                    if (marketableItems && marketableItems.length > 0) {
                                        console.log('[R6 Market Helper] Processing', marketableItems.length, 'items');
                                        marketableItems.forEach((itemNode, idx) => {
                                            const assetUrl = itemNode?.item?.assetUrl;
                                            if (assetUrl) {
                                                processedData[assetUrl.split('?')[0]] = itemNode.marketData;
                                                if (idx < 3) { // Логируем первые 3 для отладки
                                                    console.log('[R6 Market Helper] Item', idx + 1, ':', {
                                                        url: assetUrl,
                                                        marketData: itemNode.marketData
                                                    });
                                                }
                                            }
                                        });
                                    } else {
                                        console.log('[R6 Market Helper] No marketableItems found in data');
                                    }
                                    
                                    console.log('[R6 Market Helper] Processed data:', Object.keys(processedData).length, 'items');
                                    
                                    // Функция обновления карточек
                                    function updateCards() {
                                        if (!document.body) {
                                            setTimeout(updateCards, 100);
                                            return;
                                        }
                                        
                                        const selectors = [
                                            '[data-e2e="secondary-store-grid-item"]',
                                            '[role="button"][class*="marketplace"]',
                                            'div[class*="marketplace-"][tabindex="0"]'
                                        ];
                                        
                                        let allCards = [];
                                        for (const selector of selectors) {
                                            allCards = document.querySelectorAll(selector);
                                            if (allCards.length > 0) break;
                                        }
                                        
                                        console.log('[R6 Market Helper] Found', allCards.length, 'cards in iframe');
                                        
                                        let injectedCount = 0;
                                        
                                        allCards.forEach((card, index) => {
                                            if (card.querySelector('.r6-market-helper-prices')) return;
                                            
                                            const imgElement = card.querySelector('img.item-image') || 
                                                              card.querySelector('img[class*="marketplace"]') ||
                                                              card.querySelector('img');
                                            
                                            if (!imgElement) return;
                                            
                                            const cardImgUrl = imgElement.src.split('?')[0];
                                            let itemMarketData = processedData[cardImgUrl];
                                            
                                            if (!itemMarketData) {
                                                for (const [apiUrl, data] of Object.entries(processedData)) {
                                                    if (cardImgUrl.includes(apiUrl) || apiUrl.includes(cardImgUrl)) {
                                                        itemMarketData = data;
                                                        break;
                                                    }
                                                }
                                            }
                                            
                                            if (!itemMarketData) return;
                                            
                                            const lowestSellPrice = itemMarketData.sellStats?.[0]?.lowestPrice;
                                            const highestBuyPrice = itemMarketData.buyStats?.[0]?.highestPrice;
                                            
                                            if (lowestSellPrice === undefined && highestBuyPrice === undefined) return;
                                            
                                            const priceContainer = document.createElement('div');
                                            priceContainer.className = 'r6-market-helper-prices';
                                            priceContainer.style.cssText = `
                                                position: absolute;
                                                top: 8px;
                                                right: 8px;
                                                z-index: 1000;
                                                background: rgba(0, 0, 0, 0.85);
                                                padding: 6px 8px;
                                                border-radius: 4px;
                                                font-size: 11px;
                                                font-family: "Ubisoft Sans", Arial, sans-serif;
                                                color: white;
                                                backdrop-filter: blur(4px);
                                                border: 1px solid rgba(255, 255, 255, 0.2);
                                                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                                            `;
                                            
                                            if (lowestSellPrice !== undefined) {
                                                const sellDiv = document.createElement('div');
                                                sellDiv.style.cssText = 'color: #ff6b6b; margin-bottom: 2px; font-weight: 600;';
                                                sellDiv.innerHTML = `🔻 ${lowestSellPrice}`;
                                                priceContainer.appendChild(sellDiv);
                                            }
                                            
                                            if (highestBuyPrice !== undefined) {
                                                const buyDiv = document.createElement('div');
                                                buyDiv.style.cssText = 'color: #51cf66; font-weight: 600;';
                                                buyDiv.innerHTML = `🔺 ${highestBuyPrice}`;
                                                priceContainer.appendChild(buyDiv);
                                            }
                                            
                                            const cardStyle = window.getComputedStyle(card);
                                            if (cardStyle.position === 'static') {
                                                card.style.position = 'relative';
                                            }
                                            
                                            card.appendChild(priceContainer);
                                            injectedCount++;
                                        });
                                        
                                        if (injectedCount > 0) {
                                            console.log('[R6 Market Helper] Successfully injected prices for', injectedCount, 'cards');
                                        }
                                    }
                                    
                                    // Запускаем обновление
                                    updateCards();
                                    
                                    // Наблюдатель за изменениями DOM
                                    const observer = new MutationObserver((mutations) => {
                                        let shouldUpdate = false;
                                        mutations.forEach(mutation => {
                                            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                                                for (const node of mutation.addedNodes) {
                                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                                        if (node.matches && (
                                                            node.matches('[data-e2e="secondary-store-grid-item"]') ||
                                                            node.matches('[role="button"][class*="marketplace"]') ||
                                                            node.querySelector('[data-e2e="secondary-store-grid-item"]') ||
                                                            node.querySelector('[role="button"][class*="marketplace"]')
                                                        )) {
                                                            shouldUpdate = true;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        });
                                        
                                        if (shouldUpdate) {
                                            setTimeout(updateCards, 500);
                                        }
                                    });
                                    
                                    observer.observe(document.body, {
                                        childList: true,
                                        subtree: true
                                    });
                                }
                            },
                            args: [data]
                            }).then((results) => {
                                console.log('[R6 Market Helper Background] Script injection completed:', results);
                            }).catch((error) => {
                                console.log('[R6 Market Helper Background] Script injection failed:', error);
                            });
                        }, 1000); // Ждем 1 секунду для загрузки iframe
                    } catch (e) {}
                }
            );
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (attachedTabs[tabId]) {
        chrome.debugger.detach({ tabId: tabId });
        delete attachedTabs[tabId];
    }
});