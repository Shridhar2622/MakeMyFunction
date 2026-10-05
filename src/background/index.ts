// Service Worker Background Script for Chrome Extension
console.log('[MakeMyFunction] Background service worker initialized.');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[MakeMyFunction] Extension installed successfully.');
});

// Listener for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message: { type?: string }, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'PONG', time: new Date().toISOString() });
  }
  return true;
});
