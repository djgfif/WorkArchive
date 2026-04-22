import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import {
  appColorSchemeManager,
  appCssVariablesResolver,
  appTheme,
} from '../../app/mantine-theme';
import {
  AppNavLink,
  SectionCard,
  ThemeToggleControl,
} from './AppPrimitives';

function renderWithTheme(colorScheme: 'dark' | 'light') {
  return (
    <MantineProvider
      colorSchemeManager={appColorSchemeManager}
      cssVariablesResolver={appCssVariablesResolver}
      defaultColorScheme={colorScheme}
      theme={appTheme}
    >
      <MemoryRouter>
        <SectionCard tone="hero">
          <ThemeToggleControl />
          <AppNavLink to="/works">작품</AppNavLink>
        </SectionCard>
      </MemoryRouter>
    </MantineProvider>
  );
}

describe('AppPrimitives', () => {
  it('renders shared primitives cleanly in dark mode', () => {
    window.localStorage.setItem('work-archive.ui.color-scheme', 'dark');

    const { container } = render(renderWithTheme('dark'));

    expect(screen.getByRole('button', { name: '라이트 모드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품' })).toBeInTheDocument();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders shared primitives cleanly in light mode', () => {
    window.localStorage.setItem('work-archive.ui.color-scheme', 'light');

    const { container } = render(renderWithTheme('light'));

    expect(screen.getByRole('button', { name: '다크 모드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '작품' })).toBeInTheDocument();
    expect(container.firstChild).toBeInTheDocument();
  });
});
