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

function renderAuthenticatedSettings() {
  return renderWithProviders(
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
          signOut: vi.fn(),
        }}
      >
        <SettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
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
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
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
      ]),
    );

    vi.stubGlobal('fetch', fetchMock);

    renderAuthenticatedSettings();

    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(screen.getAllByText('Aladin Book').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TMDB').length).toBeGreaterThan(0);
    expect(screen.getByText(/사용 가능/)).toBeInTheDocument();
    expect(screen.getAllByText(/키 필요/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/공개 provider/)).toBeInTheDocument();
    expect(screen.getAllByText(/개인 Key Vault/).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/imports/providers'),
    );
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
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(providerStatuses))
        .mockResolvedValueOnce(
          jsonResponse({
            provider,
            configured: true,
          }),
        )
        .mockResolvedValueOnce(noContentResponse());

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

      const providerRequest = fetchMock.mock.calls[0];
      const saveRequest = fetchMock.mock.calls[1];
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
      expect(fetchMock.mock.calls[2]?.[0]).toEqual(
        expect.stringContaining(`/imports/providers/${provider}/key`),
      );
      expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe(
        'DELETE',
      );
    },
  );

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
