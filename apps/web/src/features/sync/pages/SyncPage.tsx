import { Link } from 'react-router-dom';
import { useState } from 'react';

import { PageHero } from '../../../shared/components/PageHero';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import type { SyncRunState } from '../services/sync.service';

import { useSyncDashboard } from '../hooks/useSyncDashboard';
import { type ManualSyncResult, syncService } from '../services/sync.service';
import { formatWorkDateTime } from '../../works/utils/work-options';

function formatOptionalDate(value: string | null) {
  return value ? formatWorkDateTime(value) : 'Not synced yet.';
}

function renderStateLabel(state: SyncRunState) {
  switch (state) {
    case 'syncing':
      return 'Syncing';
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'idle':
    default:
      return 'Idle';
  }
}

export function SyncPage() {
  const { mode, user } = useAuthSession();
  const { queueItems, conflictWorks, error, isLoading, lastSuccessfulPullAt } =
    useSyncDashboard();
  const [syncState, setSyncState] = useState<SyncRunState>('idle');
  const [lastRun, setLastRun] = useState<ManualSyncResult | null>(null);
  const isGuestMode = mode !== 'authenticated';

  async function handleRunSync() {
    if (isGuestMode) {
      return;
    }

    setSyncState('syncing');

    const result = await syncService.runManualSync();

    setLastRun(result);
    setSyncState(result.state);
  }

  return (
    <div className="stack">
      <PageHero
        actions={
          <button
            disabled={isGuestMode || syncState === 'syncing'}
            onClick={() => {
              void handleRunSync();
            }}
            type="button"
          >
            {isGuestMode
              ? 'Sign in to sync'
              : syncState === 'syncing'
                ? 'Syncing...'
                : 'Run manual sync'}
          </button>
        }
        aside={
          <div className="sync-status-block">
            <span className={`sync-state-badge sync-state-${syncState}`}>
              {renderStateLabel(syncState)}
            </span>
          </div>
        }
        description={
          isGuestMode
            ? 'Guest mode keeps this archive on the current device. Sign in when you want remote sync.'
            : `Signed in as ${user?.email}. Manual sync sends local changes and brings remote updates back into this archive.`
        }
        eyebrow="Sync"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">{queueItems.length}</span>
              <span className="stat-pill-label">Queued items</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">{conflictWorks.length}</span>
              <span className="stat-pill-label">Conflicts</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">
                {formatOptionalDate(lastSuccessfulPullAt)}
              </span>
              <span className="stat-pill-label">Last successful pull</span>
            </div>
          </>
        }
        title="Sync status"
      />

      {isGuestMode && (
        <section className="panel stack">
          <div>
            <p className="eyebrow">Guest Mode</p>
            <h2 className="section-title">Sync is available after sign-in</h2>
            <p className="muted-copy">
              Guest/local data stays in the guest archive on this device.
              Remote sync starts only after you sign in or create an account
              for a protected, user-scoped archive.
            </p>
          </div>
          <div className="button-row">
            <Link className="secondary-link" to="/auth/login">
              Sign in
            </Link>
            <Link className="secondary-link" to="/auth/register">
              Sign up
            </Link>
          </div>
        </section>
      )}

      {error && (
        <div aria-live="polite" className="error-banner" role="alert">
          {error}
        </div>
      )}

      {lastRun && (
        <section className="panel stack">
          <div>
            <p className="eyebrow">Last Run</p>
            <h2 className="section-title">Most recent manual sync result</h2>
            <p className="muted-copy">
              Completed at {formatWorkDateTime(lastRun.completedAt)}
            </p>
          </div>

          <div className="sync-result-grid">
            <article className="sync-result-card">
              <h3>Push</h3>
              <p className="muted-copy">
                Attempted {lastRun.push.attemptedCount}, applied{' '}
                {lastRun.push.appliedCount}, conflicts{' '}
                {lastRun.push.conflictCount}, failed {lastRun.push.failedCount}.
              </p>
              <p className="muted-copy">
                Processed at {formatOptionalDate(lastRun.push.processedAt)}
              </p>
            </article>

            <article className="sync-result-card">
              <h3>Pull</h3>
              <p className="muted-copy">
                Pulled {lastRun.pull.pulledCount}, applied{' '}
                {lastRun.pull.appliedCount}, skipped {lastRun.pull.skippedCount}
                .
              </p>
              <p className="muted-copy">
                Pulled at {formatOptionalDate(lastRun.pull.pulledAt)}
              </p>
            </article>
          </div>

          <div className="stack">
            {lastRun.push.messages.map((message, index) => (
              <p className="muted-copy" key={`push-${index}-${message}`}>
                Push: {message}
              </p>
            ))}
            {lastRun.pull.messages.map((message, index) => (
              <p className="muted-copy" key={`pull-${index}-${message}`}>
                Pull: {message}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="panel stack">
        <div>
          <p className="eyebrow">Queue</p>
          <h2 className="section-title">Queued local changes</h2>
        </div>

        {isLoading && <p className="muted-copy">Loading queued sync work...</p>}

        {!isLoading && queueItems.length === 0 && (
          <p className="muted-copy">
            No queued items. Local data is waiting on nothing.
          </p>
        )}

        {!isLoading && queueItems.length > 0 && (
          <div className="sync-list">
            {queueItems.map((item) => (
              <article className="sync-list-item" key={item.id}>
                <div className="page-header">
                  <div>
                    <h3 className="card-title">{item.payload.title}</h3>
                    <p className="muted-copy">
                      {item.operation} work {item.entityId}
                    </p>
                  </div>
                  <span className="sync-queue-meta">
                    retries {item.retryCount}
                  </span>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>Local updatedAt</dt>
                    <dd>{formatWorkDateTime(item.payload.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Sync status</dt>
                    <dd>{item.payload.syncStatus}</dd>
                  </div>
                  <div>
                    <dt>Server version</dt>
                    <dd>{item.payload.serverVersion}</dd>
                  </div>
                </dl>

                {item.lastError && (
                  <div aria-live="polite" className="error-banner" role="alert">
                    {item.lastError}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Conflicts</p>
          <h2 className="section-title">Works that need inspection</h2>
        </div>

        {!isLoading && conflictWorks.length === 0 && (
          <p className="muted-copy">
            No conflicted works are currently marked locally.
          </p>
        )}

        {!isLoading && conflictWorks.length > 0 && (
          <div className="sync-list">
            {conflictWorks.map((work) => (
              <article className="sync-list-item" key={work.id}>
                <div className="page-header">
                  <div>
                    <h3 className="card-title">{work.title}</h3>
                    <p className="muted-copy">{work.id}</p>
                  </div>
                  <span className="sync-queue-meta">conflict</span>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>updatedAt</dt>
                    <dd>{formatWorkDateTime(work.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>deletedAt</dt>
                    <dd>{formatOptionalDate(work.deletedAt)}</dd>
                  </div>
                  <div>
                    <dt>serverVersion</dt>
                    <dd>{work.serverVersion}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
