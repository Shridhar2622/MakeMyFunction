export class LanguageDetector {
  public static normalizeLanguageId(rawLang: string): string {
    if (!rawLang) return 'unknown';
    const lang = rawLang.toLowerCase().trim();
    if (lang === 'python' || lang === 'python3' || lang === 'py') return 'python';
    if (lang === 'java') return 'java';
    if (lang === 'cpp' || lang === 'c++' || lang === 'c') return 'cpp';
    if (lang === 'javascript' || lang === 'typescript' || lang === 'js' || lang === 'ts') return 'javascript';
    if (lang === 'csharp' || lang === 'cs' || lang === 'c#') return 'csharp';
    if (lang === 'go' || lang === 'golang') return 'go';
    return lang;
  }

  /**
   * Automatically detects the programming language of source code based on Monaco modelLanguageId or structural syntax patterns.
   */
  public static detectLanguage(code: string, modelLanguageId?: string): string {
    // 1. Primary Source of Truth: Monaco model language ID if provided
    if (modelLanguageId) {
      const normalized = this.normalizeLanguageId(modelLanguageId);
      if (normalized !== 'unknown') {
        return normalized;
      }
    }

    const trimmed = code.trim();
    if (!trimmed) return 'unknown';

    // C++ indicators
    if (trimmed.includes('#include') || trimmed.includes('using namespace std;') || trimmed.includes('vector<') || trimmed.includes('std::')) {
      return 'cpp';
    }

    // Python indicators (including LeetCode Python class header e.g. class Solution(object):)
    if (
      trimmed.includes('def ') ||
      trimmed.includes('class Solution(object):') ||
      trimmed.includes('class Solution:') ||
      (trimmed.includes('import ') && trimmed.includes(':')) ||
      (trimmed.includes('print(') && !trimmed.includes(';'))
    ) {
      return 'python';
    }

    // Go indicators
    if (trimmed.includes('func ') || trimmed.includes('package ') || trimmed.includes('import (')) {
      return 'go';
    }

    // C# indicators
    if (trimmed.includes('using System;') || trimmed.includes('Console.WriteLine') || trimmed.includes('namespace ')) {
      return 'csharp';
    }

    // JavaScript / TypeScript indicators
    if (trimmed.includes('function ') || trimmed.includes('console.log') || trimmed.includes('const ') || trimmed.includes('let ')) {
      return 'javascript';
    }

    // Java indicators
    if (trimmed.includes('public class ') || trimmed.includes('class Solution {') || trimmed.includes('System.out.println') || trimmed.includes('ArrayList<')) {
      return 'java';
    }

    return 'unknown';
  }
}
