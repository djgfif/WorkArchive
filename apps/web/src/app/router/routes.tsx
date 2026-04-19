import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { RegisterPage } from '../../features/auth/pages/RegisterPage';
import { CommunityPage } from '../../features/community/pages/CommunityPage';
import { HomePage } from '../../features/home/pages/HomePage';
import { InsightsPage } from '../../features/insights/pages/InsightsPage';
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
    path: '/',
    element: <AppLayout />,
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
      {
        path: 'profile/sync',
        element: <SyncPage />,
      },
      {
        path: 'sync',
        element: <Navigate replace to="/profile/sync" />,
      },
      {
        path: 'profile/settings',
        element: <SettingsPage />,
      },
      {
        path: 'settings',
        element: <Navigate replace to="/profile/settings" />,
      },
      {
        path: 'auth/login',
        element: <LoginPage />,
      },
      {
        path: 'auth/register',
        element: <RegisterPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];
