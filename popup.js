document.addEventListener('DOMContentLoaded', () => {
    loadFavorites();

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
            window.close();
        });
    }
});

async function loadFavorites() {
    const list = document.getElementById('favorites-list');
    if (!list) return;
    list.innerHTML = '<p>Loading favorites...</p>';

    try {
        const { favorites = [] } = await chrome.storage.local.get('favorites');
        if (favorites.length === 0) {
            list.innerHTML = '<p>No favorites yet. Add some from the marketplace!</p>';
            return;
        }

        chrome.runtime.sendMessage({ type: 'GET_ITEM_DETAILS', itemIds: favorites }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting item details:', chrome.runtime.lastError);
                list.innerHTML = '<p style="color: #e74c3c;">Error loading favorite item details.</p>';
                return;
            }

            const itemDetails = response.details;
            if (!itemDetails || itemDetails.length === 0) {
                list.innerHTML = '<p>Could not find details for favorite items. The cache might be empty.</p>';
                return;
            }

            list.innerHTML = ''; // Clear loading message
            itemDetails.forEach(item => {
                const itemUrl = `https://www.ubisoft.com/en-us/game/rainbow-six/siege/marketplace?route=buy%2Fitem-details&itemId=${item.itemId}`;

                const itemEl = document.createElement('div');
                itemEl.className = 'favorite-item';
                itemEl.innerHTML = `
                    <a href="${itemUrl}" target="_blank" class="favorite-item-link">
                        <img src="${item.assetUrl}" alt="${item.name}">
                    </a>
                    <div class="favorite-item-info">
                        <a href="${itemUrl}" target="_blank" class="favorite-item-link">
                            <div class="favorite-item-name">${item.name}</div>
                        </a>
                    </div>
                    <button class="remove-favorite-btn" data-item-id="${item.itemId}" title="Remove favorite">&times;</button>
                `;
                list.appendChild(itemEl);
            });

            // Add event listeners to new buttons
            list.querySelectorAll('.remove-favorite-btn').forEach(button => {
                button.addEventListener('click', handleRemoveFavorite);
            });
        });
    } catch (error) {
        console.error('Error loading favorites:', error);
        list.innerHTML = '<p style="color: #e74c3c;">Failed to load favorites.</p>';
    }
}

async function handleRemoveFavorite(event) {
    const itemId = event.target.dataset.itemId;
    if (!itemId) return;

    try {
        const { favorites = [] } = await chrome.storage.local.get('favorites');
        const newFavorites = favorites.filter(id => id !== itemId);
        await chrome.storage.local.set({ favorites: newFavorites });
        loadFavorites(); // Refresh the list
    } catch (error) {
        console.error('Error removing favorite:', error);
    }
}
