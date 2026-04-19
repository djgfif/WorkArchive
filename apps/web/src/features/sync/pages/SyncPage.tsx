import { Link } from 'react-router-dom';
import { useState } from 'react';

import { PageHero } from '../../../shared/components/PageHero';
import { useAuthSession } from '../../auth/hooks/useAuthSession';
import type { SyncRunState } from '../services/sync.service';

import { useSyncDashboard } from '../hooks/useSyncDashboard';
import { type ManualSyncResult, syncService } from '../services/sync.service';
import {
  formatWorkDateTime,
  getWorkSyncStatusLabel,
} from '../../works/utils/work-options';

function formatOptionalDate(value: string | null, fallback = '아직 없음') {
  return value ? formatWorkDateTime(value) : fallback;
}

function renderStateLabel(state: SyncRunState) {
  switch (state) {
    case 'syncing':
      return '동기화 중';
    case 'success':
      return '완료';
    case 'failed':
      return '실패';
    case 'idle':
    default:
      return '대기';
  }
}

function getSyncOperationLabel(operation: string) {
  switch (operation) {
    case 'create':
      return '추가';
    case 'update':
      return '수정';
    case 'delete':
      return '삭제';
    default:
      return operation;
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
          <>
            <Link className="secondary-link" to="/profile">
              프로필로 돌아가기
            </Link>
            <button
              disabled={isGuestMode || syncState === 'syncing'}
              onClick={() => {
                void handleRunSync();
              }}
              type="button"
            >
              {isGuestMode
                ? '로그인 후 동기화'
                : syncState === 'syncing'
                  ? '동기화 중...'
                  : '수동 동기화'}
            </button>
          </>
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
            ? '게스트 모드에서는 이 기기에만 저장됩니다. 로그인하면 기록을 동기화할 수 있습니다.'
            : `${user?.email}로 로그인되어 있습니다. 지금 기록을 동기화해 최신 상태로 맞출 수 있습니다.`
        }
        eyebrow="동기화"
        meta={
          <>
            <div className="stat-pill">
              <span className="stat-pill-value">{queueItems.length}</span>
              <span className="stat-pill-label">대기 중</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">{conflictWorks.length}</span>
              <span className="stat-pill-label">충돌</span>
            </div>
            <div className="stat-pill">
              <span className="stat-pill-value">
                {formatOptionalDate(lastSuccessfulPullAt)}
              </span>
              <span className="stat-pill-label">최근 동기화</span>
            </div>
          </>
        }
        title="동기화 상태"
      />

      {isGuestMode && (
        <section className="panel stack">
          <div>
            <p className="eyebrow">게스트 모드</p>
            <h2 className="section-title">로그인하면 동기화할 수 있습니다</h2>
            <p className="muted-copy">
              게스트 모드에서는 기록이 이 기기에만 저장됩니다.
              계정으로 로그인하면 기록을 동기화할 수 있습니다.
            </p>
          </div>
          <div className="button-row">
            <Link className="secondary-link" to="/auth/login">
              로그인
            </Link>
            <Link className="secondary-link" to="/auth/register">
              회원가입
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
            <p className="eyebrow">최근 실행</p>
            <h2 className="section-title">최근 동기화 결과</h2>
            <p className="muted-copy">
              실행 시각 {formatWorkDateTime(lastRun.completedAt)}
            </p>
          </div>

          <div className="sync-result-grid">
            <article className="sync-result-card">
              <h3>보내기</h3>
              <p className="muted-copy">
                보내기 {lastRun.push.attemptedCount}건, 반영{' '}
                {lastRun.push.appliedCount}건, 충돌{' '}
                {lastRun.push.conflictCount}건, 실패 {lastRun.push.failedCount}건.
              </p>
              <p className="muted-copy">
                처리 시각 {formatOptionalDate(lastRun.push.processedAt)}
              </p>
            </article>

            <article className="sync-result-card">
              <h3>가져오기</h3>
              <p className="muted-copy">
                가져온 {lastRun.pull.pulledCount}건 중 반영{' '}
                {lastRun.pull.appliedCount}건, 보류 {lastRun.pull.skippedCount}건.
              </p>
              <p className="muted-copy">
                가져온 시각 {formatOptionalDate(lastRun.pull.pulledAt)}
              </p>
            </article>
          </div>

          <div className="stack">
            {lastRun.push.messages.map((message, index) => (
              <p className="muted-copy" key={`push-${index}-${message}`}>
                보내기: {message}
              </p>
            ))}
            {lastRun.pull.messages.map((message, index) => (
              <p className="muted-copy" key={`pull-${index}-${message}`}>
                가져오기: {message}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="panel stack">
        <div>
          <p className="eyebrow">대기열</p>
          <h2 className="section-title">동기화 대기 중</h2>
        </div>

        {isLoading && <p className="muted-copy">동기화 상태를 불러오는 중입니다.</p>}

        {!isLoading && queueItems.length === 0 && (
          <p className="muted-copy">지금은 동기화할 내용이 없습니다.</p>
        )}

        {!isLoading && queueItems.length > 0 && (
          <div className="sync-list">
            {queueItems.map((item) => (
              <article className="sync-list-item" key={item.id}>
                <div className="page-header">
                  <div>
                    <h3 className="card-title">{item.payload.title}</h3>
                    <p className="muted-copy">{getSyncOperationLabel(item.operation)} 요청</p>
                  </div>
                  <span className="sync-queue-meta">
                    재시도 {item.retryCount}회
                  </span>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>최근 수정</dt>
                    <dd>{formatWorkDateTime(item.payload.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>동기화 상태</dt>
                    <dd>{getWorkSyncStatusLabel(item.payload.syncStatus)}</dd>
                  </div>
                  <div>
                    <dt>서버 버전</dt>
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
          <p className="eyebrow">충돌</p>
          <h2 className="section-title">확인이 필요한 작품</h2>
        </div>

        {!isLoading && conflictWorks.length === 0 && (
          <p className="muted-copy">지금은 확인이 필요한 충돌이 없습니다.</p>
        )}

        {!isLoading && conflictWorks.length > 0 && (
          <div className="sync-list">
            {conflictWorks.map((work) => (
              <article className="sync-list-item" key={work.id}>
                <div className="page-header">
                  <div>
                    <h3 className="card-title">{work.title}</h3>
                    <p className="muted-copy">동기화 상태를 확인해주세요.</p>
                  </div>
                  <span className="sync-queue-meta">충돌</span>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>최근 수정</dt>
                    <dd>{formatWorkDateTime(work.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>삭제됨</dt>
                    <dd>{formatOptionalDate(work.deletedAt, '없음')}</dd>
                  </div>
                  <div>
                    <dt>서버 버전</dt>
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
