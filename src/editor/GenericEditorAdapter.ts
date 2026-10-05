import type { EditorAdapter } from '../types/editor';

export class GenericEditorAdapter implements EditorAdapter {
  public name = 'GenericEditorAdapter';

  public isCompatible(): boolean {
    return true; // Generic fallback
  }

  private getActiveTextarea(): HTMLTextAreaElement | null {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === 'TEXTAREA') {
      return activeEl as HTMLTextAreaElement;
    }
    const textareas = document.querySelectorAll('textarea');
    return textareas.length > 0 ? (textareas[0] as HTMLTextAreaElement) : null;
  }

  public async getSourceCode(): Promise<string> {
    const el = this.getActiveTextarea();
    return el ? el.value : '';
  }

  public async getCursorOffset(): Promise<number> {
    const el = this.getActiveTextarea();
    return el ? el.selectionStart : 0;
  }

  public async insertCode(offset: number, code: string): Promise<boolean> {
    return this.replaceRange(offset, offset, code);
  }

  public async replaceRange(startOffset: number, endOffset: number, text: string): Promise<boolean> {
    const el = this.getActiveTextarea();
    if (!el) return false;

    const val = el.value;
    el.value = val.substring(0, startOffset) + text + val.substring(endOffset);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  public onChange(callback: (code: string) => void): () => void {
    const handler = () => {
      this.getSourceCode().then((code) => callback(code));
    };

    document.addEventListener('input', handler);
    return () => document.removeEventListener('input', handler);
  }
}
