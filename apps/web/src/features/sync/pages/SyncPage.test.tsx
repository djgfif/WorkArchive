import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { workArchiveDbManager } from '../../works/db/work-archive.db';
import { worksService } from '../../works/services/works.service';
import { syncQueueRepository } from '../services/sync-queue.repository';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('SyncPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('runs a manual sync and shows the success state', async () => {
    workArchiveDbManager.switchToUser('user-1');
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    const localWork = await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
    });
    const queueItems = await syncQueueRepository.listAll();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'user-1',
          email: 'frieren@example.com',
          nickname: '',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          processedAt: '2026-04-18T01:00:00.000Z',
          results: [
            {
              queueId: queueItems[0]!.id,
              entityId: localWork.id,
              entityType: 'work',
              status: 'applied',
              message: 'Queued record created on the server.',
              work: {
                ...localWork,
                syncStatus: 'synced',
                serverVersion: 1,
                updatedAt: '2026-04-18T01:00:00.000Z',
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          pulledAt: '2026-04-18T01:00:01.000Z',
          nextSince: '2026-04-18T01:00:00.000Z',
          changes: [],
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/sync'],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('Queued items')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(await screen.findByText('Dune')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run manual sync/i }));

    expect(await screen.findByText('Success')).toBeInTheDocument();
    expect(
      await screen.findByText(/Attempted 1, applied 1/),
    ).toBeInTheDocument();
    expect(await screen.findByText(/No queued items/)).toBeInTheDocument();

    const pushHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    const pullHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;

    expect(pushHeaders.get('authorization')).toBe('Bearer access-token');
    expect(pullHeaders.get('authorization')).toBe('Bearer access-token');
  });

  it('shows explicit guest mode messaging and disables manual sync', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/sync'],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByText('Sync is available after sign-in'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Remote sync is unavailable until you sign in/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in to sync/i }),
    ).toBeDisabled();
  });

  it('returns to guest mode when a protected sync request cannot refresh the session', async () => {
    workArchiveDbManager.switchToUser('user-1');
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
      }),
    );

    await worksService.createWork({
      type: 'novel',
      title: 'Dune',
      author: 'Frank Herbert',
      genres: ['Science Fiction'],
      description: '',
      thumbnailUrl: '',
      status: 'planned',
      rating: null,
      shortReview: '',
      review: '',
      tier: null,
      favorite: false,
    });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired token.',
            },
            401,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired refresh token.',
            },
            401,
          ),
        ),
    );

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/sync'],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await screen.findByText('frieren@example.com');
    await user.click(screen.getByRole('button', { name: /run manual sync/i }));

    expect(
      await screen.findByText('Sync is available after sign-in'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
  });
});
