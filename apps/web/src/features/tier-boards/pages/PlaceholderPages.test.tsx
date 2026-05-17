import { MemoryRouter } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render-with-providers';
import { CommunityPage } from '../../community/pages/CommunityPage';
import { TierBoardsPage } from './TierBoardsPage';

describe('placeholder product pages', () => {
  it('keeps tier boards clearly marked as not yet implemented with alternative actions', () => {
    renderWithProviders(
      <MemoryRouter>
        <TierBoardsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '티어 보드' })).toBeInTheDocument();
    expect(screen.getAllByText('준비 중').length).toBeGreaterThan(0);
    expect(screen.getByText('지금은 작품 기록을 먼저 정리할 수 있습니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품 목록 보기' })).toHaveAttribute('href', '/works');
    expect(screen.getByRole('link', { name: '작품 추가' })).toHaveAttribute('href', '/works/new');
  });

  it('states that community is outside the current product scope', () => {
    renderWithProviders(
      <MemoryRouter>
        <CommunityPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: '커뮤니티 기능은 현재 만들지 않습니다' }),
    ).toBeInTheDocument();
    expect(screen.getByText('대체 흐름')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품 기록 관리' })).toHaveAttribute('href', '/works');
    expect(screen.getByRole('link', { name: '내 취향 보기' })).toHaveAttribute('href', '/insights');
  });
});
