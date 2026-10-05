export interface Scope {
  id: string;
  parentId?: string;
  symbols: Map<string, string>; // varName -> type
}

export interface ParameterInfo {
  position: number;
  type: string;
  name: string; // name in code (e.g. arg1, cur, parent)
  isUserRenamed?: boolean;
}

export interface FunctionCallInfo {
  name: string;
  arguments: ExpressionArg[];
  location: { line: number; column: number; offset: number };
  inferredReturnType?: string;
  returnTypeConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  enclosingScopeId?: string;
  enclosingClassName?: string;
  enclosingMethodName?: string;
}

export interface ExpressionArg {
  rawText: string;
  type: string; // inferred type e.g. int, String, ArrayList<Integer>
  isVariable: boolean;
  varName?: string;
}

export interface FunctionDefinitionInfo {
  id?: string;
  name: string;
  modifiers?: string;
  returnType: string;
  parameters: ParameterInfo[];
  startOffset: number;
  endOffset: number;
  signatureStartOffset: number;
  signatureEndOffset: number;
  signatureText: string;
  bodyText: string;
  bodyHash: string;
  isGeneratedByMMF?: boolean;
  className?: string;
}
