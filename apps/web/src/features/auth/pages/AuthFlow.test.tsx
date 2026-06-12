import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '@app/router/routes';
import { renderWithProviders } from '@test/render-with-providers';
import { findLinkByHref, getLinkByHref, openProfileMenu } from '@test/ui-helpers';
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
      avatarUrl: '',
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
    window.history.pushState(null, '', '/');
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows Google backup CTA and hides email/password auth', async () => {
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

    const googleButton = await screen.findByRole('button', { name: 'Google로 백업 연결' });
    expect(getLinkByHref('/')).toBeInTheDocument();
    expect(googleButton).toBeInTheDocument();
    expect(googleButton).not.toBeDisabled();
    expect(screen.getByText('비공개 백업 · 여러 기기 동기화 · 검색 키 안전 보관')).toBeInTheDocument();
    expect(screen.getByText('로그인 전 기록 가능')).toBeInTheDocument();
    expect(screen.getByText('백업은 선택 사항')).toBeInTheDocument();
    expect(screen.queryByText('Local-first')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/이메일/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/비밀번호/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '로그인 없이 시작하기' }));

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
    expect(screen.getByText(/현재 이 환경에서는 Google 로그인을 사용할 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google로 백업 연결' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '로그인 없이 시작하기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/works');
    });
  });

  it('shows a short Google failure message and keeps local start available', async () => {
    vi.stubGlobal('fetch', authStartupFetchMock());

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/login?google=failed'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('Google 로그인을 완료하지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('다시 시도하거나 로그인 없이 계속할 수 있습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '로그인 없이 시작하기' }));

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

    expect(await screen.findByRole('button', { name: 'Google로 백업 연결' })).toBeInTheDocument();

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

  it('starts Google completion immediately on the browser callback path', async () => {
    window.history.pushState(null, '', '/auth/google/complete');

    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // Keep refresh pending so the assertion proves completion started.
          }),
      ),
    );

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/google/complete'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('세션 복원 중')).toBeInTheDocument();
  });

  it('shows configuration guidance when Google callback reports an OAuth setup issue', async () => {
    window.history.pushState(null, '', '/auth/google/complete?google=unconfigured');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/google/complete?google=unconfigured'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('Google OAuth 설정이 필요합니다')).toBeInTheDocument();
    expect(screen.getByText(/현재 이 환경에서는 Google 로그인을 사용할 수 없습니다/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a network-specific error when Google completion cannot reach the API', async () => {
    window.history.pushState(null, '', '/auth/google/complete');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')),
    );

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/google/complete'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('네트워크에 연결할 수 없습니다')).toBeInTheDocument();
    expect(screen.getByText('인터넷 연결을 확인한 뒤 다시 시도해 주세요.')).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.queryByText('Work Archive를 준비하고 있습니다')).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole('button', { name: /계정 메뉴: 게스트/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('link', {
        name: /동기화 상태: 게스트 로컬 전용/,
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/account');
    });
    expect(await findLinkByHref('/auth/login', /로그인/)).toBeInTheDocument();
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
    await user.click(await screen.findByText('로그아웃'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /게스트/ })).toBeInTheDocument();
    });
  });
});
