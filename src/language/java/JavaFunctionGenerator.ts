import type { FunctionCallInfo, ParameterInfo, FunctionDefinitionInfo } from '../../types/ast';

export class JavaFunctionGenerator {
  /**
   * Generates a complete Java function signature and empty body string,
   * respecting previous user parameter renames and position identity.
   */
  public generateFunctionCode(
    call: FunctionCallInfo,
    existingMetadata?: { parameters?: ParameterInfo[]; returnType?: string },
    indentation: string = '    '
  ): { code: string; signatureText: string; parameters: ParameterInfo[]; returnType: string } {
    const returnType = call.inferredReturnType || existingMetadata?.returnType || 'void';
    const parameters: ParameterInfo[] = [];

    call.arguments.forEach((arg, idx) => {
      const pos = idx + 1;
      const existingParam = existingMetadata?.parameters?.find((p) => p.position === idx);

      let paramName = '';
      if (existingParam && existingParam.isUserRenamed && existingParam.name) {
        // Preserved user-modified parameter name!
        paramName = existingParam.name;
      } else if (arg.isVariable && arg.varName) {
        paramName = arg.varName;
      } else {
        paramName = `arg${pos}`;
      }

      parameters.push({
        position: idx,
        type: arg.type || 'Object',
        name: paramName,
        isUserRenamed: existingParam?.isUserRenamed || false
      });
    });

    const paramStr = parameters.map((p) => `${p.type} ${p.name}`).join(', ');
    const signatureText = `${returnType} ${call.name}(${paramStr})`;

    const code = `\n${indentation}${signatureText} {\n${indentation}    \n${indentation}}\n`;

    return {
      code,
      signatureText,
      parameters,
      returnType
    };
  }

  /**
   * Updates only the signature line of an existing function while leaving its body 100% untouched.
   */
  public updateFunctionSignature(
    existingFunc: FunctionDefinitionInfo,
    newCall: FunctionCallInfo,
    existingParams: ParameterInfo[]
  ): { updatedCode: string; newSignatureText: string; updatedParameters: ParameterInfo[] } {
    const updatedParameters: ParameterInfo[] = [];

    newCall.arguments.forEach((arg, idx) => {
      const pos = idx + 1;
      const prevParam = existingParams.find((p) => p.position === idx);

      let name = '';
      if (prevParam && prevParam.isUserRenamed) {
        name = prevParam.name; // Keep user's custom name e.g. cur, parent
      } else if (arg.isVariable && arg.varName) {
        name = arg.varName;
      } else {
        name = prevParam?.name || `arg${pos}`;
      }

      updatedParameters.push({
        position: idx,
        type: arg.type || 'Object',
        name,
        isUserRenamed: prevParam?.isUserRenamed || false
      });
    });

    const paramStr = updatedParameters.map((p) => `${p.type} ${p.name}`).join(', ');
    const returnType = newCall.inferredReturnType || existingFunc.returnType || 'void';
    const newSignatureText = `${returnType} ${existingFunc.name}(${paramStr})`;

    const mods = existingFunc.modifiers ? `${existingFunc.modifiers} ` : '';
    const updatedCode = `${mods}${newSignatureText} {`;

    return {
      updatedCode,
      newSignatureText,
      updatedParameters
    };
  }
}
