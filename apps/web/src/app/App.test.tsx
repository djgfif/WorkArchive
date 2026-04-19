import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the project heading and home entry', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '워크 아카이브' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: '오늘 기록할 작품을 바로 찾아보세요' }),
    ).toBeInTheDocument();
  });
});
