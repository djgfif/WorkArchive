import fc from 'fast-check';
import { describe, it } from '@jest/globals';
import { ProgressUnit, WorkType } from '@prisma/client';

import {
  canCreateReleaseRecord,
  canUseProgressUnit,
  getDefaultProgressUnit,
} from '../src/modules/recording/recording-policy';

describe('recording policy properties', () => {
  const workTypeArbitrary = fc.constantFrom(...Object.values(WorkType));
  const progressUnitArbitrary = fc.constantFrom(...Object.values(ProgressUnit));

  it('always allows the default progress unit when one exists', () => {
    fc.assert(
      fc.property(workTypeArbitrary, (type) => {
        const defaultUnit = getDefaultProgressUnit(type);

        return defaultUnit === null || canUseProgressUnit(type, defaultUnit);
      }),
    );
  });

  it('only release-record-capable types can use volume progress', () => {
    fc.assert(
      fc.property(workTypeArbitrary, (type) => {
        return (
          canUseProgressUnit(type, ProgressUnit.volume) ===
          canCreateReleaseRecord(type)
        );
      }),
    );
  });

  it('never accepts unrelated progress units for non-progress works', () => {
    fc.assert(
      fc.property(workTypeArbitrary, progressUnitArbitrary, (type, unit) => {
        if (getDefaultProgressUnit(type) !== null || canCreateReleaseRecord(type)) {
          return true;
        }

        return !canUseProgressUnit(type, unit);
      }),
    );
  });
});
