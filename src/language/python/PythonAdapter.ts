import type { LanguageAdapter } from '../LanguageAdapter';
import type { FunctionCallInfo, FunctionDefinitionInfo, Scope, ParameterInfo, ExpressionArg } from '../../types/ast';

export class PythonAdapter implements LanguageAdapter {
  public languageId = 'python';
  public name = 'Python';

  public sanitizeCode(code: string): string {
    return code
      .replace(/#.*/g, (m) => ' '.repeat(m.length))
      .replace(/"""[\s\S]*?"""/g, (m) => ' '.repeat(m.length))
      .replace(/"[^"]*"/g, (m) => ' '.repeat(m.length))
      .replace(/'[^']*'/g, (m) => ' '.repeat(m.length));
  }

  public parseScopes(_code: string): Scope[] {
    return [{ id: 'scope_global', symbols: new Map() }];
  }

  public parseExistingFunctions(code: string): FunctionDefinitionInfo[] {
    const clean = this.sanitizeCode(code);
    const functions: FunctionDefinitionInfo[] = [];

    // Match python functions: def dfs(a, name): ...
    const defPattern = /def\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*:/g;

    let match: RegExpExecArray | null;
    while ((match = defPattern.exec(clean)) !== null) {
      const name = match[1].trim();
      const paramsStr = match[2].trim();
      const headerStart = match.index;
      const bodyStart = headerStart + match[0].length;

      // Find body by indentation or until next def/EOF
      let bodyEnd = bodyStart;
      while (bodyEnd < code.length) {
        if (clean.substring(bodyEnd).match(/^(?:\r?\n)def\s+/)) break;
        bodyEnd++;
      }

      const signatureText = code.substring(headerStart, bodyStart).trim();
      const bodyText = code.substring(bodyStart, bodyEnd).trim();

      const parameters: ParameterInfo[] = [];
      if (paramsStr.length > 0) {
        paramsStr.split(',').forEach((p, idx) => {
          const trimmed = p.trim();
          parameters.push({ position: idx, type: 'Any', name: trimmed });
        });
      }

      functions.push({
        name,
        returnType: 'Any',
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

      const RESERVED_PYTHON = [
        'print', 'range', 'len', 'int', 'str', 'list', 'dict', 'set', 'tuple', 'bool', 'float',
        'type', 'isinstance', 'issubclass', 'hasattr', 'getattr', 'setattr', 'delattr', 'input',
        'abs', 'all', 'any', 'bin', 'chr', 'ord', 'hex', 'max', 'min', 'sum', 'sorted', 'reversed',
        'enumerate', 'zip', 'map', 'filter'
      ];
      if (RESERVED_PYTHON.includes(name)) continue;

      const CONTROL_KEYWORDS_PYTHON = [
        'if', 'while', 'for', 'switch', 'catch', 'return', 'raise', 'else', 'elif', 'yield', 'await', 'assert', 'with'
      ];
      if (CONTROL_KEYWORDS_PYTHON.includes(name)) {
        callPattern.lastIndex = offset + name.length + 1;
        continue;
      }

      const rest = clean.substring(offset + match[0].length).trim();
      if (rest.startsWith(':')) continue; // Function def

      const precedingText = clean.substring(0, offset).trimEnd();
      if (precedingText.endsWith('.')) {
        const textBeforeDot = precedingText.substring(0, precedingText.length - 1).trimEnd();
        if (!/\b(self|cls)$/.test(textBeforeDot)) {
          continue;
        }
      }

      const preceding = clean.substring(Math.max(0, offset - 10), offset).trim();
      if (preceding.endsWith('def')) continue;

      const rawCallText = code.substring(offset, offset + match[0].length);
      const firstParen = rawCallText.indexOf('(');
      const lastParen = rawCallText.lastIndexOf(')');
      const originalArgsStr = (firstParen !== -1 && lastParen !== -1 && lastParen > firstParen)
        ? rawCallText.substring(firstParen + 1, lastParen)
        : argsStr;

      const rawArgs = originalArgsStr.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
      const args: ExpressionArg[] = rawArgs.map((argText) => {
        const isVar = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(argText);
        return { rawText: argText, type: 'Any', isVariable: isVar, varName: isVar ? argText : undefined };
      });

      calls.push({
        name,
        arguments: args,
        location: { line: 1, column: 1, offset },
        inferredReturnType: 'Any'
      });
    }

    return calls;
  }

  public resolveArgumentType(_rawExpr: string, _scopes: Scope[]): string {
    return 'Any';
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

      parameters.push({ position: idx, type: 'Any', name, isUserRenamed: prev?.isUserRenamed || false });
    });

    const paramStr = parameters.map((p) => p.name).join(', ');
    const signatureText = `def ${call.name}(${paramStr}):`;
    const code = `\n${signatureText}\n    pass\n`;

    return { code, signatureText, parameters, returnType: 'Any' };
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

      updatedParameters.push({ position: idx, type: 'Any', name, isUserRenamed: prev?.isUserRenamed || false });
    });

    const paramStr = updatedParameters.map((p) => p.name).join(', ');
    const newSignatureText = `def ${existingFunc.name}(${paramStr}):`;
    const updatedCode = `${newSignatureText}`;

    return { updatedCode, newSignatureText, updatedParameters };
  }
}
