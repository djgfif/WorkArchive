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
          signIn: vi.fn(),
          signUp: vi.fn(),
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
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
        }}
      >
        <SettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
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

    renderAuthenticatedSettings();

    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(screen.getAllByText('Aladin Book').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TMDB').length).toBeGreaterThan(0);
    expect(screen.getByText(/사용 가능/)).toBeInTheDocument();
    expect(screen.getAllByText(/키 필요/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/공개 provider/)).toBeInTheDocument();
    expect(screen.getAllByText(/개인 Key Vault/).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/imports/providers'),
        expect.stringContaining('/auth/sessions'),
      ]),
    );
    expect(await screen.findByText('Login sessions')).toBeInTheDocument();
    expect(screen.getByText('Current session')).toBeInTheDocument();
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

      expect(await screen.findByText('API Key Vault')).toBeInTheDocument();
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

      expect(await screen.findByText(/API Key를 저장했습니다/)).toBeInTheDocument();
      for (const field of fields) {
        expect(screen.getByLabelText(field.label)).toHaveValue('');
      }
      expect(screen.getAllByText(/등록됨/).length).toBeGreaterThan(0);

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

      expect(await screen.findByText(/API Key를 삭제했습니다/)).toBeInTheDocument();
      expect(screen.getAllByText(/키 필요/).length).toBeGreaterThan(0);
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

    expect(await screen.findByText('Current session')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Sign out this device',
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

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings(signOut);

    expect(await screen.findByText('Current session')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Sign out all devices',
      }),
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

  it('shows login guidance instead of provider readiness for guests', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    renderGuestSettings();

    expect(await screen.findByText(/로그인하면/)).toBeInTheDocument();
    expect(screen.getByText('로컬 백업과 복구')).toBeInTheDocument();
    expect(screen.getByText(/syncQueue.*복원하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/access token.*refresh cookie.*provider API key/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'JSON 백업 내보내기' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'CSV 내보내기' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('JSON 백업 파일 선택')).toBeInTheDocument();
    expect(screen.getByText(/공개 provider는 키 없이/)).toBeInTheDocument();
    expect(screen.queryByLabelText('TTBKey')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
