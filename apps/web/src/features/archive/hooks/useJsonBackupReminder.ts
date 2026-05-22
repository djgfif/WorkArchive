import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

import { appMetaRepository } from '../../sync/services/app-meta.repository';
import {
  getJsonBackupReminderStatus,
  LAST_JSON_EXPORT_AT_META_KEY,
} from '../utils/json-backup-reminder';

export function useJsonBackupReminder(
  activeWorkCount: number,
  archiveScopeKey: string,
) {
  const [lastJsonExportAt, setLastJsonExportAt] = useState<string | null>(null);

  useEffect(() => {
    const subscription = liveQuery(() =>
      appMetaRepository.getValue(LAST_JSON_EXPORT_AT_META_KEY),
    ).subscribe({
      next: setLastJsonExportAt,
      error: () => setLastJsonExportAt(null),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [archiveScopeKey]);

  return getJsonBackupReminderStatus({
    activeWorkCount,
    lastJsonExportAt,
  });
}
