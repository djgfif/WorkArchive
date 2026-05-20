import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthContext } from '../../auth/context/AuthContext';
import {
  clearStoredAuthTokens,
  writeStoredAuthTokens,
} from '../../auth/services/auth-storage';
import { SettingsPage } from './SettingsPage';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function noContentResponse() {
  return new Response(null, {
    status: 204,
  });
}

function authSessionsResponse() {
  return {
    sessions: [
      {
        id: 'session-1',
        current: true,
        rememberMe: true,
        userAgent: 'Vitest Browser',
        ipAddress: '127.0.0.1',
        createdAt: '2026-05-12T00:00:00.000Z',
        lastUsedAt: '2026-05-12T00:00:00.000Z',
        rotatedAt: null,
        expiresAt: '2026-06-11T00:00:00.000Z',
      },
    ],
  };
}

function renderAuthenticatedSettings(signOut = vi.fn()) {
  const view = renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          archiveScopeKey: 'user:user-1',
          isLoading: false,
          mode: 'authenticated',
          user: {
            id: 'user-1',
            email: 'frieren@example.com',
            nickname: '',
          },
          signOut,
        }}
      >
        <SettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  return {
    ...view,
    signOut,
  };
}

function renderGuestSettings() {
  return renderWithProviders(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          archiveScopeKey: 'guest',
          isLoading: false,
          mode: 'guest',
          user: null,
          signOut: vi.fn(),
        }}
      >
        <SettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function openSettingsSection(
  user: ReturnType<typeof userEvent.setup>,
  sectionId: string,
) {
  const sectionTab = document.querySelector(
    `[data-section-id="${sectionId}"]`,
  );

  if (!(sectionTab instanceof HTMLElement)) {
    throw new Error(`Settings section tab not found: ${sectionId}`);
  }

  await user.click(sectionTab);
}

describe('SettingsPage', () => {
  afterEach(() => {
    clearStoredAuthTokens();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders provider readiness cards for public and user-key credential modes', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const providerStatuses = [
        {
          provider: 'manual',
          label: 'Manual',
          credentialMode: 'none',
          configured: true,
          mediumTypes: ['novel', 'anime'],
        },
        {
          provider: 'aladin',
          label: 'Aladin Book',
          credentialMode: 'user',
          configured: false,
          credentialFields: [{ name: 'ttbKey', label: 'TTBKey', secret: true }],
          mediumTypes: ['novel', 'light_novel', 'manga'],
        },
        {
          provider: 'tmdb',
          label: 'TMDB',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'readToken', label: 'Read Access Token', secret: true },
          ],
          mediumTypes: ['movie', 'drama'],
        },
      ];
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/auth/sessions')) {
        return Promise.resolve(jsonResponse(authSessionsResponse()));
      }

      return Promise.resolve(jsonResponse(providerStatuses));
    });

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings();
    await openSettingsSection(user, 'search-providers');

    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(screen.getAllByText('Aladin Book').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TMDB').length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/imports/providers'),
        expect.stringContaining('/auth/sessions'),
      ]),
    );
    await openSettingsSection(user, 'security');
    expect(
      await screen.findByRole('button', { name: '이 기기 로그아웃' }),
    ).toBeInTheDocument();
  });

  it.each([
    {
      provider: 'aladin',
      label: 'Aladin Book',
      fields: [{ name: 'ttbKey', label: 'TTBKey', value: 'ttb-test-key' }],
    },
    {
      provider: 'tmdb',
      label: 'TMDB',
      fields: [
        {
          name: 'readToken',
          label: 'Read Access Token',
          value: 'tmdb-read-token',
        },
      ],
    },
    {
      provider: 'naver_book',
      label: 'Naver Book',
      fields: [
        { name: 'clientId', label: 'Client ID', value: 'naver-client-id' },
        {
          name: 'clientSecret',
          label: 'Client Secret',
          value: 'naver-client-secret',
        },
      ],
    },
    {
      provider: 'kakao_book',
      label: 'Kakao Book',
      fields: [
        { name: 'restApiKey', label: 'REST API Key', value: 'kakao-rest-key' },
      ],
    },
    {
      provider: 'kobis',
      label: 'KOBIS',
      fields: [{ name: 'apiKey', label: 'API Key', value: 'kobis-api-key' }],
    },
  ])(
    'saves and deletes the authenticated user $label key without showing it again',
    async ({ fields, label, provider }) => {
      writeStoredAuthTokens({
        accessToken: 'access-token',
      });
      const providerStatuses = [
        {
          provider: 'manual',
          label: 'Manual',
          credentialMode: 'none',
          configured: true,
          mediumTypes: ['novel', 'anime'],
        },
        {
          provider: 'aladin',
          label: 'Aladin Book',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'ttbKey', label: 'TTBKey', secret: true },
          ],
          mediumTypes: ['novel', 'light_novel', 'manga'],
        },
        {
          provider: 'tmdb',
          label: 'TMDB',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'readToken', label: 'Read Access Token', secret: true },
          ],
          mediumTypes: ['movie', 'drama'],
        },
        {
          provider: 'naver_book',
          label: 'Naver Book',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'clientId', label: 'Client ID', secret: true },
            { name: 'clientSecret', label: 'Client Secret', secret: true },
          ],
          mediumTypes: ['novel', 'light_novel', 'manga'],
        },
        {
          provider: 'kakao_book',
          label: 'Kakao Book',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'restApiKey', label: 'REST API Key', secret: true },
          ],
          mediumTypes: ['novel', 'light_novel', 'manga'],
        },
        {
          provider: 'kobis',
          label: 'KOBIS',
          credentialMode: 'user',
          configured: false,
          credentialFields: [
            { name: 'apiKey', label: 'API Key', secret: true },
          ],
          mediumTypes: ['movie'],
        },
      ];
      const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/auth/sessions')) {
          return Promise.resolve(jsonResponse(authSessionsResponse()));
        }

        if (requestUrl.includes(`/imports/providers/${provider}/key`)) {
          if (init?.method === 'PUT') {
            return Promise.resolve(
              jsonResponse({
                provider,
                configured: true,
              }),
            );
          }

          if (init?.method === 'DELETE') {
            return Promise.resolve(noContentResponse());
          }
        }

        return Promise.resolve(jsonResponse(providerStatuses));
      });

      vi.stubGlobal('fetch', fetchMock);

      const user = userEvent.setup();

      renderAuthenticatedSettings();
      await openSettingsSection(user, 'search-providers');

      expect(await screen.findByText('Search provider 관리')).toBeInTheDocument();
      if (provider !== 'aladin') {
        await user.click(
          await screen.findByRole('button', {
            name: new RegExp(label),
          }),
        );
      }

      for (const field of fields) {
        await user.type(await screen.findByLabelText(field.label), field.value);
      }
      await user.click(screen.getByRole('button', { name: /키 저장/ }));

      expect(await screen.findByText(/API key를 저장했습니다/)).toBeInTheDocument();
      for (const field of fields) {
        expect(screen.getByLabelText(field.label)).toHaveValue('');
      }
      const providerRequest = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/imports/providers'),
      );
      const saveRequest = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/imports/providers/${provider}/key`) &&
          (init as RequestInit | undefined)?.method === 'PUT',
      );
      const saveRequestInit = saveRequest?.[1] as RequestInit;
      const saveRequestHeaders = saveRequestInit.headers as Headers;
      const expectedValues = Object.fromEntries(
        fields.map((field) => [field.name, field.value]),
      );

      expect(providerRequest?.[0]).toEqual(
        expect.stringContaining('/imports/providers'),
      );
      expect(saveRequest?.[0]).toEqual(
        expect.stringContaining(`/imports/providers/${provider}/key`),
      );
      expect(saveRequestInit.method).toBe('PUT');
      expect(saveRequestInit.body).toBe(
        JSON.stringify({ values: expectedValues }),
      );
      expect(saveRequestHeaders.get('authorization')).toBe(
        'Bearer access-token',
      );

      await user.click(screen.getByRole('button', { name: /키 삭제/ }));

      expect(await screen.findByText(/API key를 삭제했습니다/)).toBeInTheDocument();
      const deleteRequest = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/imports/providers/${provider}/key`) &&
          (init as RequestInit | undefined)?.method === 'DELETE',
      );
      expect(deleteRequest?.[0]).toEqual(
        expect.stringContaining(`/imports/providers/${provider}/key`),
      );
      expect((deleteRequest?.[1] as RequestInit).method).toBe('DELETE');
    },
  );

  it('revokes the current session and signs out locally', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchMock = vi.fn((url: string | URL | Request, _init?: RequestInit) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/auth/sessions/session-1')) {
        return Promise.resolve(noContentResponse());
      }

      if (requestUrl.includes('/auth/sessions')) {
        return Promise.resolve(jsonResponse(authSessionsResponse()));
      }

      return Promise.resolve(jsonResponse([]));
    });
    const signOut = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings(signOut);
    await openSettingsSection(user, 'security');

    expect(
      await screen.findByRole('button', { name: '이 기기 로그아웃' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: '이 기기 로그아웃',
      }),
    );

    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringContaining('/auth/sessions/session-1'),
          expect.objectContaining({
            method: 'DELETE',
          }),
        ]),
      ]),
    );
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('revokes every session and signs out locally', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/auth/sessions/revoke-all')) {
        return Promise.resolve(noContentResponse());
      }

      if (requestUrl.includes('/auth/sessions')) {
        return Promise.resolve(jsonResponse(authSessionsResponse()));
      }

      return Promise.resolve(jsonResponse([]));
    });
    const signOut = vi.fn().mockResolvedValue(undefined);
    const confirmMock = vi.fn(() => true);

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', confirmMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings(signOut);
    await openSettingsSection(user, 'danger-zone');

    expect(
      await screen.findByRole('button', { name: '모든 기기 로그아웃' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: '모든 기기 로그아웃',
      }),
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledWith(
      [
        '모든 기기에서 로그아웃할까요?',
        '현재 기기를 포함한 모든 로그인 세션이 해제되고, 이 브라우저는 게스트 모드로 전환됩니다.',
      ].join('\n'),
    );
    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringContaining('/auth/sessions/revoke-all'),
          expect.objectContaining({
            method: 'POST',
          }),
        ]),
      ]),
    );
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('keeps every session when revoke all confirmation is cancelled', async () => {
    writeStoredAuthTokens({
      accessToken: 'access-token',
    });
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/auth/sessions/revoke-all')) {
        return Promise.resolve(noContentResponse());
      }

      if (requestUrl.includes('/auth/sessions')) {
        return Promise.resolve(jsonResponse(authSessionsResponse()));
      }

      return Promise.resolve(jsonResponse([]));
    });
    const signOut = vi.fn().mockResolvedValue(undefined);
    const confirmMock = vi.fn(() => false);

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', confirmMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings(signOut);
    await openSettingsSection(user, 'danger-zone');

    await user.click(
      await screen.findByRole('button', {
        name: '모든 기기 로그아웃',
      }),
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/auth/sessions/revoke-all'),
      ),
    ).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('shows login guidance instead of provider readiness for guests', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderGuestSettings();
    await openSettingsSection(user, 'data-backup');

    expect(
      screen.getByRole('button', { name: 'JSON 백업 내보내기' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'CSV 내보내기' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('JSON 백업 파일 선택')).toBeInTheDocument();
    expect(screen.queryByLabelText('TTBKey')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
