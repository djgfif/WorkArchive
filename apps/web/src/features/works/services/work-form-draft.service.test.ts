import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultWorkFormValues } from '../utils/work-form';
import { workFormDraftService } from './work-form-draft.service';

describe('workFormDraftService', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('ignores a delayed autosave captured before the draft was deleted', () => {
    const key = 'guest:create:general:new';
    const values = {
      ...createDefaultWorkFormValues(),
      title: 'Dune',
    };
    const staleWriteVersion =
      workFormDraftService.captureWriteVersion(key);

    workFormDraftService.deleteDraft(key);

    expect(
      workFormDraftService.saveDraft(key, values, staleWriteVersion),
    ).toBeNull();
    expect(workFormDraftService.getDraft(key)).toBeNull();
  });

  it('allows a new autosave captured after deletion', () => {
    const key = 'guest:create:general:new';
    const values = {
      ...createDefaultWorkFormValues(),
      title: 'Dune Messiah',
    };

    workFormDraftService.deleteDraft(key);
    const writeVersion = workFormDraftService.captureWriteVersion(key);

    expect(workFormDraftService.saveDraft(key, values, writeVersion)).not
      .toBeNull();
    expect(workFormDraftService.getDraft(key)?.values.title).toBe(
      'Dune Messiah',
    );
  });

  it('blocks writes after completion until a new form session begins', () => {
    const key = 'guest:create:general:new';
    const values = {
      ...createDefaultWorkFormValues(),
      title: 'Children of Dune',
    };

    workFormDraftService.beginDraftSession(key);
    workFormDraftService.saveDraft(key, values);
    workFormDraftService.completeDraft(key);

    expect(workFormDraftService.saveDraft(key, values)).toBeNull();
    expect(workFormDraftService.getDraft(key)).toBeNull();

    workFormDraftService.beginDraftSession(key);

    expect(workFormDraftService.saveDraft(key, values)).not.toBeNull();
    expect(workFormDraftService.getDraft(key)?.values.title).toBe(
      'Children of Dune',
    );
  });
});
