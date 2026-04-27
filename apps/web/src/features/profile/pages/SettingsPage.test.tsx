import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthContext } from '../../auth/context/AuthContext';
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders provider readiness cards for none, user, and server credential modes', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );
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
          mediumTypes: ['novel', 'light_novel', 'manga'],
        },
        {
          provider: 'tmdb',
          label: 'TMDB',
          credentialMode: 'server',
          configured: false,
          mediumTypes: ['movie', 'drama'],
        },
      ]),
    );

    vi.stubGlobal('fetch', fetchMock);

    renderAuthenticatedSettings();

    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Aladin Book')).toBeInTheDocument();
    expect(screen.getByText('TMDB')).toBeInTheDocument();
    expect(screen.getByText(/바로 사용 가능/)).toBeInTheDocument();
    expect(screen.getAllByText(/설정 필요/)).toHaveLength(2);
    expect(screen.getByText(/추가 키 없음/)).toBeInTheDocument();
    expect(screen.getByText(/사용자 키/)).toBeInTheDocument();
    expect(screen.getByText(/서버 자격 증명/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/imports/providers'),
    );
  });

  it('saves and deletes the authenticated user Aladin key without showing it again', async () => {
    window.localStorage.setItem(
      'work-archive.auth.tokens',
      JSON.stringify({
        accessToken: 'access-token',
      }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
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
            mediumTypes: ['novel', 'light_novel', 'manga'],
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          provider: 'aladin',
          configured: true,
        }),
      )
      .mockResolvedValueOnce(noContentResponse());

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();

    renderAuthenticatedSettings();

    expect(
      await screen.findByText(/키가 등록되어 있지 않습니다/),
    ).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Aladin Book')).toBeInTheDocument();
    expect(screen.getByText(/바로 사용 가능/)).toBeInTheDocument();
    expect(screen.getByText(/사용자 키/)).toBeInTheDocument();
    expect(screen.getByText(/설정 필요/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Aladin TTBKey'), 'ttb-test-key');
    await user.click(screen.getByRole('button', { name: /Aladin.*저장/ }));

    expect(await screen.findByText(/Aladin TTBKey.*저장/)).toBeInTheDocument();
    expect(screen.getByLabelText('Aladin TTBKey')).toHaveValue('');
    expect(screen.getByText(/준비됨/)).toBeInTheDocument();

    const providerRequest = fetchMock.mock.calls[0];
    const saveRequest = fetchMock.mock.calls[1];
    const saveRequestInit = saveRequest?.[1] as RequestInit;
    const saveRequestHeaders = saveRequestInit.headers as Headers;

    expect(providerRequest?.[0]).toEqual(
      expect.stringContaining('/imports/providers'),
    );
    expect(saveRequest?.[0]).toEqual(
      expect.stringContaining('/imports/providers/aladin/key'),
    );
    expect(saveRequestInit.method).toBe('PUT');
    expect(saveRequestInit.body).toBe(
      JSON.stringify({ ttbKey: 'ttb-test-key' }),
    );
    expect(saveRequestHeaders.get('authorization')).toBe('Bearer access-token');

    await user.click(screen.getByRole('button', { name: /Aladin.*삭제/ }));

    expect(await screen.findByText(/Aladin TTBKey.*삭제/)).toBeInTheDocument();
    expect(screen.getByText(/설정 필요/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[2]?.[0]).toEqual(
      expect.stringContaining('/imports/providers/aladin/key'),
    );
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe('DELETE');
  });

  it('shows login guidance instead of provider readiness for guests', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    renderGuestSettings();

    expect(await screen.findByText(/로그인하면/)).toBeInTheDocument();
    expect(screen.getByText('로컬 백업과 복구')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'JSON 백업 내보내기' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'CSV 내보내기' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('JSON 백업 파일 선택')).toBeInTheDocument();
    expect(screen.getAllByText(/TTBKey/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Aladin TTBKey')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
