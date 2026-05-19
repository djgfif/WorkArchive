import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { renderWithProviders } from '../test/render-with-providers';
import { worksRepository } from '../features/works/services/works.repository';

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the home entry inside the product layout', async () => {
    renderWithProviders(<App />);

    expect(screen.getByText('Work Archive')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '내 아카이브' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '작품 추가' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Tier|Board|Community|Insight|Sync/i })).not.toBeInTheDocument();
  });

  it('offers recovery actions when the home recent records cannot load', async () => {
    const user = userEvent.setup();
    const listActiveSpy = vi
      .spyOn(worksRepository, 'listActive')
      .mockRejectedValueOnce(new Error('IndexedDB 연결 실패'));

    renderWithProviders(<App />);

    expect(
      await screen.findByRole('heading', {
        name: '최근 기록을 불러오지 못했습니다.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('IndexedDB 연결 실패')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품 목록 열기' })).toHaveAttribute(
      'href',
      '/works',
    );
    expect(
      screen.getAllByRole('link', { name: '작품 추가' })[0],
    ).toHaveAttribute('href', '/works/new');

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(
      await screen.findByRole('heading', { name: '아직 기록이 없습니다' }),
    ).toBeInTheDocument();
    expect(listActiveSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
