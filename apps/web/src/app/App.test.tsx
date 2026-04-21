import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderWithProviders } from '../test/render-with-providers';

describe('App', () => {
  it('renders the home entry inside the product layout', async () => {
    renderWithProviders(<App />);

    expect(screen.getByText('워크 아카이브')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: '오늘 기록할 작품을 바로 시작해보세요' }),
    ).toBeInTheDocument();
  });
});
