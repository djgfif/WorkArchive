import { useEffect, useMemo, useState } from 'react';

import {
  workFormDraftService,
  type WorkFormDraftRecord,
} from '../services/work-form-draft.service';
import type { WorkFormValues } from '../utils/work-form';

type DraftSaveStatus = 'idle' | 'restored' | 'saved' | 'saving';

interface UseWorkFormDraftOptions {
  baselineValues: WorkFormValues;
  draftKey?: string | null;
  enabled?: boolean;
  onRestore: (values: WorkFormValues) => void;
  values: WorkFormValues;
}

function serializeValues(values: WorkFormValues) {
  return JSON.stringify(values);
}

export function useWorkFormDraft({
  baselineValues,
  draftKey,
  enabled = true,
  onRestore,
  values,
}: UseWorkFormDraftOptions) {
  const [pendingDraft, setPendingDraft] = useState<WorkFormDraftRecord | null>(
    null,
  );
  const [isReadyForAutosave, setIsReadyForAutosave] = useState(false);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>('idle');
  const serializedValues = useMemo(() => serializeValues(values), [values]);
  const serializedBaselineValues = useMemo(
    () => serializeValues(baselineValues),
    [baselineValues],
  );
  const isDirty = serializedValues !== serializedBaselineValues;

  useEffect(() => {
    if (!enabled || !draftKey) {
      setPendingDraft(null);
      setIsReadyForAutosave(false);
      setSaveStatus('idle');
      return;
    }

    const draft = workFormDraftService.getDraft(draftKey);

    setPendingDraft(draft);
    setIsReadyForAutosave(!draft);
    setSaveStatus('idle');
  }, [draftKey, enabled]);

  useEffect(() => {
    if (!enabled || !draftKey || !isReadyForAutosave) {
      return undefined;
    }

    if (!isDirty) {
      workFormDraftService.deleteDraft(draftKey);
      setSaveStatus('idle');
      return undefined;
    }

    setSaveStatus('saving');
    const timeoutId = window.setTimeout(() => {
      workFormDraftService.saveDraft(draftKey, values);
      setSaveStatus('saved');
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftKey, enabled, isDirty, isReadyForAutosave, values]);

  function applyDraft() {
    if (!pendingDraft) {
      return;
    }

    onRestore(pendingDraft.values);
    setPendingDraft(null);
    setIsReadyForAutosave(true);
    setSaveStatus('restored');
  }

  function clearDraft() {
    if (draftKey) {
      workFormDraftService.deleteDraft(draftKey);
    }

    setPendingDraft(null);
    setIsReadyForAutosave(true);
    setSaveStatus('idle');
  }

  return {
    applyDraft,
    clearDraft,
    isDirty,
    pendingDraft,
    saveStatus,
  };
}
