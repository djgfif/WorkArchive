import type { WorkFormValues } from '../utils/work-form';
import type { WorkFormFocusArea } from '../components/add-work-form.types';

const DRAFT_STORAGE_PREFIX = 'work-archive:work-form-draft:';
const completedDraftKeys = new Set<string>();
const draftWriteVersions = new Map<string, number>();

export interface WorkFormDraftRecord {
  key: string;
  updatedAt: string;
  values: WorkFormValues;
}

interface WorkFormDraftKeyInput {
  archiveScopeKey: string;
  focusArea: WorkFormFocusArea;
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
  beginDraftSession(key: string) {
    completedDraftKeys.delete(key);
  },

  completeDraft(key: string) {
    completedDraftKeys.add(key);
    draftWriteVersions.set(key, (draftWriteVersions.get(key) ?? 0) + 1);
    getStorage()?.removeItem(getStorageKey(key));
  },

  captureWriteVersion(key: string) {
    return draftWriteVersions.get(key) ?? 0;
  },

  deleteDraft(key: string) {
    draftWriteVersions.set(key, (draftWriteVersions.get(key) ?? 0) + 1);
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

  saveDraft(
    key: string,
    values: WorkFormValues,
    expectedWriteVersion?: number,
  ) {
    if (completedDraftKeys.has(key)) {
      return null;
    }

    if (
      expectedWriteVersion !== undefined &&
      expectedWriteVersion !== (draftWriteVersions.get(key) ?? 0)
    ) {
      return null;
    }

    const draft: WorkFormDraftRecord = {
      key,
      updatedAt: new Date().toISOString(),
      values,
    };

    getStorage()?.setItem(getStorageKey(key), JSON.stringify(draft));

    return draft;
  },
};
