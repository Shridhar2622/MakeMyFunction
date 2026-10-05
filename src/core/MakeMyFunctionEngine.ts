import type { LanguageAdapter } from '../language/LanguageAdapter';
import type { EditorAdapter } from '../types/editor';
import { FunctionTracker } from './FunctionTracker';
import { ChangeDetector } from './ChangeDetector';
import { LanguageRegistry } from '../language/LanguageRegistry';
import { LanguageDetector } from '../language/LanguageDetector';
import type { FunctionCallInfo } from '../types/ast';

export interface EngineStatus {
  active: boolean;
  selectedLanguage: string;
  detectedLanguage: string;
  languageMismatch: boolean;
}

export class MakeMyFunctionEngine {
  private editorAdapter: EditorAdapter;
  private functionTracker: FunctionTracker;
  private changeDetector: ChangeDetector;

  private isProcessing = false;
  private isAutoEnabled = true;
  private selectedLanguage = 'java';

  constructor(editorAdapter: EditorAdapter, initialLanguage = 'java') {
    this.editorAdapter = editorAdapter;
    this.functionTracker = new FunctionTracker();
    this.changeDetector = new ChangeDetector();
    this.selectedLanguage = initialLanguage;
  }

  public setSelectedLanguage(lang: string): void {
    console.log('[MakeMyFunctionEngine] Setting selected language:', lang);
    this.selectedLanguage = lang;
  }

  public startListening(debounceMs: number = 800): void {
    console.log('[MakeMyFunctionEngine] Engine listening started with debounce:', debounceMs);
    const debouncedProcess = this.changeDetector.debounce((code: string) => {
      const modelLang = this.editorAdapter.getModelLanguageId?.() || '';
      this.processCodeChange(code, modelLang);
    }, debounceMs);

    this.editorAdapter.onChange((code, _languageId) => {
      if (this.isAutoEnabled && !this.isProcessing) {
        debouncedProcess(code);
      }
    });
  }

  public getStatus(currentCode: string, modelLanguageId?: string): EngineStatus {
    const modelLang = modelLanguageId || this.editorAdapter.getModelLanguageId?.() || '';
    const detected = LanguageDetector.detectLanguage(currentCode, modelLang);
    const mismatch = detected !== 'unknown' && this.selectedLanguage.toLowerCase() !== detected.toLowerCase();
    return {
      active: this.isAutoEnabled,
      selectedLanguage: this.selectedLanguage,
      detectedLanguage: detected,
      languageMismatch: mismatch
    };
  }

  public async processCodeChange(code: string, modelLanguageId?: string): Promise<boolean> {
    if (this.isProcessing || !code.trim()) {
      return false;
    }

    const modelLang = modelLanguageId || this.editorAdapter.getModelLanguageId?.() || '';
    const detectedLang = LanguageDetector.detectLanguage(code, modelLang);
    const isCompatible = detectedLang !== 'unknown' && this.selectedLanguage.toLowerCase() === detectedLang.toLowerCase();

    console.log(
      `[MakeMyFunction][LanguageDetection]\n` +
      `platform: ${this.editorAdapter.name === 'LeetCodeAdapter' ? 'LeetCode' : 'Generic'}\n` +
      `adapter: ${this.editorAdapter.name}\n` +
      `modelLanguageId: ${modelLang || 'N/A'}\n` +
      `detectedLanguage: ${detectedLang.toUpperCase()}\n` +
      `selectedLanguage: ${this.selectedLanguage.toUpperCase()}\n` +
      `compatible: ${isCompatible}`
    );

    if (!isCompatible) {
      console.log('[MakeMyFunctionEngine] Language mismatch aborting generation.');
      return false;
    }

    const adapter: LanguageAdapter = LanguageRegistry.getAdapter(detectedLang);

    this.isProcessing = true;

    try {
      // 2. Structural AST Parsing
      const existingFunctions = adapter.parseExistingFunctions(code);
      const functionCalls = adapter.parseFunctionCalls(code);

      console.log('[MakeMyFunctionEngine] Existing functions:', existingFunctions.map(f => f.name));
      console.log('[MakeMyFunctionEngine] Detected calls:', functionCalls.map(c => c.name));

      // 3. Map call counts per function name
      const callSitesMap = new Map<string, FunctionCallInfo[]>();
      for (const call of functionCalls) {
        const list = callSitesMap.get(call.name) || [];
        list.push(call);
        callSitesMap.set(call.name, list);
      }

      // 4. Dependent Function Deletion: Check if tracked MMF generated functions have 0 call sites
      for (const existingFunc of existingFunctions) {
        const trackerMeta = this.functionTracker.getGeneratedFunction(existingFunc.name);
        if (trackerMeta && trackerMeta.isGeneratedByMMF) {
          const activeCalls = callSitesMap.get(existingFunc.name) || [];
          if (activeCalls.length === 0) {
            console.log('[MakeMyFunctionEngine] Automatically removing unreferenced generated function:', existingFunc.name);
            await this.editorAdapter.replaceRange(existingFunc.startOffset, existingFunc.endOffset, '');
            this.functionTracker.removeGeneratedFunction(existingFunc.name);
            this.isProcessing = false;
            return true;
          }
        }
      }

      // 5. Missing Function Generation & Signature Updates
      for (const [funcName, calls] of callSitesMap.entries()) {
        const existingFunc = existingFunctions.find((f) => f.name === funcName);
        let trackerMeta = this.functionTracker.getGeneratedFunction(funcName);

        if (existingFunc) {
          // If trackerMeta is missing, auto-initialize it so signature updates always work seamlessly
          if (!trackerMeta) {
            trackerMeta = this.functionTracker.recordGeneration(
              funcName,
              existingFunc.returnType,
              existingFunc.parameters,
              existingFunc.signatureText,
              existingFunc.bodyHash,
              true
            );
          }

          if (trackerMeta && !trackerMeta.isDeletedByUser) {
            // Detect if user manually renamed any parameter in the editor and mark as user-renamed
            for (const existingParam of existingFunc.parameters) {
              const trackedParam = trackerMeta.parameters.find((p) => p.position === existingParam.position);
              if (trackedParam && existingParam.name && existingParam.name !== trackedParam.name) {
                console.log(
                  `[MakeMyFunctionEngine] User renamed parameter at pos ${existingParam.position} in ${funcName}: ${trackedParam.name} -> ${existingParam.name}`
                );
                this.functionTracker.markUserRenamedParameter(funcName, existingParam.position, existingParam.name);
              }
            }

            // Pick the call site with the most parameters as primaryCall
            const primaryCall = calls.reduce(
              (maxCall, currCall) => (currCall.arguments.length > maxCall.arguments.length ? currCall : maxCall),
              calls[0]
            );

            const updatedSig = adapter.updateFunctionSignature(
              existingFunc,
              primaryCall,
              trackerMeta.parameters
            );

            // Check if signature text actually changed (Idempotency check)
            if (updatedSig.newSignatureText !== existingFunc.signatureText) {
              console.log('[MakeMyFunctionEngine] Updating function signature for:', funcName);
              await this.editorAdapter.replaceRange(
                existingFunc.signatureStartOffset,
                existingFunc.signatureEndOffset + 1,
                updatedSig.updatedCode
              );

              this.functionTracker.updateParameters(funcName, updatedSig.updatedParameters);
              this.isProcessing = false;
              return true;
            }
          }
          continue;
        }

        // Handle missing function generation
        if (this.functionTracker.isDeletedByUser(funcName)) {
          continue;
        }

        if (calls.length > 1 && !this.doCallSiteTypesMatch(calls)) {
          continue;
        }

        const targetCall = calls[0];
        const generated = adapter.generateFunction(targetCall, trackerMeta);
        const insertOffset = this.findClassInsertionOffset(code);

        console.log('[MakeMyFunctionEngine] Generating missing function:', funcName, 'at offset:', insertOffset);

        if (insertOffset !== -1) {
          await this.editorAdapter.insertCode(insertOffset, generated.code);

          // Record in tracker with isGeneratedByMMF = true
          this.functionTracker.recordGeneration(
            funcName,
            generated.returnType,
            generated.parameters,
            generated.signatureText,
            '',
            true
          );

          this.isProcessing = false;
          return true;
        }
      }
    } catch (err) {
      console.error('[MakeMyFunctionEngine] Analysis error:', err);
    } finally {
      this.isProcessing = false;
    }

    return false;
  }

  private doCallSiteTypesMatch(calls: FunctionCallInfo[]): boolean {
    if (calls.length <= 1) return true;
    const firstTypes = calls[0].arguments.map((a) => a.type).join(',');
    for (let i = 1; i < calls.length; i++) {
      const currentTypes = calls[i].arguments.map((a) => a.type).join(',');
      if (firstTypes !== currentTypes) {
        return false;
      }
    }
    return true;
  }

  private findClassInsertionOffset(code: string): number {
    const lastBraceIdx = code.lastIndexOf('}');
    if (lastBraceIdx !== -1) {
      return lastBraceIdx;
    }
    return code.length;
  }
}
