import {
  appMetaRepository,
  type AppMetaRepository,
} from './app-meta.repository';

export const SYNC_LEASE_BUSY_RETRY_AFTER_MS = 1_000;
const SYNC_CLIENT_ID_KEY = 'sync.clientId';
const SYNC_LEASE_KEY = 'sync.activeLease';
const SYNC_LEASE_TTL_MS = 25_000;
const TAB_SESSION_ID = crypto.randomUUID();

export type SyncLeaseOperation = 'pull' | 'push';

export interface SyncClientIdentity {
  clientId: string;
  ownerId: string;
}

export interface SyncLeaseContext extends SyncClientIdentity {
  leaseToken: string;
}

function getNowIso() {
  return new Date().toISOString();
}

function addMilliseconds(value: string, milliseconds: number) {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

export class SyncLeaseService {
  constructor(
    private readonly metaRepo: AppMetaRepository = appMetaRepository,
  ) {}

  async getClientIdentity(): Promise<SyncClientIdentity> {
    const clientId = await this.metaRepo.getOrCreateValue(
      SYNC_CLIENT_ID_KEY,
      () => crypto.randomUUID(),
    );

    return {
      clientId,
      ownerId: `${clientId}:${TAB_SESSION_ID}`,
    };
  }

  async withSyncLease<T>(
    operation: SyncLeaseOperation,
    onBusy: () => T,
    run: (context: SyncLeaseContext) => Promise<T>,
  ): Promise<T> {
    const identity = await this.getClientIdentity();
    const acquiredAt = getNowIso();
    const lease = await this.metaRepo.acquireLease(SYNC_LEASE_KEY, {
      acquiredAt,
      expiresAt: addMilliseconds(acquiredAt, SYNC_LEASE_TTL_MS),
      ownerId: identity.ownerId,
      token: `${operation}:${crypto.randomUUID()}`,
    });

    if (!lease) {
      return onBusy();
    }

    try {
      return await run({
        ...identity,
        leaseToken: lease.token,
      });
    } finally {
      await this.metaRepo.releaseLease(SYNC_LEASE_KEY, lease.token);
    }
  }

  extendActiveSyncLease(context: SyncLeaseContext) {
    return this.metaRepo.extendLease(
      SYNC_LEASE_KEY,
      context.leaseToken,
      addMilliseconds(getNowIso(), SYNC_LEASE_TTL_MS),
    );
  }
}

export const syncLeaseService = new SyncLeaseService();
