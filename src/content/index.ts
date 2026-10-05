import { MakeMyFunctionEngine } from '../core/MakeMyFunctionEngine';
import { LeetCodeAdapter } from '../editor/LeetCodeAdapter';
import { GenericEditorAdapter } from '../editor/GenericEditorAdapter';
import { StorageManager } from '../state/StorageManager';
import type { ExtensionSettings } from '../types/state';

console.log('[MakeMyFunction] Content script initialized.');

function injectMainWorldBridge() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('mainWorldBridge.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
    console.log('[MakeMyFunction] Main world bridge script element injected.');
  } catch (err) {
    console.warn('[MakeMyFunction] Failed to inject main world script:', err);
  }
}

injectMainWorldBridge();

const isLeetCode = window.location.hostname.includes('leetcode.com');
const editorAdapter = isLeetCode ? new LeetCodeAdapter() : new GenericEditorAdapter();

// Initialize engine immediately so listening starts without async delay
const engine = new MakeMyFunctionEngine(editorAdapter, 'java');
engine.startListening();

// Update engine settings asynchronously once storage is read
StorageManager.getSettings().then((settings) => {
  if (settings && settings.preferredLanguage) {
    engine.setSelectedLanguage(settings.preferredLanguage);
  }

  // Listen for storage changes when user updates language in UI popup
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.mmf_settings && changes.mmf_settings.newValue) {
        const updatedSettings = changes.mmf_settings.newValue as ExtensionSettings;
        engine.setSelectedLanguage(updatedSettings.preferredLanguage);
      }
    });
  }
});

// Respond to Popup UI status queries
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request && request.action === 'GET_ENGINE_STATUS') {
      editorAdapter.getSourceCode().then((code) => {
        const modelLang = (editorAdapter as any).getModelLanguageId?.() || '';
        const detected = engine.getStatus(code, modelLang);
        sendResponse({
          active: detected.active,
          adapterName: editorAdapter.name,
          selectedLanguage: detected.selectedLanguage,
          detectedLanguage: detected.detectedLanguage,
          modelLanguageId: modelLang,
          isLeetCode: isLeetCode,
          tabTitle: document.title
        });
      });
      return true; // Keep message channel open for async sendResponse
    }
  });
}
