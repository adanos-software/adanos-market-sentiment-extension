import { saveContextTicker } from "./storage";
import { normalizeTicker } from "./tickers";

const MENU_ID = "adanos-check-sentiment";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    contexts: ["selection"],
    id: MENU_ID,
    title: "Check Adanos sentiment",
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;

  const ticker = normalizeTicker(info.selectionText);
  if (!ticker) return;

  await saveContextTicker(ticker);
  await chrome.windows.create({
    focused: true,
    height: 640,
    type: "popup",
    url: chrome.runtime.getURL("popup.html"),
    width: 420,
  });
});

