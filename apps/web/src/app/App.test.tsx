import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderWithProviders } from '../test/render-with-providers';

describe('App', () => {
  it('renders the home entry inside the product layout', async () => {
    renderWithProviders(<App />);

    expect(screen.getByText('Work Archive')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '기록 홈' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '인사이트' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '티어 보드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '계정' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '동기화' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '설정' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '작품 추가' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('커뮤니티')).not.toBeInTheDocument();
  });
});
