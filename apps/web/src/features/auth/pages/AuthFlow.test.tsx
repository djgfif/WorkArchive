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

    await user.type(screen.getByLabelText(/^이메일$/), 'frieren@example.com');
    await user.type(
      screen.getByLabelText(/^비밀번호$/),
      'strong-password-123',
    );
    await user.click(screen.getByRole('button', { name: '회원가입' }));

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(await screen.findByText('로그인됨')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByText('게스트 모드')).toBeInTheDocument();
    expect(
      screen.getByText('로그인하지 않아도 이 기기에 기록을 저장할 수 있습니다.'),
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

  it('refreshes an expired stored session before entering authenticated mode', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
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
          refreshToken: 'rotated-refresh-token',
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

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(await screen.findByText('frieren@example.com')).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem('work-archive.auth.tokens') ?? 'null'),
    ).toEqual({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
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
});
