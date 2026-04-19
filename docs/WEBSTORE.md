# Chrome Web Store Submission Notes

## Listing

Name: Adanos Sentiment Lens

Short description:

> Instant stock market sentiment from News, Reddit, X and Polymarket for selected tickers.

Single purpose:

> Show stock market sentiment for selected tickers while browsing.

## Long Description Draft

Adanos Sentiment Lens helps investors, analysts, and market researchers check
stock sentiment directly from Chrome.

Highlight a ticker such as `NVDA`, `TSLA`, or `$AAPL`, right-click, and choose
`Check Adanos sentiment`. You can also open the extension popup and compare a
watchlist of up to 10 stock tickers.

Supported sentiment sources:

- News
- Reddit
- X / FinTwit
- Polymarket

The extension shows sentiment score, buzz score, trend, source-specific activity
metrics, and bullish / bearish percentages when available from the Adanos Market
Sentiment API.

Your Adanos API key is stored locally in Chrome local storage and is only sent to
`https://api.adanos.org` when you request a sentiment lookup.

Learn more: https://adanos.org

API docs: https://api.adanos.org/docs/

Disclaimer: This extension provides market sentiment data for research purposes
only. It is not financial advice.

## Store URLs

- Developer website: https://adanos.org
- Privacy policy: https://adanos.org/privacy
- Support URL: https://adanos.org/contact

## Permissions Justification

- `storage`: saves the API key, source preference, analysis period, and watchlist.
- `contextMenus`: adds the right-click ticker lookup action for selected text.
- `https://api.adanos.org/*`: calls the Adanos Market Sentiment API.

## Review Guardrails

- Manifest V3 only.
- No remote JavaScript.
- No analytics.
- No browsing-history permission.
- No broad host permission.
- No ad injection.
- No page-content collection.
