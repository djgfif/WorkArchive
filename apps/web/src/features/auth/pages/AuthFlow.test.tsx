import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { getLinkByHref, openProfileMenu } from '../../../test/ui-helpers';
import { AuthProvider } from '../context/AuthProvider';
import { readStoredAuthTokens } from '../services/auth-storage';
import { guestTransferService } from '../services/guest-transfer.service';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function sessionBody(accessToken = 'access-token') {
  return {
    accessToken,
    user: {
      authAccounts: [
        {
          email: 'frieren@example.com',
          emailVerified: true,
          name: 'Frieren',
          pictureUrl: '',
          provider: 'google',
        },
      ],
      email: 'frieren@example.com',
      handle: null,
      id: 'user-1',
      nickname: 'Frieren',
      role: 'user',
    },
  };
}

function authStartupFetchMock({
  googleConfigured = true,
}: {
  googleConfigured?: boolean;
} = {}) {
  return vi.fn((input: string | URL | Request) => {
    const requestUrl = String(input);

    if (requestUrl.includes('/auth/google/status')) {
      return Promise.resolve(
        jsonResponse({
          configured: googleConfigured,
        }),
      );
    }

    if (requestUrl.includes('/auth/refresh')) {
      return Promise.resolve(
        jsonResponse(
          {
            message: 'Invalid or expired refresh token.',
          },
          401,
        ),
      );
    }

    return Promise.resolve(
      jsonResponse(
        {
          message: 'Not found.',
        },
        404,
      ),
    );
  });
}

describe('Auth flow', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows Google-first login and hides email/password auth', async () => {
    vi.stubGlobal('fetch', authStartupFetchMock());

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/login'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(getLinkByHref('/')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Google로 계속하기' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/이메일/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/비밀번호/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '게스트로 계속하기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/works');
    });
  });

  it('disables Google login when OAuth is not configured', async () => {
    vi.stubGlobal(
      'fetch',
      authStartupFetchMock({
        googleConfigured: false,
      }),
    );

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/login?google=unconfigured'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('Google OAuth 설정 필요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '게스트로 계속하기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/works');
    });
  });

  it('redirects register and password reset routes back to Google login', async () => {
    vi.stubGlobal('fetch', authStartupFetchMock());

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/register'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Google로 계속하기' })).toBeInTheDocument();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });

  it('completes Google login from an already restored session and opens transfer review when guest data is pending', async () => {
    vi.spyOn(guestTransferService, 'getPendingReview').mockResolvedValue({
      duplicateCount: 0,
      fingerprint: 'pending-review',
      items: [],
      totalActiveCount: 1,
    });

    window.sessionStorage.setItem(
      'work-archive.auth.googleReturnTo',
      '/works?view=list',
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionBody('startup-access-token')));

    vi.stubGlobal('fetch', fetchMock);

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/google/complete'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/account/transfer');
    });
    expect(readStoredAuthTokens()).toEqual({
      accessToken: 'startup-access-token',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('work-archive.auth.googleReturnTo')).toBeNull();
  });

  it('returns to the saved pre-login route after Google login completes', async () => {
    vi.spyOn(guestTransferService, 'getPendingReview').mockResolvedValue(null);
    window.sessionStorage.setItem(
      'work-archive.auth.googleReturnTo',
      '/works?view=list',
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sessionBody('startup-access-token')));

    vi.stubGlobal('fetch', fetchMock);

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/google/complete'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/works');
      expect(router.state.location.search).toBe('?view=list');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('work-archive.auth.googleReturnTo')).toBeNull();
  });

  it.each([
    '/auth/login',
    '/auth?google=failed',
    'https://example.com/works',
    '//example.com/works',
  ])('falls back to home when the saved Google return route is not app-safe: %s', async (returnTo) => {
    vi.spyOn(guestTransferService, 'getPendingReview').mockResolvedValue(null);
    window.sessionStorage.setItem(
      'work-archive.auth.googleReturnTo',
      returnTo,
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse(sessionBody('startup-access-token'))),
    );

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/google/complete'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(window.sessionStorage.getItem('work-archive.auth.googleReturnTo')).toBeNull();
  });

  it('restores a session by calling /auth/refresh on startup', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'legacy-access-token',
      }),
    );

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(sessionBody('refreshed-access-token')),
    );

    vi.stubGlobal('fetch', fetchMock);

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByRole('button', { name: /frieren@example.com/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
  });

  it('falls back to guest mode when startup refresh fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Invalid or expired refresh token.',
          },
          401,
        ),
      ),
    );

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await openProfileMenu(user, /게스트/);
    expect(await screen.findByRole('menuitem', { name: /로그인/ })).toBeInTheDocument();
  });

  it('logs out by clearing the refresh cookie session and returning to guest mode', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(sessionBody('refreshed-access-token')))
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    );

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await openProfileMenu(user, /frieren@example.com/);
    await user.click(await screen.findByRole('menuitem', { name: /로그아웃/ }));

    await openProfileMenu(user, /게스트/);
    expect(await screen.findByRole('menuitem', { name: /로그인/ })).toBeInTheDocument();
  });
});
