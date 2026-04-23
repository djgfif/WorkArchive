export const ALADIN_PROVIDER = 'aladin' as const;
export const IMPORT_PROVIDER_VALUES = [ALADIN_PROVIDER] as const;

export type ImportProvider = typeof IMPORT_PROVIDER_VALUES[number];
