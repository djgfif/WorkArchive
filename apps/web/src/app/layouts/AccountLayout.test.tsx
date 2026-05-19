import { screen } from '@testing-library/react';
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

    expect(
      screen.getAllByRole('button', { name: /모드로 전환/ }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: '작품 목록으로' })[0],
    ).toHaveAttribute('href', '/works');
    expect(
      screen.getAllByRole('link', { name: '로그인' })[0],
    ).toHaveAttribute('href', '/auth/login');
    expect(
      screen.getAllByRole('navigation', { name: '계정 내비게이션' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: '계정 개요' }).length,
    ).toBeGreaterThan(0);
  });
});
