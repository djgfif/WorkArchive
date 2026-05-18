import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../context/AuthProvider';
import {
  readStoredAuthTokens,
  writeStoredAuthTokens,
} from '../services/auth-storage';
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Invalid or expired refresh token.',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: 'access-token',
          user: {
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    vi.stubGlobal('fetch', fetchMock);

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
    expect(screen.getByText('로컬 우선 저장')).toBeInTheDocument();
    expect(screen.getByText('local-first 유지')).toBeInTheDocument();
    expect(
      screen.getByText(/회원가입 후에도 작품 추가와 수정은 IndexedDB 로컬 저장 경로를 먼저 사용합니다/),
    ).toBeInTheDocument();
    expect(screen.getByText('계정 동기화와 복구에 사용할 이메일입니다.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/이메일/), 'frieren@example.com');
    await user.type(screen.getByLabelText(/비밀번호/), 'strong-password-123');
    await user.click(screen.getByRole('button', { name: '회원가입' }));

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'frieren@example.com' }));
    await user.click(await screen.findByRole('menuitem', { name: '로그아웃' }));

    await user.click(await screen.findByRole('button', { name: '계정' }));
    expect(await screen.findByRole('menuitem', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '회원가입' })).toBeInTheDocument();
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
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired refresh token.',
            },
            401,
          ),
        )
        .mockResolvedValueOnce(
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

  it('lets users retry when guest transfer review cannot be loaded', async () => {
    vi.spyOn(guestTransferService, 'getPendingReview')
      .mockRejectedValueOnce(new Error('IndexedDB blocked'))
      .mockResolvedValueOnce(null);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          accessToken: 'refreshed-access-token',
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
      initialEntries: ['/account/transfer'],
    });

    renderWithProviders(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(
      await screen.findByText(
        '게스트 기록 검토 상태를 불러오지 못했습니다. 네트워크나 IndexedDB 상태를 확인한 뒤 다시 시도해주세요.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 확인' }));

    expect(
      await screen.findByText('지금 검토할 guest 기록이 없습니다'),
    ).toBeInTheDocument();
  });

  it('restores a session by calling /auth/refresh on startup', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'legacy-access-token',
      }),
    );

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        accessToken: 'refreshed-access-token',
        user: {
          id: 'user-1',
          email: 'frieren@example.com',
          nickname: '',
        },
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
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
  });

  it('falls back to guest mode when startup refresh fails', async () => {
    const user = userEvent.setup();

    writeStoredAuthTokens({
      accessToken: 'stale-memory-token',
    });
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'legacy-access-token',
      }),
    );

    const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse(
          {
          message: 'Invalid or expired refresh token.',
          },
          401,
        ),
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

    await user.click(await screen.findByRole('button', { name: '계정' }));
    expect(await screen.findByRole('menuitem', { name: '로그인' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(readStoredAuthTokens()).toBeNull();
  });

  it('does not let a late startup refresh failure replace a completed login session', async () => {
    let resolveRefresh!: (response: Response) => void;
    const refreshPromise = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/auth/refresh')) {
        return refreshPromise;
      }

      if (url.includes('/auth/login')) {
        return Promise.resolve(
          jsonResponse({
            accessToken: 'login-access-token',
            user: {
              id: 'user-1',
              email: 'frieren@example.com',
              nickname: '',
            },
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

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

    await user.type(screen.getByLabelText(/이메일/), 'frieren@example.com');
    await user.type(screen.getByLabelText(/비밀번호/), 'strong-password-123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(readStoredAuthTokens()).toEqual({
      accessToken: 'login-access-token',
    });

    resolveRefresh(
      jsonResponse(
        {
          message: 'Invalid or expired refresh token.',
        },
        401,
      ),
    );

    await waitFor(() => {
      expect(readStoredAuthTokens()).toEqual({
        accessToken: 'login-access-token',
      });
    });
    expect(screen.getByText('frieren@example.com')).toBeInTheDocument();
  });

  it('keeps login access tokens out of browser storage when remember-me is checked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Invalid or expired refresh token.',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
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
    expect(screen.getByText('게스트 기록 보호')).toBeInTheDocument();
    expect(screen.getByText(/로그인 전 기록은 사라지지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText('공개 피드 없음')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/이메일/), 'frieren@example.com');
    await user.type(screen.getByLabelText(/비밀번호/), 'strong-password-123');
    await user.click(screen.getByLabelText('로그인 상태 유지'));
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(window.localStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(window.sessionStorage.getItem('work-archive.auth.tokens')).toBeNull();
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      rememberMe: true,
    });
  });

  it('keeps login access tokens out of browser storage when remember-me is not checked', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired refresh token.',
            },
            401,
          ),
        )
        .mockResolvedValueOnce(
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
    expect(window.sessionStorage.getItem('work-archive.auth.tokens')).toBeNull();
  });

  it('shows a contextual credential error on failed login', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid or expired refresh token.',
            },
            401,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              message: 'Invalid email or password.',
            },
            401,
          ),
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

    await user.type(screen.getByLabelText(/이메일/), 'wrong@example.com');
    await user.type(screen.getByLabelText(/비밀번호/), 'wrong-password');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(
      await screen.findByText(
        '이메일 또는 비밀번호가 맞지 않습니다. 입력한 정보를 다시 확인해주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('requests a development password reset link', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Invalid or expired refresh token.',
          },
          401,
        ),
      )
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
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      email: 'frieren@example.com',
    });
  });

  it('confirms a development password reset token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Invalid or expired refresh token.',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
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
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      password: 'new-password-123',
      token: 'reset-token',
    });
  });
});
