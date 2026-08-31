import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@features/auth';
import type * as SyncFeature from '@features/sync';
import {
  getArchiveSafetyPresentation,
  getArchiveSafetyState,
} from '@features/sync';
import type * as WorksFeature from '@features/works';
import { renderWithProviders } from '@test/render-with-providers';
import { AccountOverviewPage } from './AccountOverviewPage';

const mocks = vi.hoisted(() => ({
  useArchiveSafetyState: vi.fn(),
}));

vi.mock('@features/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof SyncFeature>()),
  useArchiveSafetyState: mocks.useArchiveSafetyState,
}));

vi.mock('@features/works', async (importOriginal) => ({
  ...(await importOriginal<typeof WorksFeature>()),
  useWorksOverview: () => ({
    averageRating: null,
    completedCount: 0,
    totalCount: 1,
  }),
}));

describe('AccountOverviewPage', () => {
  it('uses the shared safety language and never labels pull as backup', () => {
    const state = getArchiveSafetyState({
      activeRecordCount: 1,
      conflictCount: 0,
      failedCount: 0,
      lastJsonBackupAt: '2026-05-24T00:00:00.000Z',
      lastSuccessfulPullAt: '2026-05-24T01:00:00.000Z',
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
    });

    mocks.useArchiveSafetyState.mockReturnValue({
      isLoading: false,
      presentation: getArchiveSafetyPresentation(state),
      state,
    });

    const authValue: AuthContextValue = {
      archiveScopeKey: 'user-1',
      isLoading: false,
      mode: 'authenticated',
      sessionStatus: 'authenticated',
      signOut: vi.fn(async () => undefined),
      user: {
        avatarUrl: '',
        email: 'reader@example.com',
        handle: 'reader',
        id: 'user-1',
        nickname: 'Reader',
      },
    };

    renderWithProviders(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <AccountOverviewPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText('현재 확인된 위험 없음').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('마지막 JSON 백업')).toBeInTheDocument();
    expect(screen.getByText('마지막 성공 push')).toBeInTheDocument();
    expect(screen.getByText('마지막 성공 pull')).toBeInTheDocument();
    expect(screen.queryByText('최근 백업')).not.toBeInTheDocument();
  });
});
