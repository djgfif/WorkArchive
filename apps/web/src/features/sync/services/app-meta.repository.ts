import { type AppMetaRecord } from '@work-archive/shared-types';

import {
  getWorkArchiveDb,
  type WorkArchiveDatabase,
} from '../../works/storage';

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

  async getOrCreateValue(key: string, createValue: () => string) {
    const db = this.getDb();

    return db.transaction('rw', db.appMeta, async () => {
      const existing = await db.appMeta.get(key);

      if (existing) {
        return existing.value;
      }

      const value = createValue();

      await db.appMeta.put({
        key,
        value,
      });

      return value;
    });
  }

  async removeValue(key: string) {
    await this.getDb().appMeta.delete(key);
  }

  async acquireLease(
    key: string,
    lease: {
      acquiredAt: string;
      expiresAt: string;
      ownerId: string;
      token: string;
    },
  ) {
    const db = this.getDb();
    const nowMs = Date.parse(lease.acquiredAt);

    return db.transaction('rw', db.appMeta, async () => {
      const existing = await db.appMeta.get(key);

      if (existing) {
        try {
          const parsed = JSON.parse(existing.value) as {
            expiresAt?: string;
            ownerId?: string;
          };
          const expiresAtMs =
            typeof parsed.expiresAt === 'string'
              ? Date.parse(parsed.expiresAt)
              : Number.NaN;

          if (
            Number.isFinite(expiresAtMs) &&
            expiresAtMs > nowMs
          ) {
            return null;
          }
        } catch {
          // Malformed legacy lease metadata is treated as expired.
        }
      }

      await db.appMeta.put({
        key,
        value: JSON.stringify(lease),
      });

      return lease;
    });
  }

  async releaseLease(key: string, token: string) {
    const db = this.getDb();

    await db.transaction('rw', db.appMeta, async () => {
      const existing = await db.appMeta.get(key);

      if (!existing) {
        return;
      }

      try {
        const parsed = JSON.parse(existing.value) as { token?: string };

        if (parsed.token === token) {
          await db.appMeta.delete(key);
        }
      } catch {
        await db.appMeta.delete(key);
      }
    });
  }

  async extendLease(key: string, token: string, nextExpiresAt: string) {
    const db = this.getDb();

    return db.transaction('rw', db.appMeta, async () => {
      const existing = await db.appMeta.get(key);

      if (!existing) {
        return null;
      }

      try {
        const parsed = JSON.parse(existing.value) as {
          acquiredAt?: string;
          expiresAt?: string;
          ownerId?: string;
          token?: string;
        };

        if (parsed.token !== token) {
          return null;
        }

        const extended = {
          ...parsed,
          expiresAt: nextExpiresAt,
          token,
        };

        await db.appMeta.put({
          key,
          value: JSON.stringify(extended),
        });

        return extended;
      } catch {
        return null;
      }
    });
  }
}

export const appMetaRepository = new AppMetaRepository();
