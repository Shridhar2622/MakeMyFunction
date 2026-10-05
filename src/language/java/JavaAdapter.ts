import type { LanguageAdapter } from '../LanguageAdapter';
import { JavaParser } from './JavaParser';
import { JavaTypeResolver } from './JavaTypeResolver';
import { JavaFunctionGenerator } from './JavaFunctionGenerator';
import type { FunctionCallInfo, FunctionDefinitionInfo, Scope, ParameterInfo } from '../../types/ast';

export class JavaAdapter implements LanguageAdapter {
  public languageId = 'java';
  public name = 'Java';

  private parser = new JavaParser();
  private typeResolver = new JavaTypeResolver();
  private generator = new JavaFunctionGenerator();

  public sanitizeCode(code: string): string {
    return this.parser.sanitizeCode(code);
  }

  public parseScopes(code: string): Scope[] {
    return this.parser.parseScopesAndSymbols(code);
  }

  public parseExistingFunctions(code: string): FunctionDefinitionInfo[] {
    return this.parser.parseExistingFunctions(code);
  }

  public parseFunctionCalls(code: string): FunctionCallInfo[] {
    const calls = this.parser.parseFunctionCalls(code);
    const scopes = this.parseScopes(code);

    // Resolve type of each argument
    for (const call of calls) {
      for (const arg of call.arguments) {
        arg.type = this.typeResolver.resolveArgumentType(arg.rawText, scopes);
      }
    }

    return calls;
  }

  public resolveArgumentType(rawExpr: string, scopes: Scope[]): string {
    return this.typeResolver.resolveArgumentType(rawExpr, scopes);
  }

  public generateFunction(
    call: FunctionCallInfo,
    existingMetadata?: { parameters?: ParameterInfo[]; returnType?: string }
  ) {
    return this.generator.generateFunctionCode(call, existingMetadata);
  }

  public updateFunctionSignature(
    existingFunc: FunctionDefinitionInfo,
    newCall: FunctionCallInfo,
    existingParams: ParameterInfo[]
  ) {
    return this.generator.updateFunctionSignature(existingFunc, newCall, existingParams);
  }
}
