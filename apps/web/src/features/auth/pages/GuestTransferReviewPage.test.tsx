import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkRecord } from '@work-archive/shared-types';
import { renderWithProviders } from '@test/render-with-providers';
import { AuthContext } from '../context/AuthContext';
import { GuestTransferReviewPage } from './GuestTransferReviewPage';
import { guestTransferService } from '../services/guest-transfer.service';

function buildWorkRecord(
  id: string,
  overrides: Partial<WorkRecord> = {},
): WorkRecord {
  const now = '2026-05-21T00:00:00.000Z';

  return {
    author: '',
    createdAt: now,
    deletedAt: null,
    description: '',
    favorite: false,
    genres: [],
    id,
    personalTags: [],
    rating: null,
    review: '',
    serverVersion: 0,
    shortReview: '',
    status: 'planned',
    syncStatus: 'local-only',
    thumbnailUrl: '',
    title: `work-${id}`,
    type: 'novel',
    updatedAt: now,
    ...overrides,
  };
}

function renderTransferPage() {
  const router = createMemoryRouter(
    [
      { element: <GuestTransferReviewPage />, path: '/account/transfer' },
      { element: <div>login</div>, path: '/auth/login' },
      { element: <div>works</div>, path: '/works' },
      { element: <div>account</div>, path: '/account' },
    ],
    { initialEntries: ['/account/transfer'] },
  );

  renderWithProviders(
    <AuthContext.Provider
      value={{
        archiveScopeKey: 'user-user-1',
        isLoading: false,
        mode: 'authenticated',
        sessionStatus: 'authenticated',
        signOut: vi.fn(),
        user: {
          avatarUrl: '',
          email: 'user@example.com',
          id: 'user-1',
          nickname: 'User',
        },
      }}
    >
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );

  return router;
}

describe('GuestTransferReviewPage', () => {
  beforeEach(() => {
    vi.spyOn(guestTransferService, 'getPendingReview').mockResolvedValue({
      duplicateCount: 1,
      fingerprint: 'guest-fingerprint',
      items: [
        {
          duplicateCandidates: [],
          guestWork: buildWorkRecord('guest-safe', {
            title: '새 게스트 기록',
          }),
          hasDuplicates: false,
        },
        {
          duplicateCandidates: [
            buildWorkRecord('account-duplicate', {
              status: 'completed',
              title: '중복 후보',
            }),
          ],
          guestWork: buildWorkRecord('guest-duplicate', {
            title: '중복 후보',
          }),
          hasDuplicates: true,
        },
      ],
      totalActiveCount: 2,
    });
    vi.spyOn(guestTransferService, 'importSelected').mockResolvedValue({
      importedCount: 2,
      importedWorks: [],
      skippedCount: 0,
    });
    vi.spyOn(guestTransferService, 'markReviewed').mockResolvedValue(undefined);
  });

  it('keeps duplicate candidates out of the default selection but allows explicit select all', async () => {
    const user = userEvent.setup();

    renderTransferPage();

    expect(
      await screen.findByRole('heading', { name: '게스트 기록 검토' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '건너뛰어도 guest 기록은 이 브라우저의 게스트 아카이브에 남습니다. 계정 아카이브로 복사하지 않을 뿐입니다.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '선택한 1개 가져오기' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '전체 선택' }));

    expect(
      screen.getByRole('button', { name: '선택한 2개 가져오기' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '선택 해제' }));

    expect(
      screen.getByRole('button', { name: '선택한 0개 가져오기' }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '전체 선택' }));
    await user.click(
      screen.getByRole('button', { name: '선택한 2개 가져오기' }),
    );

    await waitFor(() =>
      expect(guestTransferService.importSelected).toHaveBeenCalledWith(
        'user-1',
        'guest-fingerprint',
        ['guest-safe', 'guest-duplicate'],
      ),
    );
  });

  it('marks the current fingerprint as reviewed when skipping without deleting guest records', async () => {
    const user = userEvent.setup();

    renderTransferPage();

    expect(
      await screen.findByText(
        '건너뛰어도 guest 기록은 이 브라우저의 게스트 아카이브에 남습니다. 계정 아카이브로 복사하지 않을 뿐입니다.',
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '이번 guest 기록은 건너뛰기' }),
    );

    await waitFor(() =>
      expect(guestTransferService.markReviewed).toHaveBeenCalledWith(
        'user-1',
        'guest-fingerprint',
      ),
    );
    expect(
      await screen.findByText(
        '이번 guest 기록은 건너뛰었습니다. 나중에 새 기록이 생기면 다시 검토할 수 있습니다.',
      ),
    ).toBeInTheDocument();
  });
});
