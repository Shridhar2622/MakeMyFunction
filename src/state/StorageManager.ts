import type { ExtensionSettings } from '../types/state';

const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  preferredLanguage: 'java',
  autoGenerate: true,
  sensitivityDebounceMs: 800
};

export class StorageManager {
  public static async getSettings(): Promise<ExtensionSettings> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['mmf_settings'], (result) => {
          if (result && result.mmf_settings) {
            resolve({ ...DEFAULT_SETTINGS, ...result.mmf_settings });
          } else {
            resolve(DEFAULT_SETTINGS);
          }
        });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    });
  }

  public static async saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ mmf_settings: updated }, () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
