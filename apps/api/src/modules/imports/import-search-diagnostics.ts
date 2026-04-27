import type { ImportProvider } from './imports.constants';

export const IMPORT_SEARCH_DIAGNOSTIC_STATUSES = [
  'searched',
  'skipped',
  'failed',
] as const;

export type ImportSearchDiagnosticStatus =
  (typeof IMPORT_SEARCH_DIAGNOSTIC_STATUSES)[number];

export type ImportSearchDiagnosticReasonCode =
  | 'guest_provider_not_allowed'
  | 'provider_failed'
  | 'server_credential_missing'
  | 'unsupported_medium'
  | 'user_credential_missing';

export interface ImportSearchProviderDiagnostic {
  configured: boolean;
  credentialMode: 'none' | 'server' | 'user';
  message: string;
  provider: ImportProvider;
  reasonCode: ImportSearchDiagnosticReasonCode | null;
  resultCount: number;
  status: ImportSearchDiagnosticStatus;
}

export interface ImportSearchDiagnostics {
  providers: ImportSearchProviderDiagnostic[];
}

export function createImportSearchDiagnostics(): ImportSearchDiagnostics {
  return {
    providers: [],
  };
}

export function addProviderDiagnostic(
  diagnostics: ImportSearchDiagnostics,
  diagnostic: ImportSearchProviderDiagnostic,
) {
  diagnostics.providers.push(diagnostic);
}
