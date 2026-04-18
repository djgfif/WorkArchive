import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { AuthProvider } from '../context/AuthProvider';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('Auth flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers a user account and signs out back to guest mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: {
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
        }),
      ),
    );

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/register'],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/^Email$/i), 'frieren@example.com');
    await user.type(
      screen.getByLabelText(/^Password$/i),
      'strong-password-123',
    );
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(await screen.findByText('Signed in')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(await screen.findByText('Guest mode')).toBeInTheDocument();
    expect(
      screen.getByText(/Local-only archive on this device/i),
    ).toBeInTheDocument();
  });

  it('restores a stored session by calling /auth/me on startup', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          id: 'user-1',
          email: 'frieren@example.com',
          nickname: '',
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        headers: expect.any(Headers),
        method: 'GET',
      }),
    );
  });
});
