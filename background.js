const attachedTabs = {};
const version = "1.3";
const marketDataCache = {}; // Глобальный кэш цен
const itemDetailsCache = {}; // Кэш для полной информации о предметах

// Инициализация аналитики
let analytics = null;
async function initAnalytics() {
    if (!analytics) {
        // Загружаем скрипт аналитики
        try {
            analytics = {
                track: (event, data) => {
                    // Простая локальная аналитика
                    chrome.storage.local.get({ analytics_events: [] }, (result) => {
                        const events = result.analytics_events;
                        events.push({
                            event,
                            data,
                            timestamp: Date.now(),
                            version: '1.2.0'
                        });
                        
                        // Ограничиваем размер
                        if (events.length > 1000) {
                            events.splice(0, events.length - 1000);
                        }
                        
                        chrome.storage.local.set({ analytics_events: events });
                        console.log('[R6 Analytics Background]', event, data);
                    });
                }
            };
            
            // Всегда включена локальная аналитика
            analytics.track('extension_service_worker_started');
        } catch (error) {
            console.error('Failed to initialize analytics:', error);
        }
    }
}

initAnalytics();

// Function to record detailed marketplace data
async function recordMarketplaceData(marketableItems) {
    try {
        const timestamp = new Date().toISOString();
        const records = [];
        
        marketableItems.forEach(itemNode => {
            const item = itemNode.item;
            const marketData = itemNode.marketData;
            const viewer = itemNode.viewer;
            
            // Extract weapon/character from tags
            const weaponCharacter = extractWeaponCharacter(item.tags || []);
            const season = extractSeason(item.tags || []);
            const rarity = extractRarity(item.tags || []);
            
            const record = {
                timestamp: timestamp,
                itemId: item.itemId,
                name: item.name,
                type: item.type,
                weaponCharacter: weaponCharacter,
                season: season,
                rarity: rarity,
                
                // Market data
                sellLowest: marketData.sellStats?.[0]?.lowestPrice,
                sellHighest: marketData.sellStats?.[0]?.highestPrice,
                sellOrders: marketData.sellStats?.[0]?.activeCount,
                
                buyLowest: marketData.buyStats?.[0]?.lowestPrice,
                buyHighest: marketData.buyStats?.[0]?.highestPrice,
                buyOrders: marketData.buyStats?.[0]?.activeCount,
                
                lastSoldPrice: marketData.lastSoldAt?.[0]?.price,
                lastSoldDate: marketData.lastSoldAt?.[0]?.performedAt,
                
                // User data
                userOwned: viewer?.meta?.isOwned || false,
                userQuantity: viewer?.meta?.quantity || 0,
                
                // Active trade
                activeTrade: viewer?.meta?.activeTrade ? true : false,
                tradeCategory: viewer?.meta?.activeTrade?.category,
                tradePrice: viewer?.meta?.activeTrade?.paymentOptions?.[0]?.price,
                tradeCreated: viewer?.meta?.activeTrade?.createdAt,
                tradeExpires: viewer?.meta?.activeTrade?.expiresAt,
                
                // Additional data
                assetUrl: item.assetUrl,
                tags: item.tags || []
            };
            
            records.push(record);
        });
        
        // Save to local storage
        chrome.storage.local.get({ marketplace_records: [] }, (result) => {
            const existingRecords = result.marketplace_records;
            const allRecords = [...existingRecords, ...records];
            
            // Limit to last 10000 records to prevent storage overflow
            if (allRecords.length > 10000) {
                allRecords.splice(0, allRecords.length - 10000);
            }
            
            chrome.storage.local.set({ marketplace_records: allRecords }, () => {
                console.log(`[R6 Market Helper] Recorded ${records.length} marketplace items`);
            });
        });
        
    } catch (error) {
        console.error('[R6 Market Helper] Error recording marketplace data:', error);
    }
}

// Helper functions to extract data from tags
function extractWeaponCharacter(tags) {
    // Look for weapon names or character names
    const weaponTags = tags.filter(tag => 
        tag.includes('W_') || 
        tag.includes('Character.') ||
        tag.match(/^[A-Z0-9-]+$/) && tag.length < 15
    );
    
    if (weaponTags.length > 0) {
        return weaponTags[0].replace('W_', '').replace('Character.', '').replace('Legacy.', '');
    }
    
    return 'Unknown';
}

function extractSeason(tags) {
    const seasonTag = tags.find(tag => tag.match(/^Y\d+S\d+$/));
    return seasonTag || 'Unknown';
}

function extractRarity(tags) {
    const rarityTag = tags.find(tag => tag.startsWith('rarity_'));
    return rarityTag ? rarityTag.replace('rarity_', '') : 'Unknown';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_ITEM_DETAILS') {
        const itemIds = request.itemIds || [];
        const details = itemIds.map(id => itemDetailsCache[id]).filter(Boolean);
        sendResponse({ details });
        return true; // Keep the message channel open for async response
    }

    if (request.type === 'attachDebugger') {
        const tabId = sender.tab.id;
        if (attachedTabs[tabId]) return;

        chrome.debugger.attach({ tabId: tabId }, version, () => {
            if (chrome.runtime.lastError) {
                console.error('[R6 Market Helper Background] Failed to attach debugger:', chrome.runtime.lastError.message);
                // Отправляем ошибку в content script для отображения уведомления
                chrome.tabs.sendMessage(tabId, { 
                    type: "SHOW_NOTIFICATION", 
                    message: "Failed to initialize R6 Market Helper. Please refresh the page.", 
                    messageType: "error" 
                });
                return;
            }
            attachedTabs[tabId] = true;
            chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable", {}, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[R6 Market Helper Background] Failed to enable network:', chrome.runtime.lastError.message);
                    analytics?.track('debugger_network_enable_failed', { error: chrome.runtime.lastError.message });
                } else {
                    console.log('[R6 Market Helper Background] Network debugging enabled for tab:', tabId);
                    analytics?.track('debugger_network_enabled', { tabId });
                    
                    // Уведомляем об успешной инициализации
                    chrome.tabs.sendMessage(tabId, { 
                        type: "SHOW_NOTIFICATION", 
                        message: "R6 Market Helper initialized successfully!", 
                        messageType: "success",
                        duration: 3000
                    });
                }
            });
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
                    if (chrome.runtime.lastError) {
                        console.error('[R6 Market Helper Background] Failed to get response body:', chrome.runtime.lastError.message);
                        return;
                    }
                    
                    if (!response || !response.body) {
                        console.warn('[R6 Market Helper Background] Empty response received');
                        return;
                    }
                    
                    try {
                        const data = JSON.parse(response.body);
                        chrome.tabs.sendMessage(source.tabId, { type: "GRAPHQL_DATA", data: data });
                        
                        // Инъекция в возможные iframe
                        console.log('[R6 Market Helper Background] Attempting script injection for tabId:', source.tabId);
                        
                        // Проверяем, содержат ли данные marketableItems перед инъекцией
                        console.log('[R6 Market Helper Background] Full data structure:', JSON.stringify(data, null, 2));
                        
                        // Попробуем разные пути к данным
                        const path1 = data?.data?.game?.viewer?.meta?.marketableItems?.nodes;
                        const path2 = data?.data?.game?.marketableItems?.nodes; // Путь для страницы покупок
                        const path3 = data?.data?.marketableItems?.nodes;
                        const path4 = data?.marketableItems?.nodes;
                        const path5 = Array.isArray(data) ? data.find(item => item?.data?.game?.viewer?.meta?.marketableItems) : null;
                        const path6 = Array.isArray(data) ? data.find(item => item?.data?.game?.marketableItems) : null;
                        
                        console.log('[R6 Market Helper Background] Path1 (data.data.game.viewer.meta.marketableItems.nodes):', path1?.length || 'not found');
                        console.log('[R6 Market Helper Background] Path2 (data.data.game.marketableItems.nodes):', path2?.length || 'not found');
                        console.log('[R6 Market Helper Background] Path3 (data.data.marketableItems.nodes):', path3?.length || 'not found');
                        console.log('[R6 Market Helper Background] Path4 (data.marketableItems.nodes):', path4?.length || 'not found');
                        console.log('[R6 Market Helper Background] Path5 (array search viewer):', path5 ? 'found' : 'not found');
                        console.log('[R6 Market Helper Background] Path6 (array search game):', path6 ? 'found' : 'not found');
                        
                        const hasMarketData = (path1?.length > 0) || (path2?.length > 0) || (path3?.length > 0) || (path4?.length > 0) || 
                                            (path5?.data?.game?.viewer?.meta?.marketableItems?.nodes?.length > 0) ||
                                            (path6?.data?.game?.marketableItems?.nodes?.length > 0);
                        console.log('[R6 Market Helper Background] Has market data?', hasMarketData);
                        
                        // Сохраняем данные в кэш если они есть
                        if (hasMarketData) {
                            let marketableItems = path1 || path2 || path3 || path4 || 
                                                (path5?.data?.game?.viewer?.meta?.marketableItems?.nodes) ||
                                                (path6?.data?.game?.marketableItems?.nodes);
                            
                            let newItemsCount = 0;
                            marketableItems.forEach(itemNode => {
                                const item = itemNode.item;
                                if (item && item.assetUrl && item.itemId) {
                                    const key = item.assetUrl.split('?')[0];
                                    if (!marketDataCache[key]) {
                                        newItemsCount++;
                                    }
                                    // Обновляем оба кэша
                                    marketDataCache[key] = {
                                        marketData: itemNode.marketData,
                                        itemId: item.itemId // Добавляем itemId
                                    };
                                    itemDetailsCache[item.itemId] = item;
                                }
                            });
                            
                            console.log('[R6 Market Helper Background] Cached', Object.keys(marketDataCache).length, 'items');
                            console.log('[R6 Market Helper Background] Cached details for', Object.keys(itemDetailsCache).length, 'items');
                            analytics?.track('marketplace_data_received', { 
                                totalCached: Object.keys(marketDataCache).length,
                                newItems: newItemsCount,
                                dataPath: path1 ? 'path1' : path2 ? 'path2' : path3 ? 'path3' : path4 ? 'path4' : path5 ? 'path5' : 'path6'
                            });
                            
                            // Записываем подробные данные для экспорта
                            chrome.storage.sync.get({ dataExport: true }, (settings) => {
                                if (settings.dataExport) {
                                    recordMarketplaceData(marketableItems);
                                }
                            });
                        }
                        
                        // Инжектируем скрипт только если есть данные (новые или кэшированные)
                        if (!hasMarketData && Object.keys(marketDataCache).length === 0) {
                            console.log('[R6 Market Helper Background] No data to inject, skipping');
                            return;
                        }
                        
                        // Получаем настройки перед инъекцией
                        chrome.storage.sync.get({
                            enabled: true,
                            position: 'top-right',
                            format: 'full'
                        }, (settings) => {
                            if (chrome.runtime.lastError) {
                                console.error('[R6 Market Helper Background] Failed to load settings:', chrome.runtime.lastError.message);
                                // Используем настройки по умолчанию
                                settings = { enabled: true, position: 'top-right', format: 'full' };
                            }
                            
                            // Если расширение отключено, не инжектируем
                            if (!settings.enabled) {
                                console.log('[R6 Market Helper Background] Extension disabled in settings');
                                return;
                            }
                            
                            // Пытаемся инжектировать через setTimeout для дожидания iframe
                            setTimeout(() => {
                                chrome.scripting.executeScript({
                                    target: { tabId: source.tabId, allFrames: true },
                                    func: (cachedData, userSettings) => {
                                    console.log('[R6 Market Helper] Script executed in frame:', window.location.href);
                                    console.log('[R6 Market Helper] Frame is iframe?', window.self !== window.top);
                                    console.log('[R6 Market Helper] Frame domain:', window.location.hostname);
                                    
                                    // Более широкая проверка iframe
                                    const isTargetFrame = window.location.href.includes('overlay.cdn.ubisoft.com') && 
                                                         window.location.href.includes('microApp=marketplace');
                                    
                                    if (isTargetFrame) {
                                    console.log('[R6 Market Helper] Script injected in iframe:', window.location.href);
                                    console.log('[R6 Market Helper] Received cached data:', cachedData);
                                    console.log('[R6 Market Helper] Cached items count:', Object.keys(cachedData).length);
                                    
                                    // Функция обновления карточек
                                    async function updateCards() {
                                        try {
                                            if (!document.body) {
                                                setTimeout(updateCards, 100);
                                                return;
                                            }

                                            const { favorites = [] } = await chrome.storage.local.get('favorites');
                                            const favoriteSet = new Set(favorites);
                                        
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
                                            if (card.querySelector('.r6-market-helper-container')) return; // Используем общий контейнер
                                            
                                            const imgElement = card.querySelector('img.item-image') || 
                                                              card.querySelector('img[class*="marketplace"]') ||
                                                              card.querySelector('img');
                                            
                                            if (!imgElement) return;
                                            
                                            const cardImgUrl = imgElement.src.split('?')[0];
                                            let itemData = cachedData[cardImgUrl];
                                            
                                            if (!itemData) {
                                                for (const [apiUrl, data] of Object.entries(cachedData)) {
                                                    if (cardImgUrl.includes(apiUrl) || apiUrl.includes(cardImgUrl)) {
                                                        itemData = data;
                                                        break;
                                                    }
                                                }
                                            }
                                            
                                            if (!itemData || !itemData.marketData) return;

                                            const cardStyle = window.getComputedStyle(card);
                                            if (cardStyle.position === 'static') {
                                                card.style.position = 'relative';
                                            }

                                            const helperContainer = document.createElement('div');
                                            helperContainer.className = 'r6-market-helper-container';
                                            helperContainer.style.cssText = `position: absolute; top: 8px; right: 8px; z-index: 1001; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;`;


                                            // --- Кнопка Избранное ---
                                            if (itemData.itemId) {
                                                const favButton = document.createElement('div');
                                                favButton.className = 'r6-market-helper-fav-btn';
                                                const isFavorite = favoriteSet.has(itemData.itemId);

                                                favButton.innerHTML = `
                                                    <svg viewBox="0 0 24 24" style="width: 22px; height: 22px; cursor: pointer; stroke: #f39c12; stroke-width: 1.5;" fill="${isFavorite ? '#f39c12' : 'rgba(0,0,0,0.5)'}">
                                                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
                                                    </svg>
                                                `;
                                                favButton.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))';

                                                favButton.addEventListener('click', async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const { favorites = [] } = await chrome.storage.local.get('favorites');
                                                    const currentFavorites = new Set(favorites);
                                                    const svg = favButton.querySelector('svg');

                                                    if (currentFavorites.has(itemData.itemId)) {
                                                        currentFavorites.delete(itemData.itemId);
                                                        svg.style.fill = 'rgba(0,0,0,0.5)';
                                                    } else {
                                                        currentFavorites.add(itemData.itemId);
                                                        svg.style.fill = '#f39c12';
                                                    }
                                                    await chrome.storage.local.set({ favorites: Array.from(currentFavorites) });
                                                });
                                                helperContainer.appendChild(favButton);
                                            }


                                            // --- Цены ---
                                            const itemMarketData = itemData.marketData;
                                            const lowestSellPrice = itemMarketData.sellStats?.[0]?.lowestPrice;
                                            const highestBuyPrice = itemMarketData.buyStats?.[0]?.highestPrice;
                                            
                                            if (lowestSellPrice !== undefined || highestBuyPrice !== undefined) {
                                                const priceContainer = document.createElement('div');
                                                priceContainer.className = 'r6-market-helper-prices';
                                                
                                                priceContainer.style.cssText = `
                                                    background: rgba(0, 0, 0, 0.85);
                                                    padding: 6px 8px;
                                                    border-radius: 4px;
                                                    font-size: 11px;
                                                    font-family: "Ubisoft Sans", Arial, sans-serif;
                                                    color: white;
                                                    backdrop-filter: blur(4px);
                                                    border: 1px solid rgba(255, 255, 255, 0.2);
                                                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                                                    text-align: right;
                                                `;
                                                
                                                function formatPrice(type, price) {
                                                    switch (userSettings.format) {
                                                        case 'short':
                                                            return type === 'buy' ? `Buy: ${price}` : `Sell: ${price}`;
                                                        case 'icons':
                                                            return type === 'buy' ? `🔺 ${price}` : `🔻 ${price}`;
                                                        default: // full
                                                            return type === 'buy' ? `Buy now: ${price}` : `Sell now: ${price}`;
                                                    }
                                                }
                                                
                                                if (lowestSellPrice !== undefined) {
                                                    const sellDiv = document.createElement('div');
                                                    sellDiv.style.cssText = 'color: #51cf66; margin-bottom: 2px; font-weight: 600; font-size: 10px;';
                                                    sellDiv.innerHTML = formatPrice('buy', lowestSellPrice);
                                                    priceContainer.appendChild(sellDiv);
                                                }
                                                
                                                if (highestBuyPrice !== undefined) {
                                                    const buyDiv = document.createElement('div');
                                                    buyDiv.style.cssText = 'color: #ff6b6b; font-weight: 600; font-size: 10px;';
                                                    buyDiv.innerHTML = formatPrice('sell', highestBuyPrice);
                                                    priceContainer.appendChild(buyDiv);
                                                }
                                                helperContainer.appendChild(priceContainer);
                                            }
                                            
                                            card.appendChild(helperContainer);
                                            injectedCount++;
                                        });
                                        
                                            if (injectedCount > 0) {
                                                console.log('[R6 Market Helper] Successfully injected helpers for', injectedCount, 'cards');
                                            } else {
                                                console.log('[R6 Market Helper] No cards found or no matching market data');
                                            }
                                        } catch (error) {
                                            console.error('[R6 Market Helper] Error in updateCards:', error);
                                        }
                                    }
                                    
                                    // Запускаем обновление
                                    updateCards();
                                    
                                    // Наблюдатель за изменениями DOM
                                    try {
                                        const observer = new MutationObserver((mutations) => {
                                            try {
                                                let shouldUpdate = false;
                                                mutations.forEach(mutation => {
                                                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                                                        for (const node of mutation.addedNodes) {
                                                            if (node.nodeType === Node.ELEMENT_NODE) {
                                                                try {
                                                                    if (node.matches && (
                                                                        node.matches('[data-e2e="secondary-store-grid-item"]') ||
                                                                        node.matches('[role="button"][class*="marketplace"]') ||
                                                                        node.querySelector('[data-e2e="secondary-store-grid-item"]') ||
                                                                        node.querySelector('[role="button"][class*="marketplace"]')
                                                                    )) {
                                                                        shouldUpdate = true;
                                                                        break;
                                                                    }
                                                                } catch (e) {
                                                                    // Игнорируем ошибки селекторов
                                                                }
                                                            }
                                                        }
                                                    }
                                                });
                                                
                                                if (shouldUpdate) {
                                                    setTimeout(updateCards, 500);
                                                }
                                            } catch (error) {
                                                console.error('[R6 Market Helper] Error in MutationObserver:', error);
                                            }
                                        });
                                        
                                        observer.observe(document.body, {
                                            childList: true,
                                            subtree: true
                                        });
                                        
                                        console.log('[R6 Market Helper] DOM observer initialized');
                                    } catch (error) {
                                        console.error('[R6 Market Helper] Failed to initialize DOM observer:', error);
                                    }
                                }
                            },
                            args: [marketDataCache, settings]
                            }).then((results) => {
                                console.log('[R6 Market Helper Background] Script injection completed:', results);
                                analytics?.track('script_injection_success', { 
                                    cachedItems: Object.keys(marketDataCache).length,
                                    settings: { position: settings.position, format: settings.format }
                                });
                                
                                // Уведомляем об успешном обновлении цен если есть данные
                                if (Object.keys(marketDataCache).length > 0) {
                                    chrome.tabs.sendMessage(source.tabId, { 
                                        type: "SHOW_NOTIFICATION", 
                                        message: `Price data updated! (${Object.keys(marketDataCache).length} items)`, 
                                        messageType: "info",
                                        duration: 2000
                                    });
                                }
                            }).catch((error) => {
                                console.error('[R6 Market Helper Background] Script injection failed:', error);
                                analytics?.track('script_injection_failed', { 
                                    error: error.message?.substring(0, 100)
                                });
                                
                                chrome.tabs.sendMessage(source.tabId, { 
                                    type: "SHOW_NOTIFICATION", 
                                    message: "Failed to inject price overlays. Try refreshing the page.", 
                                    messageType: "error"
                                });
                            });
                            }, 1000); // Ждем 1 секунду для загрузки iframe  
                        });
                    } catch (e) {
                        console.error('[R6 Market Helper Background] Error parsing GraphQL response:', e);
                        chrome.tabs.sendMessage(source.tabId, { 
                            type: "SHOW_NOTIFICATION", 
                            message: "Error processing marketplace data", 
                            messageType: "warning"
                        });
                    }
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