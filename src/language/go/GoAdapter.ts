import type { LanguageAdapter } from '../LanguageAdapter';
import type { FunctionCallInfo, FunctionDefinitionInfo, Scope, ParameterInfo, ExpressionArg } from '../../types/ast';

export class GoAdapter implements LanguageAdapter {
  public languageId = 'go';
  public name = 'Go';

  public sanitizeCode(code: string): string {
    return code
      .replace(/\/\/.*/g, (m) => ' '.repeat(m.length))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
      .replace(/"[^"]*"/g, (m) => ' '.repeat(m.length));
  }

  public parseScopes(_code: string): Scope[] {
    return [{ id: 'scope_global', symbols: new Map() }];
  }

  public parseExistingFunctions(code: string): FunctionDefinitionInfo[] {
    const clean = this.sanitizeCode(code);
    const functions: FunctionDefinitionInfo[] = [];

    // func dfs(a int, name string) {
    const funcPattern = /func\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*(?:([a-zA-Z0-9_$<>[\]]+)\s*)?\{/g;

    let match: RegExpExecArray | null;
    while ((match = funcPattern.exec(clean)) !== null) {
      const name = match[1].trim();
      const paramsStr = match[2].trim();
      const returnType = match[3] ? match[3].trim() : '';
      const headerStart = match.index;
      const bodyStart = headerStart + match[0].length - 1;

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
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            parameters.push({ position: idx, name: parts[0], type: parts[1] });
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
    const calls: FunctionCallInfo[] = [];

    const callPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g;

    let match: RegExpExecArray | null;
    while ((match = callPattern.exec(clean)) !== null) {
      const name = match[1];
      const argsStr = match[2];
      const offset = match.index;

      const RESERVED_GO = [
        'fmt', 'Println', 'Printf', 'Print', 'Sprintf', 'Sprint', 'func', 'make', 'len', 'cap', 'append',
        'new', 'copy', 'delete', 'panic', 'recover', 'int', 'string', 'bool', 'byte', 'rune', 'float64'
      ];
      if (RESERVED_GO.includes(name)) continue;

      const CONTROL_KEYWORDS_GO = [
        'if', 'for', 'switch', 'select', 'return', 'defer', 'go'
      ];
      if (CONTROL_KEYWORDS_GO.includes(name)) {
        callPattern.lastIndex = offset + name.length + 1;
        continue;
      }

      const rest = clean.substring(offset + match[0].length).trim();
      if (rest.startsWith('{')) continue;

      const precedingText = clean.substring(0, offset).trimEnd();
      if (precedingText.endsWith('.')) {
        continue;
      }

      const preceding = clean.substring(Math.max(0, offset - 10), offset).trim();
      if (preceding.endsWith('func')) continue;

      const rawCallText = code.substring(offset, offset + match[0].length);
      const firstParen = rawCallText.indexOf('(');
      const lastParen = rawCallText.lastIndexOf(')');
      const originalArgsStr = (firstParen !== -1 && lastParen !== -1 && lastParen > firstParen)
        ? rawCallText.substring(firstParen + 1, lastParen)
        : argsStr;

      const rawArgs = originalArgsStr.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
      const args: ExpressionArg[] = rawArgs.map((argText) => {
        const isVar = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(argText);
        return { rawText: argText, type: 'int', isVariable: isVar, varName: isVar ? argText : undefined };
      });

      calls.push({
        name,
        arguments: args,
        location: { line: 1, column: 1, offset },
        inferredReturnType: ''
      });
    }

    return calls;
  }

  public resolveArgumentType(rawExpr: string, _scopes: Scope[]): string {
    const expr = rawExpr.trim();
    if (!expr) return 'interface{}';
    if (/^-?\d+$/.test(expr)) return 'int';
    if (/^-?\d+\.\d+$/.test(expr)) return 'float64';
    if (expr === 'true' || expr === 'false') return 'bool';
    if (/^"[^"]*"$/.test(expr)) return 'string';
    return 'int';
  }

  public generateFunction(
    call: FunctionCallInfo,
    existingMetadata?: { parameters?: ParameterInfo[]; returnType?: string }
  ) {
    const parameters: ParameterInfo[] = [];

    call.arguments.forEach((arg, idx) => {
      const pos = idx + 1;
      const prev = existingMetadata?.parameters?.find((p) => p.position === idx);
      const name = prev && prev.isUserRenamed ? prev.name : arg.isVariable && arg.varName ? arg.varName : `arg${pos}`;

      parameters.push({ position: idx, type: arg.type || 'int', name, isUserRenamed: prev?.isUserRenamed || false });
    });

    // Go parameter syntax: func dfs(a int, name string)
    const paramStr = parameters.map((p) => `${p.name} ${p.type}`).join(', ');
    const retTypeStr = call.inferredReturnType ? ` ${call.inferredReturnType}` : '';
    const signatureText = `func ${call.name}(${paramStr})${retTypeStr}`;
    const code = `\n${signatureText} {\n    \n}\n`;

    return { code, signatureText, parameters, returnType: call.inferredReturnType || '' };
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

    const paramStr = updatedParameters.map((p) => `${p.name} ${p.type}`).join(', ');
    const retTypeStr = newCall.inferredReturnType ? ` ${newCall.inferredReturnType}` : '';
    const newSignatureText = `func ${existingFunc.name}(${paramStr})${retTypeStr}`;
    const updatedCode = `${newSignatureText} {`;

    return { updatedCode, newSignatureText, updatedParameters };
  }
}
