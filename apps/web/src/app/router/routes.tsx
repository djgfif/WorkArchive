import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

import { AccountLayout } from '../layouts/AccountLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainProductLayout } from '../layouts/MainProductLayout';
import { MinimalLayout } from '../layouts/MinimalLayout';
import { NotFoundPage } from './NotFoundPage';
import { GuestTransferReviewPage } from '../../features/auth/pages/GuestTransferReviewPage';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { RegisterPage } from '../../features/auth/pages/RegisterPage';
import { CommunityPage } from '../../features/community/pages/CommunityPage';
import { HomePage } from '../../features/home/pages/HomePage';
import { InsightsPage } from '../../features/insights/pages/InsightsPage';
import { AccountOverviewPage } from '../../features/profile/pages/AccountOverviewPage';
import { ProfilePage } from '../../features/profile/pages/ProfilePage';
import { SettingsPage } from '../../features/profile/pages/SettingsPage';
import { TierBoardsPage } from '../../features/tier-boards/pages/TierBoardsPage';
import { SyncPage } from '../../features/sync/pages/SyncPage';
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
        path: 'tier-boards',
        element: <TierBoardsPage />,
      },
      {
        path: 'insights',
        element: <InsightsPage />,
      },
      {
        path: 'community',
        element: <CommunityPage />,
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
        path: 'sync',
        element: <SyncPage />,
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
    path: '/sync',
    element: <Navigate replace to="/account/sync" />,
  },
  {
    path: '/settings',
    element: <Navigate replace to="/account/settings" />,
  },
  {
    path: '/profile/sync',
    element: <Navigate replace to="/account/sync" />,
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
