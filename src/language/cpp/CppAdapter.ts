import type { LanguageAdapter } from '../LanguageAdapter';
import type { FunctionCallInfo, FunctionDefinitionInfo, Scope, ParameterInfo, ExpressionArg } from '../../types/ast';

export class CppAdapter implements LanguageAdapter {
  public languageId = 'cpp';
  public name = 'C++';

  public sanitizeCode(code: string): string {
    return code
      .replace(/\/\/.*/g, (m) => ' '.repeat(m.length))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
      .replace(/"[^"]*"/g, (m) => ' '.repeat(m.length));
  }

  public parseScopes(code: string): Scope[] {
    const clean = this.sanitizeCode(code);
    const globalScope: Scope = { id: 'scope_global', symbols: new Map() };

    const existingFuncs = this.parseExistingFunctions(code);
    for (const func of existingFuncs) {
      for (const param of func.parameters) {
        if (param.name && param.type) {
          globalScope.symbols.set(param.name, param.type);
        }
      }
    }

    const declPattern = /(?:(int|long long|double|float|bool|char|string|vector<[a-zA-Z0-9_<>\s,]+>))\s+([a-zA-Z_$][a-zA-Z0-9_$,\s]*?)(?:\s*=[^;]+)?;?/g;

    let match: RegExpExecArray | null;
    while ((match = declPattern.exec(clean)) !== null) {
      const typeStr = match[1].trim();
      const varsStr = match[2].trim();
      if (['return', 'using', 'namespace', 'class', 'struct', 'if', 'while', 'for'].includes(typeStr)) continue;

      const varNames = varsStr.split(',').map((v) => {
        const eqIdx = v.indexOf('=');
        return (eqIdx !== -1 ? v.substring(0, eqIdx) : v).trim();
      });

      for (const varName of varNames) {
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(varName)) {
          globalScope.symbols.set(varName, typeStr);
        }
      }
    }

    const forLoopPattern = /for\s*\(\s*([a-zA-Z0-9_$<>\s:*&,]+)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=|:|\;)/g;
    while ((match = forLoopPattern.exec(clean)) !== null) {
      const typeStr = match[1].trim();
      const varName = match[2].trim();
      if (!['return', 'using', 'namespace', 'class', 'struct', 'if', 'while', 'for'].includes(typeStr)) {
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(varName)) {
          globalScope.symbols.set(varName, typeStr);
        }
      }
    }

    return [globalScope];
  }

  public parseExistingFunctions(code: string): FunctionDefinitionInfo[] {
    const clean = this.sanitizeCode(code);
    const functions: FunctionDefinitionInfo[] = [];

    const methodHeader = /(?:(?:public|private|protected|static|inline)\s*:?\s*)*([a-zA-Z0-9_$<>\s:*&,]+)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/g;

    let match: RegExpExecArray | null;
    while ((match = methodHeader.exec(clean)) !== null) {
      let returnType = match[1].trim();
      returnType = returnType.replace(/^(?:public|private|protected|static|inline)\s*:?\s*/g, '').trim();

      const name = match[2].trim();
      const paramsStr = match[3].trim();
      const headerStart = match.index;
      const bodyStart = headerStart + match[0].length - 1;

      if (['if', 'while', 'for', 'switch', 'catch', 'main'].includes(name)) continue;

      let braceCount = 1;
      let bodyEnd = bodyStart + 1;
      while (bodyEnd < code.length && braceCount > 0) {
        if (clean[bodyEnd] === '{') braceCount++;
        else if (clean[bodyEnd] === '}') braceCount--;
        bodyEnd++;
      }

      const signatureText = code.substring(headerStart, bodyStart).trim();
      const bodyText = code.substring(bodyStart, bodyEnd).trim();

      const parameters: ParameterInfo[] = [];
      if (paramsStr.length > 0) {
        paramsStr.split(',').forEach((p, idx) => {
          const trimmed = p.trim();
          const lastSpace = trimmed.lastIndexOf(' ');
          if (lastSpace !== -1) {
            parameters.push({ position: idx, type: trimmed.substring(0, lastSpace).trim(), name: trimmed.substring(lastSpace + 1).trim() });
          }
        });
      }

      functions.push({
        name,
        returnType,
        parameters,
        startOffset: headerStart,
        endOffset: bodyEnd,
        signatureStartOffset: headerStart,
        signatureEndOffset: bodyStart,
        signatureText,
        bodyText,
        bodyHash: String(bodyText.length)
      });
    }

    return functions;
  }

  public parseFunctionCalls(code: string): FunctionCallInfo[] {
    const clean = this.sanitizeCode(code);
    const existingFunctions = this.parseExistingFunctions(code);
    const scopes = this.parseScopes(code);
    const calls: FunctionCallInfo[] = [];

    const callPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g;

    let match: RegExpExecArray | null;
    while ((match = callPattern.exec(clean)) !== null) {
      const funcName = match[1];
      const argsStr = match[2];
      const offset = match.index;

      const RESERVED_CPP = [
        'main', 'vector', 'string', 'map', 'set', 'unordered_map', 'unordered_set', 'pair', 'make_pair', 'max', 'min', 'swap', 'sort', 'abs', 'cin', 'cout', 'endl',
        'int', 'long', 'double', 'float', 'bool', 'char', 'void', 'size_t', 'auto'
      ];
      if (RESERVED_CPP.includes(funcName)) continue;

      const CONTROL_KEYWORDS_CPP = [
        'if', 'while', 'for', 'switch', 'catch', 'return', 'throw', 'else',
        'sizeof', 'typeof', 'typeid', 'decltype', 'alignof', 'static_cast', 'dynamic_cast', 'reinterpret_cast', 'const_cast'
      ];
      if (CONTROL_KEYWORDS_CPP.includes(funcName)) {
        callPattern.lastIndex = offset + funcName.length + 1;
        continue;
      }

      const rest = clean.substring(offset + match[0].length).trim();
      if (rest.startsWith('{')) continue;

      const precedingText = clean.substring(0, offset).trimEnd();
      if (precedingText.endsWith('.')) {
        const textBeforeDot = precedingText.substring(0, precedingText.length - 1).trimEnd();
        if (!/\bthis$/.test(textBeforeDot)) {
          continue;
        }
      } else if (precedingText.endsWith('->')) {
        const textBeforeArrow = precedingText.substring(0, precedingText.length - 2).trimEnd();
        if (!/\bthis$/.test(textBeforeArrow)) {
          continue;
        }
      }

      if (/\bnew$/.test(precedingText)) {
        continue;
      }

      const rawCallText = code.substring(offset, offset + match[0].length);
      const firstParen = rawCallText.indexOf('(');
      const lastParen = rawCallText.lastIndexOf(')');
      const originalArgsStr = (firstParen !== -1 && lastParen !== -1 && lastParen > firstParen)
        ? rawCallText.substring(firstParen + 1, lastParen)
        : argsStr;

      const rawArgs = originalArgsStr.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
      const args: ExpressionArg[] = rawArgs.map((argText) => {
        const isVar = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(argText);
        return {
          rawText: argText,
          type: this.resolveArgumentType(argText, scopes),
          isVariable: isVar,
          varName: isVar ? argText : undefined
        };
      });

      const precedingRaw = clean.substring(Math.max(0, offset - 150), offset);
      const precedingTrimmed = precedingRaw.trim();
      let inferredReturn: string | undefined = undefined;

      const typeMatch = precedingTrimmed.match(/([a-zA-Z0-9_$<>\s:*&,]+)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*$/);
      if (typeMatch) {
        const t = typeMatch[1].trim();
        if (!['return', 'if', 'while', 'for', 'switch'].includes(t)) {
          inferredReturn = t;
        }
      }

      if (!inferredReturn && (/\b(if|while)\s*\([^)]*$/.test(precedingRaw) || /\bif\s*\($|\bwhile\s*\($/i.test(precedingTrimmed))) {
        inferredReturn = 'bool';
      }

      if (!inferredReturn && (/\breturn\s*$/.test(precedingRaw) || /\breturn\s+\(?\s*$/.test(precedingRaw))) {
        const enclosing = existingFunctions.find((f) => offset >= f.startOffset && offset <= f.endOffset);
        if (enclosing) inferredReturn = enclosing.returnType;
      }

      if (!inferredReturn && (precedingTrimmed.endsWith(';') || precedingTrimmed.endsWith('{') || precedingTrimmed.endsWith('}'))) {
        inferredReturn = 'void';
      }

      calls.push({
        name: funcName,
        arguments: args,
        location: { line: 1, column: 1, offset },
        inferredReturnType: inferredReturn || 'void'
      });
    }

    return calls;
  }

  public resolveArgumentType(rawExpr: string, scopes: Scope[]): string {
    const expr = rawExpr.trim();
    if (!expr) return 'auto';

    if (/^-?\d+$/.test(expr)) return 'int';
    if (/^-?\d+LL$/i.test(expr)) return 'long long';
    if (/^-?\d+\.\d+$/.test(expr)) return 'double';
    if (expr === 'true' || expr === 'false') return 'bool';
    if (/^"[^"]*"$/.test(expr)) return 'string';
    if (/^'[^']+'$/.test(expr)) return 'char';

    if (expr.endsWith('[i]') || expr.endsWith('[j]')) return 'int';

    for (const scope of scopes) {
      if (scope.symbols.has(expr)) return scope.symbols.get(expr)!;
    }

    return 'int';
  }

  public generateFunction(
    call: FunctionCallInfo,
    existingMetadata?: { parameters?: ParameterInfo[]; returnType?: string }
  ) {
    const returnType = call.inferredReturnType || existingMetadata?.returnType || 'void';
    const parameters: ParameterInfo[] = [];

    call.arguments.forEach((arg, idx) => {
      const pos = idx + 1;
      const prev = existingMetadata?.parameters?.find((p) => p.position === idx);
      const name = prev && prev.isUserRenamed ? prev.name : arg.isVariable && arg.varName ? arg.varName : `arg${pos}`;

      parameters.push({ position: idx, type: arg.type || 'int', name, isUserRenamed: prev?.isUserRenamed || false });
    });

    const paramStr = parameters.map((p) => `${p.type} ${p.name}`).join(', ');
    const signatureText = `${returnType} ${call.name}(${paramStr})`;
    const code = `\n${signatureText} {\n    \n}\n`;

    return { code, signatureText, parameters, returnType };
  }

  public updateFunctionSignature(
    existingFunc: FunctionDefinitionInfo,
    newCall: FunctionCallInfo,
    existingParams: ParameterInfo[]
  ) {
    const updatedParameters: ParameterInfo[] = [];
    newCall.arguments.forEach((arg, idx) => {
      const pos = idx + 1;
      const prev = existingParams.find((p) => p.position === idx);
      const name = prev && prev.isUserRenamed ? prev.name : arg.isVariable && arg.varName ? arg.varName : `arg${pos}`;
      updatedParameters.push({ position: idx, type: arg.type || 'int', name, isUserRenamed: prev?.isUserRenamed || false });
    });

    const paramStr = updatedParameters.map((p) => `${p.type} ${p.name}`).join(', ');
    const returnType = newCall.inferredReturnType || existingFunc.returnType || 'void';
    const newSignatureText = `${returnType} ${existingFunc.name}(${paramStr})`;
    const updatedCode = `${newSignatureText} {`;

    return { updatedCode, newSignatureText, updatedParameters };
  }
}
