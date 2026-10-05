# MakeMyFunction — Chrome Web Store Production Listing Content

## 1. Basic Metadata
- **Extension Name**: MakeMyFunction
- **Tagline / Summary**: Automatically generate missing functions while you code.
- **Category**: Developer Tools / Productivity
- **Language**: English
- **Version**: 1.0.0

---

## 2. Short Description (Max 132 Characters)
Automatically generate missing function definitions in LeetCode & web code editors as you type. Zero setup required.

---

## 3. Detailed Store Description

**MakeMyFunction** is a lightweight, zero-configuration browser extension built for programmers, competitive coders, and LeetCode problem solvers. 

When you write a call to a function that doesn't exist yet—like `dfs(a, b);`—MakeMyFunction automatically analyzes your code context, infers the parameter types and return type, and inserts the missing function definition cleanly into your code.

### 🌟 Key Features

- **⚡ 100% Automatic Generation**: No buttons to click, no popups to open, and no templates to copy/paste. Just code naturally.
- **🎯 Context-Aware Type Inference**:
  - Infers parameter types from variables, numeric/string literals, expressions, and generic collections (e.g. `List<Boolean>`, `ArrayList<ArrayList<Integer>>`).
  - Infers return types from explicit assignments (`int res = dfs(a);`), boolean conditions (`if (dfs(a))`, `while (dfs(a))`), and return statements (`return dfs(a);`).
- **🛡️ Smart User Ownership**:
  - **User Body Preservation**: MakeMyFunction only updates the method signature when call sites change. Your custom function body is preserved byte-for-byte.
  - **Parameter Rename Memory**: If you rename generated parameters (e.g., `arg1` -> `cur`, `arg4` -> `parent`), your custom names are remembered and never overwritten.
- **⏱️ Intelligent Trailing-Edge Debounce**:
  - Uses an internal 800ms trailing-edge debounce. Active typing will never trigger premature generation until you pause.
- **🧹 Unreferenced Function Cleanup**:
  - Automatically cleans up auto-generated functions when their last originating call site is deleted, while **never** touching user-written functions.
- **🔒 100% Local & Private**:
  - Runs entirely within your browser using AST pattern analysis. Zero code is sent to external servers or AI endpoints.

---

## 4. Supported Languages
- **Java**: Full structural AST parsing, generic return type inference (`List<String>`, `Map<K,V>`), parameter type resolution.
- **C++**: Function header and call site inference with C++ types (`std::vector`, `string`).
- **Python**: Function header generation (`def dfs(a, b):`).
- **JavaScript / TypeScript**: Function definition and parameter inference.
- **C#**: Generic type resolution and method signature generation.
- **Go**: Function declaration and signature generation.

---

## 5. Supported Editors & Web Platforms
- **LeetCode**: Built-in adapter for LeetCode Monaco editor.
- **Generic Editors**: Fallback support for standard browser textareas and web editors.

---

## 6. Privacy Statement
MakeMyFunction operates 100% locally on your machine. It does not send source code, telemetry, or user data to any external server or API.

---

## 7. Permissions Justification

| Permission | Reason / Justification |
| :--- | :--- |
| `storage` | Required to persist your preferred language setting (e.g., Java vs C++) across browser sessions. |

*Zero host permissions or broad network permissions are requested.*
