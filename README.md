# MakeMyFunction 🚀

> **Automatically generate missing function/method definitions in LeetCode & web code editors as you type.**

**MakeMyFunction** is a lightweight, zero-configuration browser extension (Manifest V3) built for competitive coders, software developers, and LeetCode problem solvers.

When you write a call to a function that doesn't exist yet—like `dfs(0, adj, hasApple, -1);` or `if (contains(words[i], x))`—**MakeMyFunction** automatically analyzes your code context, infers parameter types and return types, and inserts the missing function definition cleanly into your solution class.

---

## 🌟 Key Features

1. **⚡ 100% Automatic & Zero-Click**:
   - No popups, no buttons, no manual copy-pasting. Just code naturally.
   - Intelligent 800ms trailing-edge debounce ensures active typing is never interrupted.

2. **🎯 Context-Aware Type Inference**:
   - **Parameter Types**: Primitives (`int`, `double`, `boolean`, `char`), String literals (`"hello"` $\rightarrow$ `String`), String expressions (`words[i]` $\rightarrow$ `String`), Enclosing method parameters (`findWordsContaining(String[] words, char x)` $\rightarrow$ `contains(x)` infers `char x`), Generic collections (`List<Boolean>`, `ArrayList<ArrayList<Integer>>`), and Arrays (`int[]`, `String[]`).
   - **Return Types**: Explicit assignments (`int x = dfs()`), Boolean conditions (`if (dfs())`, `while (dfs())`), Return statements (`return dfs()`), and Standalone expressions (`dfs();` $\rightarrow$ `void`).

3. **🛡️ Smart Object Method Call Filtering**:
   - Standard member method calls (`s1.charAt(i)`, `list.add(x)`, `Math.max(a, b)`, `System.out.println()`) and constructor instantiations (`new StringBuilder()`, `new ArrayList<>()`) are automatically recognized and ignored. Zero noise!

4. **👤 User Ownership & Parameter Memory**:
   - Your code is sacred. If you edit a generated parameter name (e.g., `arg1` $\rightarrow$ `word` or `cur`), **MakeMyFunction remembers your rename** and will **NEVER** overwrite it.
   - Function bodies are preserved byte-for-byte during signature updates.

5. **🧹 Unreferenced Function Cleanup**:
   - Automatically cleans up auto-generated functions when their last originating call site is deleted, while **never** touching user-written functions.

6. **🔒 100% Local & Offline Privacy**:
   - Runs 100% locally in your browser memory via lightweight AST parsing. Zero code is sent to external servers or AI endpoints.

---

## 🛠️ Supported Languages & Editors

- **Languages**: Java, C++, Python, JavaScript / TypeScript, C#, Go.
- **Platforms**: LeetCode (Monaco Editor) & Generic Browser Textareas.

---

## 📦 How to Install in Your Browser

### Step 1: Clone & Build the Project

```bash
# Clone the repository
git clone https://github.com/Shridhar2622/MakeMyFunction.git
cd MakeMyFunction

# Install dependencies
npm install

# Build the extension production bundle
npm run build
```

This creates a compiled standalone [`dist`](dist) directory containing the extension scripts and assets.

---

### Step 2: Load into Browser

#### 🌐 Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the [`dist`](dist) folder inside this project directory.

#### 🌊 Microsoft Edge
1. Open Edge and navigate to `edge://extensions/`.
2. Enable **Developer mode** in the left sidebar (or top-right).
3. Click the **Load unpacked** button.
4. Select the [`dist`](dist) folder inside this project directory.

#### 🦁 Brave Browser
1. Open Brave and navigate to `brave://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the [`dist`](dist) folder.

---

## 🧪 Running Unit Tests

```bash
npm test
```

The test suite runs 50+ comprehensive regression tests verifying:
- Parameter and return type inference across Java, C++, Python, JS, C#, and Go.
- Preserving manual parameter renames (`arg1` $\rightarrow$ `word`).
- Dynamic argument updates (`s(asa, "hello")` $\rightarrow$ `s(asa)`).
- Filtering statement keywords (`return (open == 0)`, `throw (err)`).
- Filtering object method calls (`s1.charAt(i)`) and `new` constructors.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check out the [issues page](https://github.com/Shridhar2622/MakeMyFunction/issues).

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
