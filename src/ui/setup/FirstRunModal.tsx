import React from 'react';
import { Check } from 'lucide-react';

interface FirstRunModalProps {
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
}

const LANGUAGES = [
  { id: 'java', name: 'Java', badge: 'V1 Complete' },
  { id: 'cpp', name: 'C++', badge: 'Architected' },
  { id: 'python', name: 'Python', badge: 'Architected' },
  { id: 'javascript', name: 'JavaScript', badge: 'Architected' },
  { id: 'csharp', name: 'C#', badge: 'Architected' },
  { id: 'go', name: 'Go', badge: 'Architected' }
];

export const FirstRunModal: React.FC<FirstRunModalProps> = ({ selectedLanguage, onSelectLanguage }) => {
  return (
    <div style={{ padding: '12px 0' }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
        Which language do you use?
      </h2>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
        MakeMyFunction will automatically infer types and generate boilerplate functions for your code.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {LANGUAGES.map((lang) => {
          const isSelected = selectedLanguage === lang.id;
          return (
            <button
              key={lang.id}
              onClick={() => onSelectLanguage(lang.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                border: isSelected ? '1px solid var(--primary-accent)' : '1px solid var(--card-border)',
                background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: isSelected ? 600 : 400,
                transition: 'all 0.15s ease'
              }}
            >
              <span>{lang.name}</span>
              {isSelected ? <Check size={14} color="var(--primary-accent)" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};
