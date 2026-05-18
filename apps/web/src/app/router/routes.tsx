import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

import { AccountLayout } from '../layouts/AccountLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainProductLayout } from '../layouts/MainProductLayout';
import { MinimalLayout } from '../layouts/MinimalLayout';
import { NotFoundPage } from './NotFoundPage';
import { GuestTransferReviewPage } from '../../features/auth/pages/GuestTransferReviewPage';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { PasswordResetConfirmPage } from '../../features/auth/pages/PasswordResetConfirmPage';
import { PasswordResetRequestPage } from '../../features/auth/pages/PasswordResetRequestPage';
import { RegisterPage } from '../../features/auth/pages/RegisterPage';
import { HomePage } from '../../features/home/pages/HomePage';
import { AccountOverviewPage } from '../../features/profile/pages/AccountOverviewPage';
import { ProfilePage } from '../../features/profile/pages/ProfilePage';
import { SettingsPage } from '../../features/profile/pages/SettingsPage';
import { WorkCreatePage } from '../../features/works/pages/WorkCreatePage';
import { WorkDetailPage } from '../../features/works/pages/WorkDetailPage';
import { WorkEditPage } from '../../features/works/pages/WorkEditPage';
import { WorksListPage } from '../../features/works/pages/WorksListPage';

export const appRoutes: RouteObject[] = [
  {
    element: <MainProductLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'home',
        element: <Navigate replace to="/" />,
      },
      {
        path: 'works',
        element: <WorksListPage />,
      },
      {
        path: 'works/new',
        element: <WorkCreatePage />,
      },
      {
        path: 'works/:id',
        element: <WorkDetailPage />,
      },
      {
        path: 'works/:id/edit',
        element: <WorkEditPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'password-reset',
        element: <PasswordResetRequestPage />,
      },
      {
        path: 'password-reset/confirm',
        element: <PasswordResetConfirmPage />,
      },
    ],
  },
  {
    path: '/account',
    element: <AccountLayout />,
    children: [
      {
        index: true,
        element: <AccountOverviewPage />,
      },
      {
        path: 'transfer',
        element: <GuestTransferReviewPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: '/tier-boards',
    element: <Navigate replace to="/works" />,
  },
  {
    path: '/community',
    element: <Navigate replace to="/works" />,
  },
  {
    path: '/insights',
    element: <Navigate replace to="/works" />,
  },
  {
    path: '/account/sync',
    element: <Navigate replace to="/account/settings" />,
  },
  {
    path: '/sync',
    element: <Navigate replace to="/account/settings" />,
  },
  {
    path: '/settings',
    element: <Navigate replace to="/account/settings" />,
  },
  {
    path: '/profile/sync',
    element: <Navigate replace to="/account/settings" />,
  },
  {
    path: '/profile/settings',
    element: <Navigate replace to="/account/settings" />,
  },
  {
    element: <MinimalLayout />,
    children: [
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];
