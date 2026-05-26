import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { AuthContext, type AuthContextValue } from '@features/auth';
import { useSyncDashboard } from '../hooks/useSyncDashboard';
import { getSyncSafetyBadgeState } from '../utils/sync-safety-state';
import { SyncSafetyBadge } from './SyncSafetyBadge';

vi.mock('../hooks/useSyncDashboard', () => ({
  useSyncDashboard: vi.fn(),
}));

function mockSyncDashboard(
  overrides: Partial<ReturnType<typeof useSyncDashboard>> = {},
) {
  vi.mocked(useSyncDashboard).mockReturnValue({
    conflictItems: [],
    conflictWorks: [],
    error: null,
    failedItems: [],
    isLoading: false,
    lastSuccessfulPullAt: null,
    pendingItems: [],
    queueItems: [],
    staleStatusAt: null,
    staleStatusReason: null,
    ...overrides,
  });
}

function renderBadge(mode: 'authenticated' | 'guest' = 'authenticated') {
  const authValue: AuthContextValue = {
    archiveScopeKey: mode === 'authenticated' ? 'user-1' : 'guest',
    isLoading: false,
    mode,
    signOut: vi.fn(async () => undefined),
    user: null,
  };

  renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <SyncSafetyBadge />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('SyncSafetyBadge', () => {
  it('shows local-only state for guests', () => {
    mockSyncDashboard();
    renderBadge('guest');

    expect(
      screen.getByRole('link', { name: /게스트 로컬 전용/ }),
    ).toHaveAttribute('href', '/account');
  });

  it('prioritizes conflict and failed items', () => {
    expect(
      getSyncSafetyBadgeState({
        conflictCount: 1,
        failedCount: 1,
        lastSuccessfulPullAt: null,
        mode: 'authenticated',
        pendingCount: 1,
      }).label,
    ).toBe('직접 확인 2');
  });

  it('shows requeued state after a safe automatic merge', () => {
    expect(
      getSyncSafetyBadgeState({
        conflictCount: 0,
        failedCount: 0,
        lastSuccessfulPullAt: null,
        mode: 'authenticated',
        pendingCount: 1,
        requeuedCount: 1,
      }).label,
    ).toBe('자동 병합 후 재시도 1');
  });

  it('shows pending backup state before recent backup state', () => {
    expect(
      getSyncSafetyBadgeState({
        conflictCount: 0,
        failedCount: 0,
        lastSuccessfulPullAt: '2026-05-24T00:00:00.000Z',
        mode: 'authenticated',
        pendingCount: 1,
      }).label,
    ).toBe('백업 대기 1');
  });

  it('shows stale remote check state before pending backup state', () => {
    expect(
      getSyncSafetyBadgeState({
        conflictCount: 0,
        failedCount: 0,
        lastSuccessfulPullAt: '2026-05-24T00:00:00.000Z',
        mode: 'authenticated',
        pendingCount: 1,
        staleStatusAt: '2026-05-26T00:00:00.000Z',
      }).label,
    ).toBe('원격 확인 필요');
  });

  it('shows recent backup state when the queue is clean', () => {
    expect(
      getSyncSafetyBadgeState({
        conflictCount: 0,
        failedCount: 0,
        lastSuccessfulPullAt: '2026-05-24T00:00:00.000Z',
        mode: 'authenticated',
        pendingCount: 0,
      }).label,
    ).toMatch(/^최근 백업됨/);
  });
});
