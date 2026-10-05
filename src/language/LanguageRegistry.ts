import type { LanguageAdapter } from './LanguageAdapter';
import { JavaAdapter } from './java/JavaAdapter';
import { CppAdapter } from './cpp/CppAdapter';
import { PythonAdapter } from './python/PythonAdapter';
import { JavaScriptAdapter } from './javascript/JavaScriptAdapter';
import { CSharpAdapter } from './csharp/CSharpAdapter';
import { GoAdapter } from './go/GoAdapter';

export class LanguageRegistry {
  private static adapters: Map<string, LanguageAdapter> = new Map([
    ['java', new JavaAdapter()],
    ['cpp', new CppAdapter()],
    ['python', new PythonAdapter()],
    ['javascript', new JavaScriptAdapter()],
    ['csharp', new CSharpAdapter()],
    ['go', new GoAdapter()]
  ]);

  public static getAdapter(langId: string): LanguageAdapter {
    const id = langId.toLowerCase();
    return this.adapters.get(id) || this.adapters.get('java')!;
  }
}
