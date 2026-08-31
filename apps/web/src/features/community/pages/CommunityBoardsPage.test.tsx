import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@features/auth';
import { renderWithProviders } from '@test/render-with-providers';
import { fetchCommunityBoardPosts } from '../services/community.api';
import { CommunityBoardsPage } from './CommunityBoardsPage';

vi.mock('../services/community.api', () => ({
  fetchCommunityBoardPosts: vi.fn(async () => ({ posts: [] })),
  publishCommunityPost: vi.fn(),
}));

const guestSession: AuthContextValue = {
  archiveScopeKey: 'guest',
  isLoading: false,
  mode: 'guest',
  sessionStatus: 'guest',
  signOut: async () => undefined,
  user: null,
};

const fetchCommunityBoardPostsMock = vi.mocked(fetchCommunityBoardPosts);

describe('CommunityBoardsPage', () => {
  beforeEach(() => {
    fetchCommunityBoardPostsMock.mockResolvedValue({ nextCursor: null, posts: [] });
  });

  it('routes a guest participant to the real login page', async () => {
    renderWithProviders(
      <AuthContext.Provider value={guestSession}>
        <MemoryRouter>
          <CommunityBoardsPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText('첫 이야기를 기다리고 있어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
      'href',
      '/auth/login',
    );
  });

  it('shows a retryable error instead of an empty board when loading fails', async () => {
    const user = userEvent.setup();
    fetchCommunityBoardPostsMock.mockRejectedValueOnce(new Error('서버에 연결할 수 없습니다.'));

    renderWithProviders(
      <AuthContext.Provider value={guestSession}>
        <MemoryRouter>
          <CommunityBoardsPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText('게시판에 연결하지 못했습니다')).toBeInTheDocument();
    expect(screen.getByText('서버에 연결할 수 없습니다. 내 서재와 개인 기록은 그대로 사용할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 서재로' })).toHaveAttribute('href', '/works');
    expect(screen.queryByText('첫 이야기를 기다리고 있어요')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('첫 이야기를 기다리고 있어요')).toBeInTheDocument();
  });
});
