# R6 Siege Marketplace Helper

A browser extension that displays current buy and sell prices directly on Rainbow Six Siege marketplace item cards, helping you make better trading decisions.

## Features

- 💰 **Real-time Price Display**: Shows current "Buy now" and "Sell now" prices on item cards
- ⚡ **Instant Updates**: Prices update automatically as you browse the marketplace
- 🎯 **Universal Coverage**: Works on all marketplace pages (Buy, Sell, Browse)
- 🚀 **Lightweight**: Minimal impact on page performance
- 🔒 **Privacy-focused**: No data collection or external API calls

## How It Works

The extension intercepts GraphQL requests from the Ubisoft marketplace and displays the pricing information directly on item cards:

- **"Buy now"**: Lowest available sell price (you can buy at this price)
- **"Sell now"**: Highest available buy order (you can sell at this price)

## Installation

### From Chrome Web Store
*Coming soon...*

### Manual Installation
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. Navigate to the R6 Siege marketplace to start using

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: Limited to Ubisoft domains only
- **Architecture**: Service worker + content script injection
- **Data Source**: Ubisoft's own GraphQL marketplace API

## Contributing

Found a bug or have a feature request? Please open an issue on GitHub.

## License

MIT License - see LICENSE file for details

## Disclaimer

This extension is not affiliated with or endorsed by Ubisoft. Rainbow Six Siege is a trademark of Ubisoft Entertainment.