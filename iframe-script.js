// Скрипт для работы внутри iframe marketplace
console.log('[R6 Market Helper] Iframe script loaded on:', window.location.href);

let marketData = {};

// Слушаем обновления данных через postMessage
window.addEventListener('message', (event) => {
    console.log('[R6 Market Helper] Message received in iframe:', event.data?.type);
    if (event.data?.type === 'R6_MARKET_DATA_UPDATE') {
        console.log('[R6 Market Helper] Received market data in iframe via postMessage');
        console.log('[R6 Market Helper] Raw data:', event.data.data);
        marketData = processApiData(event.data.data);
        console.log('[R6 Market Helper] Processed data:', Object.keys(marketData).length, 'items');
        updateMarketplaceCards();
    }
});

// Слушаем обновления данных через custom events
window.addEventListener('r6MarketDataUpdate', (event) => {
    console.log('[R6 Market Helper] Received market data in iframe via custom event');
    marketData = processApiData(event.detail);
    updateMarketplaceCards();
});

// Проверяем, есть ли уже данные
if (window.r6MarketData) {
    marketData = processApiData(window.r6MarketData);
    updateMarketplaceCards();
}

function processApiData(apiResponse) {
    const processedData = {};
    const marketableItems = apiResponse?.data?.game?.viewer?.meta?.marketableItems?.nodes;
    
    if (marketableItems && marketableItems.length > 0) {
        marketableItems.forEach(itemNode => {
            const assetUrl = itemNode?.item?.assetUrl;
            if (assetUrl) {
                processedData[assetUrl.split('?')[0]] = itemNode.marketData;
            }
        });
    }
    
    return processedData;
}

function updateMarketplaceCards() {
    // Ждем загрузки DOM
    if (!document.body) {
        setTimeout(updateMarketplaceCards, 100);
        return;
    }
    
    // Различные селекторы для карточек
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
    
    console.log(`[R6 Market Helper] Found ${allCards.length} cards in iframe`);
    
    let injectedCount = 0;
    
    allCards.forEach((card, index) => {
        // Пропускаем уже обработанные карточки
        if (card.querySelector('.r6-market-helper-prices')) return;
        
        // Ищем изображение товара
        const imgElement = card.querySelector('img.item-image') || 
                          card.querySelector('img[class*="marketplace"]') ||
                          card.querySelector('img');
        
        if (!imgElement) return;
        
        const cardImgUrl = imgElement.src.split('?')[0];
        let itemMarketData = marketData[cardImgUrl];
        
        // Поиск по частичному совпадению URL
        if (!itemMarketData) {
            for (const [apiUrl, data] of Object.entries(marketData)) {
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
        
        // Создаем контейнер для цен
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
        
        // Устанавливаем relative позиционирование для карточки
        const cardStyle = window.getComputedStyle(card);
        if (cardStyle.position === 'static') {
            card.style.position = 'relative';
        }
        
        card.appendChild(priceContainer);
        injectedCount++;
    });
    
    if (injectedCount > 0) {
        console.log(`[R6 Market Helper] Successfully injected prices for ${injectedCount} cards`);
    }
}

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
        setTimeout(updateMarketplaceCards, 500);
    }
});

// Запускаем наблюдатель
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Первоначальная попытка обновления
setTimeout(updateMarketplaceCards, 1000);