import type { Scope } from '../../types/ast';

export class JavaTypeResolver {
  /**
   * Resolves the Java type of an argument expression based on variables in scope,
   * literal syntax, unary operations, expressions, or array indexing.
   */
  public resolveArgumentType(rawExpr: string, scopes: Scope[]): string {
    const expr = rawExpr.trim();

    if (!expr) {
      return 'Object';
    }

    // 1. Check Literals & Unary Literals
    const literalType = this.resolveLiteralType(expr);
    if (literalType) {
      return literalType;
    }

    // 2. Check Array Access e.g. arr[i], matrix[r][c]
    const arrayAccessMatch = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\[/);
    if (arrayAccessMatch) {
      const varName = arrayAccessMatch[1];
      const arrayType = this.lookupVariableType(varName, scopes);
      if (arrayType && arrayType.endsWith('[]')) {
        return arrayType.substring(0, arrayType.length - 2).trim();
      }
    }

    // 3. Check Known Method Calls e.g. list.size(), str.length()
    if (expr.endsWith('.size()') || expr.endsWith('.length()') || expr.endsWith('.length')) {
      return 'int';
    }
    if (expr.endsWith('.isEmpty()') || expr.endsWith('.equalsIgnoreCase()')) {
      return 'boolean';
    }

    // 4. Check Variable in Scope
    const varType = this.lookupVariableType(expr, scopes);
    if (varType) {
      return varType;
    }

    // 5. Check Binary / Arithmetic Expressions e.g. i + 1, count * 2
    if (/[\+\-\*\/\%]/.test(expr)) {
      const parts = expr.split(/[\+\-\*\/\%]/).map((p) => p.trim());
      for (const part of parts) {
        const pType = this.resolveArgumentType(part, scopes);
        if (pType !== 'Object' && pType !== 'unknown') {
          return pType;
        }
      }
    }

    return 'Object'; // Conservative fallback
  }

  /**
   * Resolve literal expressions
   */
  private resolveLiteralType(expr: string): string | null {
    // Integer literals (e.g. 0, 10, -1, -100)
    if (/^-?\d+$/.test(expr)) {
      return 'int';
    }

    // Long literals (e.g. 10L, -1L, 100l)
    if (/^-?\d+[lL]$/.test(expr)) {
      return 'long';
    }

    // Float literals (e.g. 3.14f, -0.5F)
    if (/^-?\d+(?:\.\d+)?[fF]$/.test(expr)) {
      return 'float';
    }

    // Double literals (e.g. 3.14, -0.5)
    if (/^-?\d+\.\d+$/.test(expr)) {
      return 'double';
    }

    // String literals (e.g. "hello", "")
    if (/^"[^"]*"$/.test(expr)) {
      return 'String';
    }

    // Char literals (e.g. 'a', '\n')
    if (/^'[^']+'$/.test(expr)) {
      return 'char';
    }

    // Boolean literals
    if (expr === 'true' || expr === 'false') {
      return 'boolean';
    }

    // Null literal
    if (expr === 'null') {
      return 'Object';
    }

    return null;
  }

  /**
   * Search scopes for variable declaration
   */
  private lookupVariableType(varName: string, scopes: Scope[]): string | null {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].symbols.has(varName)) {
        return scopes[i].symbols.get(varName)!;
      }
    }
    return null;
  }
}
