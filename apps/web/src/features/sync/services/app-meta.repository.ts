import { type AppMetaRecord } from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/db/work-archive.db';

type DatabaseResolver = () => WorkArchiveDatabase;

export class AppMetaRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async getValue(key: string) {
    const entry = await this.getDb().appMeta.get(key);

    return entry?.value ?? null;
  }

  async setValue(key: string, value: string) {
    const entry: AppMetaRecord = {
      key,
      value,
    };

    await this.getDb().appMeta.put(entry);

    return entry;
  }
}

export const appMetaRepository = new AppMetaRepository();
