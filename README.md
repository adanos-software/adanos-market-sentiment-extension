# Adanos Sentiment Lens

Adanos Sentiment Lens is a Chrome Extension for stock market research. It shows
market sentiment for selected stock tickers from the Adanos Market Sentiment API.

## Features

- Check highlighted stock tickers from the browser context menu.
- Compare up to 10 stock tickers from the popup.
- Show source-specific activity metrics for each sentiment source.
- Choose one of four stock sentiment sources:
  - News
  - Reddit
  - X / FinTwit
  - Polymarket
- Store the Adanos API key locally in Chrome local storage.
- Minimal Chrome permissions: `storage`, `contextMenus`, and
  `https://api.adanos.org/*`.

## Links

- Adanos: https://adanos.org
- API docs: https://api.adanos.org/docs/
- Privacy policy: https://adanos.org/privacy

## Development

```bash
pnpm install
pnpm verify
```

## Load Locally

1. Run `pnpm build`.
2. Open `chrome://extensions`.
3. Enable developer mode.
4. Click `Load unpacked`.
5. Select the generated `dist/` folder.

## Chrome Web Store Positioning

Single purpose: show stock market sentiment for selected tickers while browsing.

This extension does not collect browsing history, does not inject ads, does not
ship analytics, and does not execute remotely hosted JavaScript.

## Disclaimer

Adanos Sentiment Lens provides market sentiment data for research purposes only.
It is not financial advice.
