export interface Range {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface EditOperation {
  range: Range;
  text: string;
}

export interface EditorAdapter {
  name: string;
  isCompatible(): boolean;
  getSourceCode(): Promise<string>;
  getCursorOffset(): Promise<number>;
  insertCode(offset: number, code: string): Promise<boolean>;
  replaceRange(startOffset: number, endOffset: number, text: string): Promise<boolean>;
  onChange(callback: (code: string, languageId?: string) => void): () => void;
  getModelLanguageId?(): string;
}
