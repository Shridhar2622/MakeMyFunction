import type { EditorAdapter } from '../types/editor';

export class LeetCodeAdapter implements EditorAdapter {
  public name = 'LeetCodeAdapter';
  private currentLanguageId = '';

  public isCompatible(): boolean {
    return window.location.hostname.includes('leetcode.com');
  }

  public getModelLanguageId(): string {
    return this.currentLanguageId;
  }

  public async getSourceCode(): Promise<string> {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(2);

      const handler = (event: MessageEvent) => {
        if (event.data && event.data.source === 'MMF_MAIN_WORLD' && event.data.requestId === requestId) {
          window.removeEventListener('message', handler);
          if (event.data.languageId) {
            this.currentLanguageId = event.data.languageId;
          }
          resolve(event.data.code || '');
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({ source: 'MMF_CONTENT_SCRIPT', action: 'GET_SOURCE_CODE', requestId }, '*');

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve('');
      }, 500);
    });
  }

  public async getCursorOffset(): Promise<number> {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(2);

      const handler = (event: MessageEvent) => {
        if (event.data && event.data.source === 'MMF_MAIN_WORLD' && event.data.requestId === requestId) {
          window.removeEventListener('message', handler);
          resolve(event.data.offset || 0);
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({ source: 'MMF_CONTENT_SCRIPT', action: 'GET_CURSOR_OFFSET', requestId }, '*');

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(0);
      }, 500);
    });
  }

  public async insertCode(offset: number, code: string): Promise<boolean> {
    return this.replaceRange(offset, offset, code);
  }

  public async replaceRange(startOffset: number, endOffset: number, text: string): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(2);

      const handler = (event: MessageEvent) => {
        if (event.data && event.data.source === 'MMF_MAIN_WORLD' && event.data.requestId === requestId) {
          window.removeEventListener('message', handler);
          resolve(event.data.success || false);
        }
      };

      window.addEventListener('message', handler);
      window.postMessage(
        {
          source: 'MMF_CONTENT_SCRIPT',
          action: 'EXECUTE_EDIT',
          requestId,
          payload: { startOffset, endOffset, text }
        },
        '*'
      );

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(false);
      }, 500);
    });
  }

  public onChange(callback: (code: string, languageId?: string) => void): () => void {
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.source === 'MMF_MAIN_WORLD' && event.data.action === 'ON_CODE_CHANGE') {
        if (event.data.languageId) {
          this.currentLanguageId = event.data.languageId;
        }
        callback(event.data.code, event.data.languageId);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }
}
