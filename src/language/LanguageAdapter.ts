import type { FunctionCallInfo, FunctionDefinitionInfo, Scope, ParameterInfo } from '../types/ast';

export interface LanguageAdapter {
  languageId: string;
  name: string;

  sanitizeCode(code: string): string;
  parseScopes(code: string): Scope[];
  parseExistingFunctions(code: string): FunctionDefinitionInfo[];
  parseFunctionCalls(code: string): FunctionCallInfo[];
  resolveArgumentType(rawExpr: string, scopes: Scope[]): string;

  generateFunction(
    call: FunctionCallInfo,
    existingMetadata?: { parameters?: ParameterInfo[]; returnType?: string }
  ): { code: string; signatureText: string; parameters: ParameterInfo[]; returnType: string };

  updateFunctionSignature(
    existingFunc: FunctionDefinitionInfo,
    newCall: FunctionCallInfo,
    existingParams: ParameterInfo[]
  ): { updatedCode: string; newSignatureText: string; updatedParameters: ParameterInfo[] };
}
