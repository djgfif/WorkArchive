import type { UserReleaseRecord } from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../db/work-archive.db';

type DatabaseResolver = () => WorkArchiveDatabase;

export class ReleaseRecordsRepository {
  constructor(private readonly getDb: DatabaseResolver = getWorkArchiveDb) {}

  async create(record: UserReleaseRecord) {
    await this.getDb().releaseRecords.add(record);

    return record;
  }

  async update(record: UserReleaseRecord) {
    await this.getDb().releaseRecords.put(record);

    return record;
  }

  async bulkPut(records: UserReleaseRecord[]) {
    if (records.length === 0) {
      return records;
    }

    await this.getDb().releaseRecords.bulkPut(records);

    return records;
  }

  async getById(id: string) {
    return (await this.getDb().releaseRecords.get(id)) ?? null;
  }

  async getByUserWorkRecordAndRelease(
    userWorkRecordId: string,
    catalogReleaseId: string,
  ) {
    return (
      (await this.getDb()
        .releaseRecords.where('[userWorkRecordId+catalogReleaseId]')
        .equals([userWorkRecordId, catalogReleaseId])
        .first()) ?? null
    );
  }

  async listByUserWorkRecord(userWorkRecordId: string) {
    return this.getDb()
      .releaseRecords.where('userWorkRecordId')
      .equals(userWorkRecordId)
      .toArray();
  }
}

export const releaseRecordsRepository = new ReleaseRecordsRepository();
