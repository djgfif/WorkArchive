import { screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { getLinkByHref } from '@test/ui-helpers';
import {
  AuthContext,
  type AuthContextValue,
} from '@features/auth';
import { AccountLayout } from './AccountLayout';

const guestContextValue: AuthContextValue = {
  archiveScopeKey: 'guest',
  isLoading: false,
  mode: 'guest',
  sessionStatus: 'guest',
  signOut: vi.fn(async () => undefined),
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
  it('renders account navigation and account actions', async () => {
    renderAccountLayout();

    expect(await screen.findByText('계정 본문')).toBeInTheDocument();

    expect(
      screen.getAllByRole('button', { name: /모드로 전환/ }).length,
    ).toBeGreaterThan(0);
    expect(getLinkByHref('/works')).toBeInTheDocument();
    expect(getLinkByHref('/auth/login')).toBeInTheDocument();
    expect(getLinkByHref('/')).toHaveTextContent('Work Archive');
    expect(
      screen.getAllByRole('link', { name: '계정 개요' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: '설정과 백업' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: '작품 목록으로' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: '로그인' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
    expect(getLinkByHref('/account')).toBeInTheDocument();
  });
});
