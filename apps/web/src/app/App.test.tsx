import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the project heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '워크 아카이브' })).toBeInTheDocument();
  });
});
