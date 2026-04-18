import { type AppMetaRecord } from '@work-archive/shared-types';

import {
  type WorkArchiveDatabase,
  workArchiveDb,
} from '../../works/db/work-archive.db';

export class AppMetaRepository {
  constructor(private readonly db: WorkArchiveDatabase = workArchiveDb) {}

  async getValue(key: string) {
    const entry = await this.db.appMeta.get(key);

    return entry?.value ?? null;
  }

  async setValue(key: string, value: string) {
    const entry: AppMetaRecord = {
      key,
      value,
    };

    await this.db.appMeta.put(entry);

    return entry;
  }
}

export const appMetaRepository = new AppMetaRepository();
