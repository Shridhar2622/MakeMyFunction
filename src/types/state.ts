import type { ParameterInfo } from './ast';

export interface GeneratedFunctionMetadata {
  id: string; // e.g. F001
  name: string; // e.g. dfs
  returnType: string;
  parameters: ParameterInfo[];
  signatureText: string;
  bodyHash: string;
  generatedAt: number;
  lastUpdatedCallSiteHash?: string;
  isDeletedByUser?: boolean;
  userModifiedSignature?: boolean;
  isGeneratedByMMF: boolean;
  className?: string;
  callCount?: number;
}

export interface ExtensionSettings {
  enabled: boolean;
  preferredLanguage: string; // 'java' | 'cpp' | 'python' | 'javascript' | 'csharp' | 'go'
  autoGenerate: boolean;
  sensitivityDebounceMs: number;
}
