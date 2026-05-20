import type { WorkFormValues } from '../utils/work-form';

const DRAFT_STORAGE_PREFIX = 'work-archive:work-form-draft:';

export interface WorkFormDraftRecord {
  key: string;
  updatedAt: string;
  values: WorkFormValues;
}

interface WorkFormDraftKeyInput {
  archiveScopeKey: string;
  focusArea: 'general' | 'review';
  mode: 'create' | 'edit';
  workId?: string | null;
}

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function getStorageKey(key: string) {
  return `${DRAFT_STORAGE_PREFIX}${key}`;
}

export function buildWorkFormDraftKey({
  archiveScopeKey,
  focusArea,
  mode,
  workId,
}: WorkFormDraftKeyInput) {
  return [
    archiveScopeKey,
    mode,
    focusArea,
    mode === 'edit' ? (workId ?? 'unknown') : 'new',
  ].join(':');
}

export const workFormDraftService = {
  deleteDraft(key: string) {
    getStorage()?.removeItem(getStorageKey(key));
  },

  getDraft(key: string): WorkFormDraftRecord | null {
    const rawValue = getStorage()?.getItem(getStorageKey(key));

    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<WorkFormDraftRecord>;

      if (!parsed.values || typeof parsed.updatedAt !== 'string') {
        return null;
      }

      return {
        key,
        updatedAt: parsed.updatedAt,
        values: parsed.values as WorkFormValues,
      };
    } catch {
      return null;
    }
  },

  saveDraft(key: string, values: WorkFormValues) {
    const draft: WorkFormDraftRecord = {
      key,
      updatedAt: new Date().toISOString(),
      values,
    };

    getStorage()?.setItem(getStorageKey(key), JSON.stringify(draft));

    return draft;
  },
};
