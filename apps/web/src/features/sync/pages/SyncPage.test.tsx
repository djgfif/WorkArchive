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

    expect(await screen.findByText('Queued items')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(await screen.findByText('Dune')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run manual sync/i }));

    expect(await screen.findByText('Success')).toBeInTheDocument();
    expect(
      await screen.findByText(/Attempted 1, applied 1/),
    ).toBeInTheDocument();
    expect(await screen.findByText(/No queued items/)).toBeInTheDocument();
  });
});
