import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { useArchiveSafetyState } from '../hooks/useArchiveSafetyState';
import {
  getArchiveSafetyPresentation,
  getArchiveSafetyState,
} from '../utils/sync-safety-state';
import { SyncSafetyBadge } from './SyncSafetyBadge';

vi.mock('../hooks/useArchiveSafetyState', () => ({
  useArchiveSafetyState: vi.fn(),
}));

function mockArchiveSafety(
  overrides: Partial<Parameters<typeof getArchiveSafetyState>[0]> = {},
) {
  const state = getArchiveSafetyState({
    activeRecordCount: 1,
    conflictCount: 0,
    failedCount: 0,
    lastJsonBackupAt: '2026-05-24T00:00:00.000Z',
    lastSuccessfulPullAt: null,
    lastSuccessfulPushAt: null,
    mode: 'authenticated',
    now: new Date('2026-05-25T00:00:00.000Z'),
    pendingCount: 0,
    requeuedCount: 0,
    staleStatusAt: null,
    storageState: {
      persisted: true,
      quotaBytes: null,
      supported: true,
      usageBytes: null,
    },
    ...overrides,
  });

  vi.mocked(useArchiveSafetyState).mockReturnValue({
    isLoading: false,
    presentation: getArchiveSafetyPresentation(state),
    state,
  });
}

function renderBadge() {
  renderWithProviders(
    <MemoryRouter>
      <SyncSafetyBadge />
    </MemoryRouter>,
  );
}

describe('SyncSafetyBadge', () => {
  it('shows a local-only state for guests without calling it a backup', () => {
    mockArchiveSafety({ mode: 'guest' });
    renderBadge();

    const link = screen.getByRole('link', { name: /게스트 로컬 전용/ });
    expect(link).toHaveAttribute('href', '/account/settings#data-backup');
    expect(link).not.toHaveTextContent('백업됨');
  });

  it('links failures and conflicts directly to the recovery section', () => {
    mockArchiveSafety({ conflictCount: 1, failedCount: 1 });
    renderBadge();

    expect(screen.getByRole('link', { name: /직접 확인 2/ })).toHaveAttribute(
      'href',
      '/account/settings#account-backup-recovery',
    );
  });

  it('prioritizes queued pushes over an earlier successful push', () => {
    mockArchiveSafety({
      lastSuccessfulPushAt: '2026-05-24T00:00:00.000Z',
      pendingCount: 1,
    });
    renderBadge();

    expect(screen.getByRole('link', { name: /push 대기 1건/ }))
      .toHaveAttribute('href', '/account/settings#data-backup');
  });

  it('uses the last successful push as sync evidence', () => {
    mockArchiveSafety({
      lastSuccessfulPullAt: '2026-05-24T01:00:00.000Z',
      lastSuccessfulPushAt: '2026-05-24T00:00:00.000Z',
    });
    renderBadge();

    const link = screen.getByRole('link', { name: /마지막 push/ });
    expect(link).not.toHaveTextContent('최근 백업됨');
  });
});
