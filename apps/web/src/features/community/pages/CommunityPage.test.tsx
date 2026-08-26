import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@features/auth';
import { ApiRequestError } from '@shared/services/api-client';
import { renderWithProviders } from '@test/render-with-providers';
import { fetchCommunityFeed } from '../services/community.api';
import type * as CommunityApiModule from '../services/community.api';
import { CommunityPage } from './CommunityPage';

vi.mock('../services/community.api', async (importOriginal) => ({
  ...(await importOriginal<typeof CommunityApiModule>()),
  fetchCommunityFeed: vi.fn(async () => ({ items: [], nextCursor: null })),
  fetchTrendingCommunityWorks: vi.fn(async () => []),
  setCommunityTargetReaction: vi.fn(),
  upsertCommunityReview: vi.fn(),
}));

const guestSession: AuthContextValue = {
  archiveScopeKey: 'guest',
  isLoading: false,
  mode: 'guest',
  sessionStatus: 'guest',
  signOut: async () => undefined,
  user: null,
};

const fetchCommunityFeedMock = vi.mocked(fetchCommunityFeed);

describe('CommunityPage', () => {
  beforeEach(() => {
    fetchCommunityFeedMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it('uses native same-page anchors for review discovery', async () => {
    renderWithProviders(
      <AuthContext.Provider value={guestSession}>
        <MemoryRouter initialEntries={['/community']}>
          <CommunityPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText('아직 공개된 감상이 없습니다')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: /리뷰 발견/ })) {
      expect(link).toHaveAttribute('href', '#community-feed');
    }
  });

  it('keeps the local archive available when the community cannot load', async () => {
    fetchCommunityFeedMock.mockRejectedValueOnce(new Error('서버에 연결할 수 없습니다.'));

    renderWithProviders(
      <AuthContext.Provider value={guestSession}>
        <MemoryRouter initialEntries={['/community']}>
          <CommunityPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText('커뮤니티에 연결하지 못했습니다')).toBeInTheDocument();
    expect(screen.getByText('서버에 연결할 수 없습니다. 내 서재와 개인 기록은 그대로 사용할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 서재로' })).toHaveAttribute('href', '/works');
  });

  it('explains a revoked release profile without offering a futile retry', async () => {
    fetchCommunityFeedMock.mockRejectedValueOnce(
      new ApiRequestError(404, '요청한 리소스를 찾을 수 없습니다.'),
    );

    renderWithProviders(
      <AuthContext.Provider value={guestSession}>
        <MemoryRouter initialEntries={['/community']}>
          <CommunityPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(
      await screen.findByText('커뮤니티가 현재 비활성화되었습니다'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 서재로' })).toHaveAttribute('href', '/works');
  });
});
