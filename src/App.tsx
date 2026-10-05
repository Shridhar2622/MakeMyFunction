import React, { useState, useEffect } from 'react';
import { Code2, Zap, Globe, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StorageManager } from './state/StorageManager';
import type { ExtensionSettings } from './types/state';
import { FirstRunModal } from './ui/setup/FirstRunModal';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>({
    enabled: true,
    preferredLanguage: 'java',
    autoGenerate: true,
    sensitivityDebounceMs: 350
  });

  const [activeTabTitle, setActiveTabTitle] = useState<string>('Detecting context...');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('unknown');
  const [adapterName, setAdapterName] = useState<string>('LeetCodeAdapter');
  const [isLeetCode, setIsLeetCode] = useState<boolean>(true);

  useEffect(() => {
    StorageManager.getSettings().then((s) => setSettings(s));

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
        if (tabs[0] && tabs[0].id) {
          const title = tabs[0].title || 'LeetCode Editor';
          setActiveTabTitle(title);
          const isLC = (tabs[0].url && tabs[0].url.includes('leetcode.com')) || title.toLowerCase().includes('leetcode');
          setIsLeetCode(isLC);
          setAdapterName(isLC ? 'LeetCodeAdapter' : 'Generic Adapter');

          chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_ENGINE_STATUS' }, (response) => {
            if (!chrome.runtime.lastError && response) {
              if (response.adapterName) setAdapterName(response.adapterName);
              if (typeof response.isLeetCode === 'boolean') setIsLeetCode(response.isLeetCode);
              if (response.detectedLanguage) setDetectedLanguage(response.detectedLanguage);
              if (response.tabTitle) setActiveTabTitle(response.tabTitle);
            }
          });
        }
      });
    } else {
      setActiveTabTitle('Generate Parentheses - LeetCode');
      setDetectedLanguage('python');
      setAdapterName('LeetCodeAdapter');
      setIsLeetCode(true);
    }
  }, []);

  const handleSelectLanguage = (lang: string) => {
    const updated = { ...settings, preferredLanguage: lang };
    setSettings(updated);
    StorageManager.saveSettings({ preferredLanguage: lang });
  };

  const toggleEnabled = () => {
    const nextState = !settings.enabled;
    const updated = { ...settings, enabled: nextState };
    setSettings(updated);
    StorageManager.saveSettings({ enabled: nextState });
  };

  const isMismatch = detectedLanguage !== 'unknown' && settings.preferredLanguage.toLowerCase() !== detectedLanguage.toLowerCase();

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="header">
        <div className="logo-group">
          <div className="icon-badge">
            <Code2 size={20} color="#fff" />
          </div>
          <div>
            <h1 className="title">MakeMyFunction</h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Multi-Language Auto Generator</p>
          </div>
        </div>
        <div className="status-tag">
          <span className="status-dot"></span>
          {settings.enabled ? 'Active' : 'Disabled'}
        </div>
      </div>

      {/* Language Mismatch Warning Banner */}
      {isMismatch && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={16} />
          <div>
            <strong>Language mismatch:</strong> Selected {settings.preferredLanguage.toUpperCase()}, but active editor is {detectedLanguage.toUpperCase()}.
          </div>
        </div>
      )}

      {/* Language Selector */}
      <div className="card">
        <FirstRunModal selectedLanguage={settings.preferredLanguage} onSelectLanguage={handleSelectLanguage} />
      </div>

      {/* Editor Status */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Globe size={16} color="var(--secondary-accent)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Detected Context</span>
        </div>
        <p
          style={{
            fontSize: '0.78rem',
            fontWeight: 500,
            color: 'var(--text-main)',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {activeTabTitle}
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              background: isLeetCode ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: isLeetCode ? '#34d399' : 'var(--text-muted)'
            }}
          >
            {adapterName === 'LeetCodeAdapter' ? 'LeetCode Adapter' : adapterName}
          </div>
          <div
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary-accent)'
            }}
          >
            Editor: {detectedLanguage.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Master Toggle */}
      <div className="card">
        <button className="btn-primary" onClick={toggleEnabled}>
          <Zap size={16} />
          {settings.enabled ? 'Disable Auto-Generation' : 'Enable Auto-Generation'}
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px'
        }}
      >
        <CheckCircle2 size={12} color="#34d399" />
        MakeMyFunction Engine Ready
      </div>
    </div>
  );
};

export default App;
