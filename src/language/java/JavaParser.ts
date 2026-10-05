import type { Scope, FunctionCallInfo, FunctionDefinitionInfo, ExpressionArg, ParameterInfo } from '../../types/ast';

export class JavaParser {
  /**
   * Sanitizes code by replacing string literals and comments with whitespace of equal length
   * to preserve line/column offsets while ignoring code inside comments & strings.
   */
  public sanitizeCode(code: string): string {
    let sanitized = '';
    let i = 0;
    const len = code.length;

    while (i < len) {
      // Single line comment
      if (code[i] === '/' && code[i + 1] === '/') {
        sanitized += '  ';
        i += 2;
        while (i < len && code[i] !== '\n' && code[i] !== '\r') {
          sanitized += ' ';
          i++;
        }
      }
      // Multi line comment
      else if (code[i] === '/' && code[i + 1] === '*') {
        sanitized += '  ';
        i += 2;
        while (i < len - 1 && !(code[i] === '*' && code[i + 1] === '/')) {
          sanitized += code[i] === '\n' ? '\n' : ' ';
          i++;
        }
        if (i < len - 1) {
          sanitized += '  ';
          i += 2;
        }
      }
      // String literal
      else if (code[i] === '"') {
        sanitized += ' ';
        i++;
        while (i < len && code[i] !== '"') {
          if (code[i] === '\\' && i + 1 < len) {
            sanitized += '  ';
            i += 2;
          } else {
            sanitized += code[i] === '\n' ? '\n' : ' ';
            i++;
          }
        }
        if (i < len) {
          sanitized += ' ';
          i++;
        }
      }
      // Char literal
      else if (code[i] === "'") {
        sanitized += ' ';
        i++;
        while (i < len && code[i] !== "'") {
          if (code[i] === '\\' && i + 1 < len) {
            sanitized += '  ';
            i += 2;
          } else {
            sanitized += ' ';
            i++;
          }
        }
        if (i < len) {
          sanitized += ' ';
          i++;
        }
      } else {
        sanitized += code[i];
        i++;
      }
    }

    return sanitized;
  }

  /**
   * Parse Java class structure and scopes
   */
  public parseScopesAndSymbols(code: string): Scope[] {
    const cleanCode = this.sanitizeCode(code);
    const globalScope: Scope = { id: 'scope_global', symbols: new Map() };
    const scopes: Scope[] = [globalScope];
    const scopeStack: Scope[] = [globalScope];

    // 1. Register parameters from existing function definitions
    const existingFuncs = this.parseExistingFunctions(code);
    for (const func of existingFuncs) {
      for (const param of func.parameters) {
        if (param.name && param.type) {
          globalScope.symbols.set(param.name, param.type);
        }
      }
    }

    // 2. Register variable declarations (e.g. List<Integer> ans = ...)
    const declPattern = /(?:((?:public|private|protected|static|final)\s+)*)(?:([a-zA-Z_$][a-zA-Z0-9_$<>\s,?[\]]*?))\s+([a-zA-Z_$][a-zA-Z0-9_$\s,]*?)(?:\s*=[^;]+)?;/g;

    let match: RegExpExecArray | null;
    while ((match = declPattern.exec(cleanCode)) !== null) {
      const typeStr = match[2].trim();
      const varsStr = match[3].trim();

      if (['return', 'class', 'interface', 'enum', 'import', 'package', 'new', 'throw', 'if', 'while', 'for', 'else'].includes(typeStr)) {
        continue;
      }

      const varNames = varsStr.split(',').map((v) => {
        const eqIdx = v.indexOf('=');
        return (eqIdx !== -1 ? v.substring(0, eqIdx) : v).trim();
      });

      const currentScope = scopeStack[scopeStack.length - 1];
      for (const varName of varNames) {
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(varName)) {
          currentScope.symbols.set(varName, typeStr);
        }
      }
    }

    // 3. Register for-loop variables (e.g. for(int i=0;...) or for(String s : words))
    const forLoopPattern = /for\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$<>\s,?[\]]*?)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=|:|\;)/g;
    while ((match = forLoopPattern.exec(cleanCode)) !== null) {
      const typeStr = match[1].trim();
      const varName = match[2].trim();
      if (!['return', 'class', 'interface', 'enum', 'import', 'package', 'new', 'throw', 'if', 'while', 'for', 'else'].includes(typeStr)) {
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(varName)) {
          globalScope.symbols.set(varName, typeStr);
        }
      }
    }

    return scopes;
  }

  /**
   * Parse all existing function/method definitions in Java code
   */
  public parseExistingFunctions(code: string): FunctionDefinitionInfo[] {
    const cleanCode = this.sanitizeCode(code);
    const functions: FunctionDefinitionInfo[] = [];

    const methodHeaderPattern = /((?:(?:public|private|protected|static|final|synchronized)\s+)*)([a-zA-Z_$][a-zA-Z0-9_$<>\s,?[\]]*)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*(?:throws\s+[a-zA-Z0-9_$\s,]+)?\s*\{/g;

    let match: RegExpExecArray | null;
    while ((match = methodHeaderPattern.exec(cleanCode)) !== null) {
      const modifiers = match[1] ? match[1].trim() : '';
      const returnType = match[2].trim();
      const methodName = match[3].trim();
      const paramsStr = match[4].trim();
      const headerStart = match.index;
      const bodyStart = headerStart + match[0].length - 1;

      if (['if', 'while', 'for', 'switch', 'catch'].includes(methodName)) {
        continue;
      }

      let braceCount = 1;
      let bodyEnd = bodyStart + 1;
      while (bodyEnd < code.length && braceCount > 0) {
        if (cleanCode[bodyEnd] === '{') braceCount++;
        else if (cleanCode[bodyEnd] === '}') braceCount--;
        bodyEnd++;
      }

      const signatureText = code.substring(headerStart, bodyStart).trim();
      const bodyText = code.substring(bodyStart, bodyEnd).trim();

      const parameters: ParameterInfo[] = [];
      if (paramsStr.length > 0) {
        const paramParts = this.splitByComma(paramsStr);
        paramParts.forEach((p, idx) => {
          const trimmed = p.trim();
          const lastSpace = trimmed.lastIndexOf(' ');
          if (lastSpace !== -1) {
            const pType = trimmed.substring(0, lastSpace).trim();
            const pName = trimmed.substring(lastSpace + 1).trim();
            parameters.push({ position: idx, type: pType, name: pName });
          }
        });
      }

      functions.push({
        name: methodName,
        modifiers,
        returnType,
        parameters,
        startOffset: headerStart,
        endOffset: bodyEnd,
        signatureStartOffset: headerStart,
        signatureEndOffset: bodyStart,
        signatureText,
        bodyText,
        bodyHash: this.hashString(bodyText)
      });
    }

    return functions;
  }

  /**
   * Parse all function call expressions in the source code
   */
  public parseFunctionCalls(code: string): FunctionCallInfo[] {
    const cleanCode = this.sanitizeCode(code);
    const existingFunctions = this.parseExistingFunctions(code);
    const calls: FunctionCallInfo[] = [];

    const callPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g;

    let match: RegExpExecArray | null;
    while ((match = callPattern.exec(cleanCode)) !== null) {
      const funcName = match[1];
      const argsStr = match[2];
      const offset = match.index;

      const RESERVED_JAVA = [
        'super', 'this', 'new', 'System', 'Math', 'println', 'print', 'printf', 'format',
        'equals', 'hashCode', 'toString', 'valueOf', 'clone',
        'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'void',
        'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character', 'Byte', 'Short', 'Object', 'String'
      ];
      if (RESERVED_JAVA.includes(funcName)) {
        continue;
      }

      // Ignore member method calls on objects/classes (e.g., s1.charAt(i), list.add(x), Math.max(a, b))
      // unless explicitly calling on 'this' (e.g., this.union(u, v))
      const precedingText = cleanCode.substring(0, offset).trimEnd();
      if (precedingText.endsWith('.')) {
        const textBeforeDot = precedingText.substring(0, precedingText.length - 1).trimEnd();
        if (!/\bthis$/.test(textBeforeDot)) {
          continue;
        }
      }

      // Ignore constructor calls preceded by 'new' (e.g. new StringBuilder(), new ArrayList<>())
      if (/\bnew$/.test(precedingText)) {
        continue;
      }

      // If funcName is a control structure or statement keyword e.g. if(dfs(a)) or return(open==0), reset regex pointer to match inner calls!
      const CONTROL_KEYWORDS = ['if', 'while', 'for', 'switch', 'catch', 'return', 'throw', 'else', 'assert', 'synchronized'];
      if (CONTROL_KEYWORDS.includes(funcName)) {
        callPattern.lastIndex = offset + funcName.length + 1;
        continue;
      }

      const rest = cleanCode.substring(offset + match[0].length).trim();
      if (rest.startsWith('{') || rest.startsWith('throws')) {
        continue;
      }

      // Extract arguments string from original unsanitized code so string literals (" ", "") are preserved
      const rawCallText = code.substring(offset, offset + match[0].length);
      const firstParen = rawCallText.indexOf('(');
      const lastParen = rawCallText.lastIndexOf(')');
      const originalArgsStr = (firstParen !== -1 && lastParen !== -1 && lastParen > firstParen)
        ? rawCallText.substring(firstParen + 1, lastParen)
        : argsStr;

      const rawArgs = this.splitByComma(originalArgsStr);
      const args: ExpressionArg[] = rawArgs.map((argText) => {
        const trimmed = argText.trim();
        const isVar = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(trimmed);
        return {
          rawText: trimmed,
          type: 'unknown',
          isVariable: isVar,
          varName: isVar ? trimmed : undefined
        };
      });

      const precedingRaw = cleanCode.substring(Math.max(0, offset - 150), offset);
      const precedingTrimmed = precedingRaw.trim();
      let inferredReturn: string | undefined = undefined;
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

      // Priority 1: Explicit assignment target type
      // e.g., int result = dfs(a); or List<String> list = dfs(a);
      const typeAssignMatch = precedingTrimmed.match(/([a-zA-Z_$][a-zA-Z0-9_$<>\s,?[\]]*)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*$/);
      if (typeAssignMatch) {
        const matchedType = typeAssignMatch[1].trim();
        const keywords = ['return', 'if', 'while', 'for', 'switch', 'else', 'case', 'new', 'throw'];
        if (!keywords.includes(matchedType)) {
          inferredReturn = matchedType;
          confidence = 'HIGH';
        }
      }

      // Priority 2: Boolean condition context
      // e.g., if (dfs(a)) { } or while (dfs(a)) { }
      if (!inferredReturn) {
        if (/\b(if|while)\s*\([^)]*$/.test(precedingRaw) || /\b(if|while)\s*\($/i.test(precedingTrimmed)) {
          inferredReturn = 'boolean';
          confidence = 'HIGH';
        }
      }

      // Priority 3: Return statement + enclosing function return type
      // e.g., return dfs(a, b); inside public List<String> generateParenthesis(int n)
      if (!inferredReturn) {
        if (/\breturn\s*$/.test(precedingRaw) || /\breturn\s+\(?\s*$/.test(precedingRaw)) {
          const enclosing = existingFunctions.find((f) => offset >= f.startOffset && offset <= f.endOffset);
          if (enclosing) {
            inferredReturn = enclosing.returnType;
            confidence = 'HIGH';
          } else {
            confidence = 'MEDIUM';
          }
        }
      }

      // Priority 4: Standalone expression statement (no return value consumed)
      // e.g., dfs(a, b);
      if (!inferredReturn) {
        if (precedingTrimmed.endsWith(';') || precedingTrimmed.endsWith('{') || precedingTrimmed.endsWith('}')) {
          inferredReturn = 'void';
          confidence = 'HIGH';
        }
      }

      calls.push({
        name: funcName,
        arguments: args,
        location: { line: 1, column: 1, offset },
        inferredReturnType: inferredReturn,
        returnTypeConfidence: confidence
      });
    }

    return calls;
  }

  public splitByComma(str: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        current += char;
      } else if (!inString && (char === '<' || char === '(' || char === '[' || char === '{')) {
        depth++;
        current += char;
      } else if (!inString && (char === '>' || char === ')' || char === ']' || char === '}')) {
        depth = Math.max(0, depth - 1);
        current += char;
      } else if (!inString && char === ',' && depth === 0) {
        if (current.trim().length > 0) {
          result.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim().length > 0) {
      result.push(current.trim());
    }

    return result;
  }

  public hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }
}
