import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { worksRepository } from '@features/works';
import { renderWithProviders } from '@test/render-with-providers';
import { findLinkByHref, getLinkByHref } from '@test/ui-helpers';

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete window.__WORK_ARCHIVE_CONFIG__;
    window.history.pushState({}, '', '/');
  });

  it('renders the home entry inside the product layout', async () => {
    renderWithProviders(<App />);

    expect(await findLinkByHref('/')).toBeInTheDocument();
    expect(getLinkByHref('/works')).toBeInTheDocument();
    expect(getLinkByHref('/works/new')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: /Tier|Board|Community|Insight|Sync/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('offers recovery actions when the home recent records cannot load', async () => {
    const user = userEvent.setup();
    const listActiveSpy = vi
      .spyOn(worksRepository, 'listActive')
      .mockRejectedValueOnce(new Error('IndexedDB 연결 실패'));

    renderWithProviders(<App />);

    expect(await screen.findByText('IndexedDB 연결 실패')).toBeInTheDocument();
    expect(getLinkByHref('/works')).toBeInTheDocument();
    expect(getLinkByHref('/works/new')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));

    await waitFor(() => {
      expect(listActiveSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText('IndexedDB 연결 실패')).not.toBeInTheDocument();
  });

  it('exposes the primary mobile destinations without a drawer', async () => {
    renderWithProviders(<App />);

    const mobileNavigation = await screen.findByRole('navigation', {
      name: '모바일 탐색',
    });
    expect(
      within(mobileNavigation).getByRole('link', { name: '홈' }),
    ).toHaveAttribute('href', '/');
    expect(
      within(mobileNavigation).getByRole('link', { name: /새 작품 추가/ }),
    ).toHaveAttribute('href', '/works/new');
    expect(
      within(mobileNavigation).getByRole('link', { name: '작품 서재' }),
    ).toHaveAttribute('href', '/works');
    expect(
      screen.queryByRole('button', { name: '메뉴 열기' }),
    ).not.toBeInTheDocument();
  });

  it('starts the Sites POC in local guest mode without server entry points', async () => {
    window.__WORK_ARCHIVE_CONFIG__ = {
      deploymentProfile: 'sites-guest-poc',
    };
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderWithProviders(<App />);
    expect(
      await screen.findByText('아직 기록한 작품이 없습니다'),
    ).toBeInTheDocument();
    expect(screen.queryByText('검색으로 추가')).not.toBeInTheDocument();

    await user.click(getLinkByHref('/works/new'));

    expect(
      await screen.findByRole('heading', { name: '작품 추가' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '제목·상태·별점으로 바로 저장합니다. 이 환경에서는 작품 검색 없이 직접 기록합니다.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '비공개 검증 환경 · 이 브라우저에만 저장됩니다. 로그인, 동기화, 외부 검색은 제공되지 않습니다.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('검색으로 정보 보강(선택)'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '로그인' }),
    ).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
