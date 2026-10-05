import type { GeneratedFunctionMetadata } from '../types/state';
import type { ParameterInfo } from '../types/ast';

export class FunctionTracker {
  private generatedFunctions: Map<string, GeneratedFunctionMetadata> = new Map();
  private deletedFunctions: Set<string> = new Set();
  private nextId = 1;

  public getGeneratedFunction(name: string): GeneratedFunctionMetadata | undefined {
    return this.generatedFunctions.get(name);
  }

  public isDeletedByUser(name: string): boolean {
    return this.deletedFunctions.has(name);
  }

  public markDeletedByUser(name: string): void {
    this.deletedFunctions.add(name);
  }

  public recordGeneration(
    name: string,
    returnType: string,
    parameters: ParameterInfo[],
    signatureText: string,
    bodyHash: string,
    isGeneratedByMMF = true,
    className?: string
  ): GeneratedFunctionMetadata {
    const existing = this.generatedFunctions.get(name);
    const id = existing ? existing.id : `F${String(this.nextId++).padStart(3, '0')}`;

    const metadata: GeneratedFunctionMetadata = {
      id,
      name,
      returnType,
      parameters,
      signatureText,
      bodyHash,
      generatedAt: Date.now(),
      isDeletedByUser: false,
      userModifiedSignature: false,
      isGeneratedByMMF,
      className
    };

    this.generatedFunctions.set(name, metadata);
    this.deletedFunctions.delete(name);
    return metadata;
  }

  public removeGeneratedFunction(name: string): void {
    this.generatedFunctions.delete(name);
    this.deletedFunctions.delete(name);
  }

  public updateParameters(name: string, updatedParams: ParameterInfo[]): void {
    const meta = this.generatedFunctions.get(name);
    if (meta) {
      meta.parameters = updatedParams;
    }
  }

  public markUserRenamedParameter(funcName: string, position: number, newName: string): void {
    const meta = this.generatedFunctions.get(funcName);
    if (meta) {
      const param = meta.parameters.find((p) => p.position === position);
      if (param) {
        param.name = newName;
        param.isUserRenamed = true;
      }
    }
  }
}
