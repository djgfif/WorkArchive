import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import {
  CommandPalette,
  COMMAND_PALETTE_EVENT,
} from './CommandPalette';

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="현재 경로">{location.pathname}{location.search}</output>;
}

describe('CommandPalette', () => {
  it('prioritizes a matching command over the generic work search', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={['/works/new']}>
        <CommandPalette />
        <CurrentLocation />
      </MemoryRouter>,
    );

    window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
    const input = await screen.findByRole('combobox', { name: '명령 검색' });
    await user.type(input, '설정{Enter}');

    expect(screen.getByRole('status', { name: '현재 경로' }))
      .toHaveTextContent('/account/settings');
  });

  it('exposes the active command through combobox semantics', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );

    window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
    const input = await screen.findByRole('combobox', { name: '명령 검색' });
    await user.type(input, '설정');

    const activeOption = screen.getByRole('option', {
      name: '설정과 백업',
    });
    expect(input).toHaveAttribute('aria-activedescendant', activeOption.id);
    expect(activeOption).toHaveAttribute('aria-selected', 'true');
  });
});
