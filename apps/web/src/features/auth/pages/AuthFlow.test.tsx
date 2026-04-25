import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../context/AuthProvider';
import { guestTransferService } from '../services/guest-transfer.service';

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

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(screen.queryByRole('button', { name: '라이트 모드' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '홈으로 돌아가기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '작품 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WA\s*워크 아카이브/ })).toHaveAttribute('href', '/');

    await user.type(screen.getByLabelText(/이메일/), 'frieren@example.com');
    await user.type(screen.getByLabelText(/비밀번호/), 'strong-password-123');
    await user.click(screen.getByRole('button', { name: '회원가입' }));

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'frieren@example.com' }));
    await user.click(await screen.findByRole('menuitem', { name: '로그아웃' }));

    expect(await screen.findByRole('link', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '회원가입' })).toBeInTheDocument();
  });

  it('navigates to guest transfer review after login when pending guest data exists', async () => {
    vi.spyOn(guestTransferService, 'getPendingReview').mockResolvedValue({
      duplicateCount: 0,
      fingerprint: 'pending-review',
      items: [],
      totalActiveCount: 1,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          accessToken: 'access-token',
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
      initialEntries: ['/auth/login'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/이메일/), 'frieren@example.com');
    await user.type(screen.getByLabelText(/비밀번호/), 'strong-password-123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('게스트 기록 검토')).toBeInTheDocument();
  });

  it('restores a stored session by calling /auth/me on startup', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );

    const fetchMock = vi.fn().mockResolvedValue(
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

    renderWithProviders(
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

  it('refreshes an expired stored session before entering authenticated mode', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'expired-access-token',
      }),
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Invalid or expired token.',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: 'rotated-access-token',
          user: {
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
        }),
      )
      .mockResolvedValueOnce(
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

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem('work-archive.auth.tokens') ?? 'null'),
    ).toEqual({
      accessToken: 'rotated-access-token',
      persistence: 'local',
    });

    const firstAttemptHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;

    expect(firstAttemptHeaders.get('authorization')).toBe(
      'Bearer expired-access-token',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      expect.stringContaining('/auth/refresh'),
    );
    expect(retryHeaders.get('authorization')).toBe(
      'Bearer rotated-access-token',
    );
  });

  it('stores login tokens in localStorage only when remember-me is checked', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        accessToken: 'access-token',
        user: {
          id: 'user-1',
          email: 'frieren@example.com',
          nickname: '',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/login'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(screen.queryByRole('button', { name: '라이트 모드' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '홈으로 돌아가기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '작품 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '비밀번호를 잊으셨나요?' })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/이메일/), 'frieren@example.com');
    await user.type(screen.getByLabelText(/비밀번호/), 'strong-password-123');
    await user.click(screen.getByLabelText('로그인 상태 유지'));
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem('work-archive.auth.tokens') ?? 'null'),
    ).toEqual({
      accessToken: 'access-token',
      persistence: 'local',
    });
    expect(window.sessionStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      rememberMe: true,
    });
  });

  it('uses sessionStorage for login tokens when remember-me is not checked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          accessToken: 'access-token',
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
      initialEntries: ['/auth/login'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/이메일/), 'frieren@example.com');
    await user.type(screen.getByLabelText(/비밀번호/), 'strong-password-123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(
      JSON.parse(window.sessionStorage.getItem('work-archive.auth.tokens') ?? 'null'),
    ).toEqual({
      accessToken: 'access-token',
      persistence: 'session',
    });
  });

  it('requests a development password reset link', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          developmentResetUrl:
            'http://127.0.0.1:53173/auth/password-reset/confirm?token=reset-token',
          message:
            '비밀번호 재설정 요청을 확인했습니다. 계정이 있으면 재설정 링크를 사용할 수 있습니다.',
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/auth/password-reset'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/이메일/), 'frieren@example.com');
    await user.click(screen.getByRole('button', { name: '재설정 링크 만들기' }));

    expect(await screen.findByText('개발용 복구 링크')).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      email: 'frieren@example.com',
    });
  });

  it('confirms a development password reset token', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        message: '비밀번호가 재설정되었습니다.',
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    const confirmRouter = createMemoryRouter(appRoutes, {
      initialEntries: [
        {
          pathname: '/auth/password-reset/confirm',
          search: '?token=reset-token',
        },
      ],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={confirmRouter} />
      </AuthProvider>,
    );

    await user.type(await screen.findByLabelText(/새 비밀번호/), 'new-password-123');
    await user.click(screen.getByRole('button', { name: '새 비밀번호 저장' }));

    expect(await screen.findByText('비밀번호가 재설정되었습니다.')).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      password: 'new-password-123',
      token: 'reset-token',
    });
  });
});
