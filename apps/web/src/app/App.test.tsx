import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { renderWithProviders } from '../test/render-with-providers';
import { findLinkByHref, getLinkByHref } from '../test/ui-helpers';
import { worksRepository } from '../features/works';

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the home entry inside the product layout', async () => {
    renderWithProviders(<App />);

    expect(await findLinkByHref('/')).toBeInTheDocument();
    expect(getLinkByHref('/works')).toBeInTheDocument();
    expect(getLinkByHref('/works/new')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Tier|Board|Community|Insight|Sync/i })).not.toBeInTheDocument();
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
});
