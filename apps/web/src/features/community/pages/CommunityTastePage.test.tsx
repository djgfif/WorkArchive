import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthContext, type AuthContextValue } from '@features/auth';
import { renderWithProviders } from '@test/render-with-providers';
import { CommunityTastePage } from './CommunityTastePage';

function renderPage(session: AuthContextValue) {
  return renderWithProviders(
    <AuthContext.Provider value={session}>
      <MemoryRouter>
        <CommunityTastePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const baseSession: Omit<AuthContextValue, 'mode' | 'sessionStatus' | 'user'> = {
  archiveScopeKey: 'test',
  isLoading: false,
  signOut: async () => undefined,
};

describe('CommunityTastePage', () => {
  it('directs an authenticated user without a handle to account settings', async () => {
    renderPage({
      ...baseSession,
      mode: 'authenticated',
      sessionStatus: 'authenticated',
      user: {
        avatarUrl: '',
        email: 'reader@example.com',
        handle: null,
        id: 'user-1',
        nickname: '독자',
      },
    });

    expect(screen.getByText('핸들을 만들면 시작할 수 있어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '핸들 만들기' })).toHaveAttribute(
      'href',
      '/account/settings',
    );
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('취향 찾기 · Work Archive'));
  });

  it('directs a guest to login', () => {
    renderPage({
      ...baseSession,
      mode: 'guest',
      sessionStatus: 'guest',
      user: null,
    });

    expect(screen.getByText('로그인이 필요합니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
      'href',
      '/auth/login',
    );
  });
});
