import { screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/render-with-providers';
import {
  AuthContext,
  type AuthContextValue,
} from '../../features/auth/context/AuthContext';
import { AccountLayout } from './AccountLayout';

const guestContextValue: AuthContextValue = {
  archiveScopeKey: 'guest',
  isLoading: false,
  mode: 'guest',
  signIn: vi.fn(async () => '/'),
  signOut: vi.fn(async () => undefined),
  signUp: vi.fn(async () => '/'),
  user: null,
};

function renderAccountLayout() {
  const router = createMemoryRouter(
    [
      {
        element: (
          <AuthContext.Provider value={guestContextValue}>
            <AccountLayout />
          </AuthContext.Provider>
        ),
        path: '/account',
        children: [
          {
            element: <div>계정 본문</div>,
            index: true,
          },
        ],
      },
    ],
    {
      initialEntries: ['/account'],
    },
  );

  renderWithProviders(<RouterProvider router={router} />);
}

describe('AccountLayout', () => {
  it('groups mobile account actions as clear full-width quick actions', async () => {
    renderAccountLayout();

    expect(await screen.findByText('계정 본문')).toBeInTheDocument();

    const quickActions = screen.getByRole('group', {
      name: '계정 빠른 작업',
    });

    expect(
      within(quickActions).getByRole('button', { name: /모드로 전환/ }),
    ).toBeInTheDocument();
    expect(
      within(quickActions).getByRole('link', { name: '작품' }),
    ).toHaveAttribute('href', '/works');
    expect(
      within(quickActions).getByRole('link', { name: '로그인' }),
    ).toHaveAttribute('href', '/auth/login');
  });
});
