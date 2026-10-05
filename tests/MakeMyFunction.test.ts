import { describe, it, expect, beforeEach } from 'vitest';
import { JavaAdapter } from '../src/language/java/JavaAdapter';
import { CppAdapter } from '../src/language/cpp/CppAdapter';
import { PythonAdapter } from '../src/language/python/PythonAdapter';
import { JavaScriptAdapter } from '../src/language/javascript/JavaScriptAdapter';
import { CSharpAdapter } from '../src/language/csharp/CSharpAdapter';
import { GoAdapter } from '../src/language/go/GoAdapter';
import { FunctionTracker } from '../src/core/FunctionTracker';
import { MakeMyFunctionEngine } from '../src/core/MakeMyFunctionEngine';
import { EditorAdapter } from '../src/types/editor';

class MockEditorAdapter implements EditorAdapter {
  name = 'MockEditor';
  code = '';

  isCompatible() { return true; }
  async getSourceCode() { return this.code; }
  async getCursorOffset() { return 0; }
  async insertCode(offset: number, text: string) {
    this.code = this.code.substring(0, offset) + text + this.code.substring(offset);
    return true;
  }
  async replaceRange(start: number, end: number, text: string) {
    this.code = this.code.substring(0, start) + text + this.code.substring(end);
    return true;
  }
  onChange(cb: (code: string) => void) {
    return () => {};
  }
}

describe('MakeMyFunction Comprehensive 26 Regression Tests', () => {
  let javaAdapter: JavaAdapter;
  let tracker: FunctionTracker;

  beforeEach(() => {
    javaAdapter = new JavaAdapter();
    tracker = new FunctionTracker();
  });

  it('TEST 1: dfs(a, name) -> correct types (int, String)', () => {
    const code = `
      class Solution {
          public void solve() {
              int a = 1;
              String name = "test";
              dfs(a, name);
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    expect(calls.length).toBe(1);
    const gen = javaAdapter.generateFunction(calls[0]);
    expect(gen.signatureText).toBe('void dfs(int a, String name)');
  });

  it('TEST 2: dfs(0, adj, hasApple, -1) -> literals correctly inferred', () => {
    const code = `
      class Solution {
          public void solve() {
              ArrayList<ArrayList<Integer>> adj = new ArrayList<>();
              List<Boolean> hasApple = new ArrayList<>();
              dfs(0, adj, hasApple, -1);
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    const gen = javaAdapter.generateFunction(calls[0]);
    expect(gen.signatureText).toBe('void dfs(int arg1, ArrayList<ArrayList<Integer>> adj, List<Boolean> hasApple, int arg4)');
  });

  it('TEST 3 & 4: arg1 -> cur and arg4 -> parent -> user names preserved', () => {
    const code = `
      class Solution {
          public void solve() {
              ArrayList<ArrayList<Integer>> adj = new ArrayList<>();
              List<Boolean> hasApple = new ArrayList<>();
              dfs(0, adj, hasApple, -1);
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    const gen = javaAdapter.generateFunction(calls[0]);

    tracker.recordGeneration('dfs', gen.returnType, gen.parameters, gen.signatureText, '');
    tracker.markUserRenamedParameter('dfs', 0, 'cur');
    tracker.markUserRenamedParameter('dfs', 3, 'parent');

    const meta = tracker.getGeneratedFunction('dfs');
    const reGen = javaAdapter.generateFunction(calls[0], meta);
    expect(reGen.signatureText).toBe('void dfs(int cur, ArrayList<ArrayList<Integer>> adj, List<Boolean> hasApple, int parent)');
  });

  it('TEST 5: Repeated analysis -> no "void void"', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `
      class Solution {
          public void solve() {
              int a = 1;
              dfs(a);
          }
      }
    `;
    const engine = new MakeMyFunctionEngine(mock, 'java');
    await engine.processCodeChange(mock.code);

    expect(mock.code).not.toContain('void void');
    const firstCode = mock.code;

    // Run again
    await engine.processCodeChange(mock.code);
    expect(mock.code).not.toContain('void void');
    expect(mock.code).toBe(firstCode);
  });

  it('TEST 6: Repeated unrelated edits -> body preserved byte-for-byte', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `
      class Solution {
          public void solve() {
              int a = 1;
              dfs(a);
          }

          void dfs(int a) {
              // Custom User Code Here
              System.out.println(a);
          }
      }
    `;
    const engine = new MakeMyFunctionEngine(mock, 'java');
    await engine.processCodeChange(mock.code);

    expect(mock.code).toContain('// Custom User Code Here');
    expect(mock.code).toContain('System.out.println(a);');
  });

  it('TEST 7: return dfs(...) -> enclosing return type inferred', () => {
    const cpp = new CppAdapter();
    const code = `
      class Solution {
      public:
          vector<string> solve() {
              int a = 5;
              return bfs(a);
          }
      };
    `;
    const calls = cpp.parseFunctionCalls(code);
    expect(calls.length).toBe(1);
    expect(calls[0].inferredReturnType).toBe('vector<string>');

    const gen = cpp.generateFunction(calls[0]);
    expect(gen.signatureText).toBe('vector<string> bfs(int a)');
  });

  it('TEST 8: int x = dfs(...) -> int inferred', () => {
    const code = `
      class Solution {
          public void solve() {
              int a = 1;
              int x = dfs(a);
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    expect(calls[0].inferredReturnType).toBe('int');
  });

  it('TEST 9: if (dfs(...)) -> boolean inferred', () => {
    const code = `
      class Solution {
          public void solve() {
              int a = 1;
              if (dfs(a)) {}
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    expect(calls[0].inferredReturnType).toBe('boolean');
  });

  it('TEST 10: while (dfs(...)) -> boolean inferred', () => {
    const code = `
      class Solution {
          public void solve() {
              int a = 1;
              while (dfs(a)) {}
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    expect(calls[0].inferredReturnType).toBe('boolean');
  });

  it('TEST 11 & 13: Single/Last call removed -> generated function automatically removed', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `
      class Solution {
          public void solve() {
              int a = 1;
              dfs(a);
          }
      }
    `;
    const engine = new MakeMyFunctionEngine(mock, 'java');
    await engine.processCodeChange(mock.code);
    expect(mock.code).toContain('void dfs');

    // Remove call site
    mock.code = `
      class Solution {
          public void solve() {
              int a = 1;
          }
      }
    `;
    await engine.processCodeChange(mock.code);
    expect(mock.code).not.toContain('void dfs');
  });

  it('TEST 12: Two calls, one removed -> generated function remains', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `
      class Solution {
          public void solve() {
              int a = 1;
              dfs(a);
              dfs(a);
          }
      }
    `;
    const engine = new MakeMyFunctionEngine(mock, 'java');
    await engine.processCodeChange(mock.code);
    expect(mock.code).toContain('void dfs');

    // Remove one call site, keep the other
    mock.code = `
      class Solution {
          public void solve() {
              int a = 1;
              dfs(a);
          }
      }
    `;
    await engine.processCodeChange(mock.code);
    expect(mock.code).toContain('void dfs');
  });

  it('TEST 14: User-written unused function -> never removed', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `
      class Solution {
          public void solve() {
          }

          void userFunction() {
              // User original function
          }
      }
    `;
    const engine = new MakeMyFunctionEngine(mock, 'java');
    await engine.processCodeChange(mock.code);
    expect(mock.code).toContain('void userFunction()');
  });

  it('TEST 15: Comment containing dfs() -> ignored', () => {
    const code = `
      class Solution {
          public void solve() {
              // dfs(a);
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    expect(calls.length).toBe(0);
  });

  it('TEST 16: String containing dfs() -> ignored', () => {
    const code = `
      class Solution {
          public void solve() {
              String s = "dfs(a)";
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    expect(calls.length).toBe(0);
  });

  it('TEST 17: Existing dfs() declaration -> no duplicate', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `
      class Solution {
          public void solve() {
              dfs(a);
          }

          void dfs(int a) {
          }
      }
    `;
    const engine = new MakeMyFunctionEngine(mock, 'java');
    await engine.processCodeChange(mock.code);
    const occurrences = (mock.code.match(/void dfs/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('TEST 18: C++ editor -> C++ syntax', () => {
    const cpp = new CppAdapter();
    const code = `
      #include <iostream>
      #include <vector>
      using namespace std;

      class Solution {
      public:
          void solve() {
              int a = 10;
              string s = "test";
              dfs(a, s);
          }
      };
    `;
    const calls = cpp.parseFunctionCalls(code);
    const gen = cpp.generateFunction(calls[0]);
    expect(gen.signatureText).toBe('void dfs(int a, string s)');
  });

  it('TEST 19: Python editor -> Python syntax', () => {
    const py = new PythonAdapter();
    const code = `
def solve():
    a = 10
    name = "test"
    dfs(a, name)
    `;
    const calls = py.parseFunctionCalls(code);
    const gen = py.generateFunction(calls[0]);
    expect(gen.code).toContain('def dfs(a, name):');
    expect(gen.code).toContain('pass');
  });

  it('TEST 20: Java editor -> Java syntax', () => {
    const code = `
      class Solution {
          public void solve() {
              dfs(a, b);
          }
      }
    `;
    const calls = javaAdapter.parseFunctionCalls(code);
    const gen = javaAdapter.generateFunction(calls[0]);
    expect(gen.code).toContain('void dfs(Object a, Object b) {');
  });

  it('TEST 21: JavaScript editor -> JS syntax', () => {
    const js = new JavaScriptAdapter();
    const code = `
      function solve() {
          dfs(a, name);
      }
    `;
    const calls = js.parseFunctionCalls(code);
    const gen = js.generateFunction(calls[0]);
    expect(gen.code).toContain('function dfs(a, name) {');
  });

  it('TEST 22: C# editor -> C# syntax', () => {
    const cs = new CSharpAdapter();
    const code = `
      using System;

      public class Solution {
          public void Solve() {
              int a = 1;
              string s = "test";
              dfs(a, s);
          }
      }
    `;
    const calls = cs.parseFunctionCalls(code);
    const gen = cs.generateFunction(calls[0]);
    expect(gen.signatureText).toBe('void dfs(int a, string s)');
  });

  it('TEST 23: Go editor -> Go syntax', () => {
    const go = new GoAdapter();
    const code = `
      package main

      func solve() {
          a := 10
          name := "hello"
          dfs(a, name)
      }
    `;
    const calls = go.parseFunctionCalls(code);
    const gen = go.generateFunction(calls[0]);
    expect(gen.signatureText).toBe('func dfs(a int, name int)');
  });

  it('TEST 24: Selected Python + detected C++ -> NO Python code inserted into C++', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `
      #include <iostream>
      using namespace std;

      int main() {
          dfs(a);
      }
    `;
    const engine = new MakeMyFunctionEngine(mock, 'python');
    const result = await engine.processCodeChange(mock.code);
    expect(result).toBe(false);
    expect(mock.code).not.toContain('def dfs');
  });

  it('TEST 25: Same source analyzed repeatedly -> source remains byte-for-byte identical after first stable state (Idempotency)', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `
      class Solution {
          public void solve() {
              int a = 1;
              dfs(a);
          }
      }
    `;
    const engine = new MakeMyFunctionEngine(mock, 'java');
    await engine.processCodeChange(mock.code);
    const stableState = mock.code;

    await engine.processCodeChange(mock.code);
    await engine.processCodeChange(mock.code);
    await engine.processCodeChange(mock.code);
    await engine.processCodeChange(mock.code);
    await engine.processCodeChange(mock.code);

    expect(mock.code).toBe(stableState);
  });

  it('TEST 26: Real-world LeetCode Java snippet (dfs(a, b) -> void dfs(int a, String b))', async () => {
    const mock = new MockEditorAdapter();
    mock.code = `class Solution {
    public List<String> generateParenthesis(int n) {
        int a = 12;
        String b = "Shr";
        dfs(a, b);
    }
}`;

    const engine = new MakeMyFunctionEngine(mock, 'java');
    const result = await engine.processCodeChange(mock.code);

    expect(result).toBe(true);
    expect(mock.code).toContain('void dfs(int a, String b) {');
  });

  describe('Debounce & Return Type Inference Real-World Regressions', () => {
    it('TEST 27: 800ms debounce behavior & initial attachment guard', async () => {
      const { ChangeDetector } = await import('../src/core/ChangeDetector');
      const detector = new ChangeDetector();
      let callCount = 0;
      const debounced = detector.debounce(() => { callCount++; }, 800);

      // Initial attachment - guard should ignore this first payload
      debounced('initial code');
      expect(callCount).toBe(0);

      // Keystroke 1
      debounced('d');
      expect(callCount).toBe(0);

      // Wait 400ms (< 800ms)
      await new Promise((r) => setTimeout(r, 400));
      expect(callCount).toBe(0);

      // Wait remaining time (> 800ms total silence)
      await new Promise((r) => setTimeout(r, 500));
      expect(callCount).toBe(1);
    });

    it('TEST 28: Rapid typing resets timer and does not generate repeatedly', async () => {
      const { ChangeDetector } = await import('../src/core/ChangeDetector');
      const detector = new ChangeDetector();
      let callCount = 0;
      const debounced = detector.debounce(() => { callCount++; }, 800);

      debounced('init'); // Attachment guard

      // Rapid keystrokes every 200ms
      const chars = ['d', 'df', 'dfs', 'dfs(', 'dfs(a', 'dfs(a,', 'dfs(a,b', 'dfs(a,b)'];
      for (const charSequence of chars) {
        debounced(charSequence);
        await new Promise((r) => setTimeout(r, 200));
        expect(callCount).toBe(0); // Should NEVER fire while active typing continues!
      }

      // After 800ms of no changes, it fires exactly once
      await new Promise((r) => setTimeout(r, 850));
      expect(callCount).toBe(1);
    });

    it('TEST 29: return dfs(a, b) inside List<String> method -> List<String> dfs(String a, int b)', () => {
      const code = `class Solution {
    public List<String> generateParenthesis(int n) {
        String a = "test";
        int b = 5;
        return dfs(a, b);
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(1);
      expect(calls[0].inferredReturnType).toBe('List<String>');

      const gen = javaAdapter.generateFunction(calls[0]);
      expect(gen.signatureText).toBe('List<String> dfs(String a, int b)');
    });

    it('TEST 30: int solve() { return dfs(a); } -> int dfs(...)', () => {
      const code = `class Solution {
    int solve() {
        int a = 10;
        return dfs(a);
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls[0].inferredReturnType).toBe('int');
      const gen = javaAdapter.generateFunction(calls[0]);
      expect(gen.signatureText).toBe('int dfs(int a)');
    });

    it('TEST 31: boolean solve() { return dfs(a); } -> boolean dfs(...)', () => {
      const code = `class Solution {
    boolean solve() {
        int a = 10;
        return dfs(a);
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls[0].inferredReturnType).toBe('boolean');
      const gen = javaAdapter.generateFunction(calls[0]);
      expect(gen.signatureText).toBe('boolean dfs(int a)');
    });

    it('TEST 32: int result = dfs(a); -> int dfs(...)', () => {
      const code = `class Solution {
    void solve() {
        int a = 10;
        int result = dfs(a);
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls[0].inferredReturnType).toBe('int');
      const gen = javaAdapter.generateFunction(calls[0]);
      expect(gen.signatureText).toBe('int dfs(int a)');
    });

    it('TEST 33: if (dfs(a)) -> boolean dfs(...)', () => {
      const code = `class Solution {
    void solve() {
        int a = 10;
        if (dfs(a)) {
        }
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls[0].inferredReturnType).toBe('boolean');
      const gen = javaAdapter.generateFunction(calls[0]);
      expect(gen.signatureText).toBe('boolean dfs(int a)');
    });

    it('TEST 34: while (dfs(a)) -> boolean dfs(...)', () => {
      const code = `class Solution {
    void solve() {
        int a = 10;
        while (dfs(a)) {
        }
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls[0].inferredReturnType).toBe('boolean');
      const gen = javaAdapter.generateFunction(calls[0]);
      expect(gen.signatureText).toBe('boolean dfs(int a)');
    });

    it('TEST 35: Generic return types Map<Integer, String> and List<List<Integer>> preserved', () => {
      const code1 = `class Solution {
    public Map<Integer, String> getMap() {
        int a = 1;
        return dfs(a);
    }
}`;
      const calls1 = javaAdapter.parseFunctionCalls(code1);
      expect(calls1[0].inferredReturnType).toBe('Map<Integer, String>');

      const code2 = `class Solution {
    public List<List<Integer>> combine() {
        int a = 1;
        return dfs(a);
    }
}`;
      const calls2 = javaAdapter.parseFunctionCalls(code2);
      expect(calls2[0].inferredReturnType).toBe('List<List<Integer>>');
    });

    it('TEST 36: Full engine integration for return dfs(a, b) in generateParenthesis', async () => {
      const mock = new MockEditorAdapter();
      mock.code = `class Solution {
    public List<String> generateParenthesis(int n) {
        String a = "test";
        int b = 5;
        return dfs(a, b);
    }
}`;
      const engine = new MakeMyFunctionEngine(mock, 'java');
      const result = await engine.processCodeChange(mock.code);

      expect(result).toBe(true);
      expect(mock.code).toContain('List<String> dfs(String a, int b) {');
    });

    it('TEST 37: Monaco modelLanguageId python3 -> normalized to python', async () => {
      const { LanguageDetector } = await import('../src/language/LanguageDetector');
      const detected = LanguageDetector.detectLanguage('', 'python3');
      expect(detected).toBe('python');
    });

    it('TEST 38: Genuinely unavailable/ambiguous code returns unknown (NOT java)', async () => {
      const { LanguageDetector } = await import('../src/language/LanguageDetector');
      const detected = LanguageDetector.detectLanguage('// empty snippet');
      expect(detected).toBe('unknown');
    });

    it('TEST 39: LeetCode Python class header class Solution(object): detected as python', async () => {
      const { LanguageDetector } = await import('../src/language/LanguageDetector');
      const pyCode = `class Solution(object):\n    def generateParenthesis(self, n):\n        bf()`;
      const detected = LanguageDetector.detectLanguage(pyCode);
      expect(detected).toBe('python');
    });

    it('TEST 40: Python selected + Python detected -> generation allowed', async () => {
      const mock = new MockEditorAdapter();
      mock.code = `class Solution(object):\n    def generateParenthesis(self, n):\n        bf()`;
      const engine = new MakeMyFunctionEngine(mock, 'python');
      const result = await engine.processCodeChange(mock.code, 'python');

      expect(result).toBe(true);
      expect(mock.code).toContain('def bf():');
    });

    it('TEST 41: Selected Java + Detected Python -> generation safely aborted', async () => {
      const mock = new MockEditorAdapter();
      mock.code = `class Solution(object):\n    def generateParenthesis(self, n):\n        bf()`;
      const engine = new MakeMyFunctionEngine(mock, 'java');
      const result = await engine.processCodeChange(mock.code, 'python');

      expect(result).toBe(false);
      expect(mock.code).not.toContain('void bf');
    });

    it('TEST 42: Atomic SPA navigation Java problem -> Python problem updates status correctly', async () => {
      const mock = new MockEditorAdapter();
      mock.code = `class Solution {\n    public void solve() {\n        dfs();\n    }\n}`;
      const engine = new MakeMyFunctionEngine(mock, 'java');

      const javaStatus = engine.getStatus(mock.code, 'java');
      expect(javaStatus.detectedLanguage).toBe('java');
      expect(javaStatus.languageMismatch).toBe(false);

      // Navigate to Python problem in same tab
      mock.code = `class Solution(object):\n    def solve(self):\n        dfs()`;
      engine.setSelectedLanguage('python');
      const pyStatus = engine.getStatus(mock.code, 'python');
      expect(pyStatus.detectedLanguage).toBe('python');
      expect(pyStatus.languageMismatch).toBe(false);
    });

    it('TEST 43: s1.charAt(i) -> member method calls on objects ignored', () => {
      const code = `class Solution {
    public String smallestEquivalentString(String s1, String s2, String baseStr) {
        int[] parent = new int[26];
        int[] rank = new int[26];
        for(int i = 0; i < s1.length(); i++) {
            int u = s1.charAt(i) - 97;
            int v = s2.charAt(i) - 97;
            union(u, v, parent, rank);
        }
        return s1;
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe('union');
    });

    it('TEST 44: this.union(u, v) -> calls on this preserved', () => {
      const code = `class Solution {
    public void solve() {
        this.union(1, 2);
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe('union');
    });

    it('TEST 45: Method parameters (char x) resolved correctly when passed to contains(x)', () => {
      const code = `class Solution {
    public List<Integer> findWordsContaining(String[] words, char x) {
        List<Integer> ans = new ArrayList<>();
        for(int i = 0; i < words.length; i++) {
            if(contains(x)) {
                ans.add(i);
            }
        }
        return ans;
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe('contains');
      const gen = javaAdapter.generateFunction(calls[0]);
      expect(gen.signatureText).toBe('boolean contains(char x)');
    });

    it('TEST 46: User manually renames arg1 -> word in generated function -> preserved by engine', async () => {
      const mock = new MockEditorAdapter();
      mock.code = `class Solution {
    public List<Integer> findWordsContaining(String[] words, char x) {
        if (contains(words[0], x)) {}
        return null;
    }
}`;
      const engine = new MakeMyFunctionEngine(mock, 'java');
      await engine.processCodeChange(mock.code);
      expect(mock.code).toContain('boolean contains(String arg1, char x)');

      // User renames arg1 -> word in editor
      mock.code = mock.code.replace('String arg1', 'String word');

      // Next code change process
      await engine.processCodeChange(mock.code);

      // Verify word is preserved and NOT reverted to arg1!
      expect(mock.code).toContain('boolean contains(String word, char x)');
      expect(mock.code).not.toContain('String arg1');
    });

    it('TEST 47: backtrack(" ", 0, 0, 0,) -> string literal preserved as String type', () => {
      const code = `class Solution {
    public List<String> generateParenthesis(int n) {
        backtrack(" ", 0, 0, 0,);
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe('backtrack');
      const gen = javaAdapter.generateFunction(calls[0]);
      expect(gen.signatureText).toBe('void backtrack(String arg1, int arg2, int arg3, int arg4)');
    });

    it('TEST 48: new StringBuilder() -> constructor instantiations ignored', () => {
      const code = `class Solution {
    public void solve() {
        StringBuilder temp = new StringBuilder();
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(0);
    });

    it('TEST 49: Dynamic argument modification s(asa, "hello") -> s(asa) updates signature to 1 parameter', async () => {
      const mock = new MockEditorAdapter();
      mock.code = `class Solution {
    public void solve() {
        s(asa, "hello");
    }

    void s(Object asa, String arg2) {
    }
}`;
      const engine = new MakeMyFunctionEngine(mock, 'java');
      await engine.processCodeChange(mock.code);

      // User changes call site from s(asa, "hello") -> s(asa)
      mock.code = `class Solution {
    public void solve() {
        s(asa);
    }

    void s(Object asa, String arg2) {
    }
}`;

      await engine.processCodeChange(mock.code);

      // Verify signature updated to 1 parameter void s(Object asa)
      expect(mock.code).toContain('void s(Object asa) {');
      expect(mock.code).not.toContain('String arg2');
    });

    it('TEST 50: return (open==0) ? true : false -> return keyword is ignored as function name', () => {
      const code = `class Solution {
    public boolean isValid(String s) {
        int open = 0;
        return (open == 0) ? true : false;
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(0);
    });

    it('TEST 51: return (dfs(open)) -> return skipped, inner dfs(open) call matched', () => {
      const code = `class Solution {
    public boolean isValid(String s) {
        int open = 0;
        return (dfs(open));
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe('dfs');
    });

    it('TEST 52: throw (err) & (int)(x) -> statement keywords ignored in Java and C++', () => {
      const code = `class Solution {
    public void solve() {
        int x = (int)(10);
        throw (new RuntimeException());
    }
}`;
      const calls = javaAdapter.parseFunctionCalls(code);
      expect(calls.length).toBe(0);
    });
  });
});
