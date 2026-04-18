import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appRoutes } from '../../../app/router/routes';
import { AuthProvider } from '../../auth/context/AuthProvider';

describe('Works routed flow', () => {
  it('creates and edits a work through the UI', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/works/new'],
    });

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText(/^Title$/i), 'Dune');
    await user.type(
      screen.getByLabelText(/Author \/ Creator/i),
      'Frank Herbert',
    );
    await user.type(
      screen.getByLabelText(/^Genres$/i),
      'Science Fiction, Politics',
    );

    await user.click(screen.getByRole('button', { name: /save work/i }));

    expect(await screen.findByRole('heading', { name: 'Dune' })).toBeInTheDocument();
    expect(screen.getByText(/Frank Herbert/i)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /edit work/i }));

    const titleInput = await screen.findByLabelText(/^Title$/i);

    await user.clear(titleInput);
    await user.type(titleInput, 'Dune Messiah');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByRole('heading', { name: 'Dune Messiah' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /back to library/i }));

    expect(
      await screen.findByRole('heading', { name: /your library/i }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Dune Messiah' })).toBeInTheDocument();
  });
});
