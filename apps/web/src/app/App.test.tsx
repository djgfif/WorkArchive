import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderWithProviders } from '../test/render-with-providers';

describe('App', () => {
  it('renders the home entry inside the product layout', async () => {
    renderWithProviders(<App />);

    expect(screen.getByText('워크 아카이브')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '기록 홈' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품' })).toBeInTheDocument();
    expect(screen.queryByText('티어 보드')).not.toBeInTheDocument();
    expect(screen.queryByText('인사이트')).not.toBeInTheDocument();
    expect(screen.queryByText('커뮤니티')).not.toBeInTheDocument();
  });
});
