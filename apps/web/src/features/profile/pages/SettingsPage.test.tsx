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

describe('SettingsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
        jsonResponse({
          provider: 'aladin',
          configured: false,
        }),
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
      await screen.findByText('키가 등록되어 있지 않습니다'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Aladin TTBKey'), 'ttb-test-key');
    await user.click(screen.getByRole('button', { name: 'Aladin 키 저장' }));

    expect(await screen.findByText('Aladin TTBKey를 저장했습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('Aladin TTBKey')).toHaveValue('');

    const saveRequest = fetchMock.mock.calls[1];
    const saveRequestInit = saveRequest?.[1] as RequestInit;
    const saveRequestHeaders = saveRequestInit.headers as Headers;

    expect(saveRequest?.[0]).toEqual(
      expect.stringContaining('/imports/providers/aladin/key'),
    );
    expect(saveRequestInit.method).toBe('PUT');
    expect(saveRequestInit.body).toBe(JSON.stringify({ ttbKey: 'ttb-test-key' }));
    expect(saveRequestHeaders.get('authorization')).toBe('Bearer access-token');

    await user.click(screen.getByRole('button', { name: 'Aladin 키 삭제' }));

    expect(await screen.findByText('Aladin TTBKey를 삭제했습니다.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2]?.[0]).toEqual(
      expect.stringContaining('/imports/providers/aladin/key'),
    );
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe('DELETE');
  });
});
