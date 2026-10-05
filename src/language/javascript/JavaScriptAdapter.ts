import type { LanguageAdapter } from '../LanguageAdapter';
import type { FunctionCallInfo, FunctionDefinitionInfo, Scope, ParameterInfo, ExpressionArg } from '../../types/ast';

export class JavaScriptAdapter implements LanguageAdapter {
  public languageId = 'javascript';
  public name = 'JavaScript';

  public sanitizeCode(code: string): string {
    return code
      .replace(/\/\/.*/g, (m) => ' '.repeat(m.length))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
      .replace(/"[^"]*"/g, (m) => ' '.repeat(m.length))
      .replace(/'[^']*'/g, (m) => ' '.repeat(m.length));
  }

  public parseScopes(_code: string): Scope[] {
    return [{ id: 'scope_global', symbols: new Map() }];
  }

  public parseExistingFunctions(code: string): FunctionDefinitionInfo[] {
    const clean = this.sanitizeCode(code);
    const functions: FunctionDefinitionInfo[] = [];

    const funcPattern = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/g;

    let match: RegExpExecArray | null;
    while ((match = funcPattern.exec(clean)) !== null) {
      const name = match[1].trim();
      const paramsStr = match[2].trim();
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
          parameters.push({ position: idx, type: 'any', name: p.trim() });
        });
      }

      functions.push({
        name,
        returnType: 'any',
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

      const RESERVED_JS = [
        'console', 'log', 'warn', 'error', 'info', 'function', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
        'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'Promise', 'Math', 'JSON', 'Map', 'Set'
      ];
      if (RESERVED_JS.includes(name)) continue;

      const CONTROL_KEYWORDS_JS = [
        'if', 'while', 'for', 'switch', 'catch', 'return', 'throw', 'else',
        'typeof', 'void', 'delete', 'yield', 'await', 'import'
      ];
      if (CONTROL_KEYWORDS_JS.includes(name)) {
        callPattern.lastIndex = offset + name.length + 1;
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
        return { rawText: argText, type: 'any', isVariable: isVar, varName: isVar ? argText : undefined };
      });

      calls.push({
        name,
        arguments: args,
        location: { line: 1, column: 1, offset },
        inferredReturnType: 'any'
      });
    }

    return calls;
  }

  public resolveArgumentType(_rawExpr: string, _scopes: Scope[]): string {
    return 'any';
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

      parameters.push({ position: idx, type: 'any', name, isUserRenamed: prev?.isUserRenamed || false });
    });

    const paramStr = parameters.map((p) => p.name).join(', ');
    const signatureText = `function ${call.name}(${paramStr})`;
    const code = `\n${signatureText} {\n    \n}\n`;

    return { code, signatureText, parameters, returnType: 'any' };
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

      updatedParameters.push({ position: idx, type: 'any', name, isUserRenamed: prev?.isUserRenamed || false });
    });

    const paramStr = updatedParameters.map((p) => p.name).join(', ');
    const newSignatureText = `function ${existingFunc.name}(${paramStr})`;
    const updatedCode = `${newSignatureText} {`;

    return { updatedCode, newSignatureText, updatedParameters };
  }
}
