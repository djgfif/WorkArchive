import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { Suspense, type ReactNode } from 'react';

import { AccountLayout } from '../layouts/AccountLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainProductLayout } from '../layouts/MainProductLayout';
import { MinimalLayout } from '../layouts/MinimalLayout';
import { NotFoundPage } from './NotFoundPage';
import {
  TierBoardEditorPage,
  TierBoardsPage,
  TierBoardViewPage,
} from './tier-board-route-components';
import {
  CommunityPage,
  AccountOverviewPage,
  GoogleAuthCompletePage,
  GuestTransferReviewPage,
  LoginPage,
  PersonalInsightsPage,
  ProfilePage,
  SettingsPage,
  WorkCreatePage,
  WorkDetailPage,
  WorkEditPage,
  WorksListPage,
} from './page-route-components';
import { RouteErrorBoundary } from '@shared/components/RouteErrorBoundary';
import { featureFlags, type FeatureFlags } from '@shared/runtime/feature-flags';
import {
  deploymentProfile,
  type DeploymentProfile,
} from '@shared/runtime/deployment-profile';
import { HomePage } from '@features/home';
import { StateMessage } from '@shared/components/AppPrimitives';
import { appI18n } from '@app/i18n';

function lazyRoute(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <StateMessage
          description={appI18n.t('routes.loadingDescription')}
          eyebrow={appI18n.t('routes.loadingEyebrow')}
          title={appI18n.t('routes.loadingTitle')}
          tone="loading"
        />
      }
    >
      {element}
    </Suspense>
  );
}

function routeError(
  title: string,
  fallbackPath: string,
  fallbackLabel: string,
) {
  return (
    <RouteErrorBoundary
      fallbackLabel={fallbackLabel}
      fallbackPath={fallbackPath}
      title={title}
    />
  );
}

function tierBoardElement(flags: FeatureFlags, element: ReactNode) {
  return flags.tierBoards ? (
    lazyRoute(element)
  ) : (
    <Navigate replace to="/works" />
  );
}

export function createAppRoutes(
  flags: FeatureFlags = featureFlags,
  profile: DeploymentProfile = deploymentProfile,
): RouteObject[] {
  const sitesGuestPoc = profile === 'sites-guest-poc';
  return [
    {
      element: <MainProductLayout />,
      children: [
        {
          index: true,
          element: <HomePage />,
          errorElement: routeError(
            appI18n.t('routes.homeError'),
            '/works',
            appI18n.t('routes.fallbackWorksMove'),
          ),
        },
        {
          path: 'home',
          element: <Navigate replace to="/" />,
        },
        {
          path: 'works',
          element: lazyRoute(<WorksListPage />),
          errorElement: routeError(
            appI18n.t('routes.worksError'),
            '/',
            appI18n.t('routes.fallbackHome'),
          ),
        },
        {
          path: 'community',
          element: lazyRoute(<CommunityPage />),
          errorElement: routeError(
            appI18n.t('routes.communityError'),
            '/works',
            appI18n.t('routes.fallbackWorks'),
          ),
        },
        {
          path: 'works/new',
          element: lazyRoute(<WorkCreatePage />),
          errorElement: routeError(
            appI18n.t('routes.workCreateError'),
            '/works',
            appI18n.t('routes.fallbackWorks'),
          ),
        },
        {
          path: 'works/:id',
          element: lazyRoute(<WorkDetailPage />),
          errorElement: routeError(
            appI18n.t('routes.workDetailError'),
            '/works',
            appI18n.t('routes.fallbackWorks'),
          ),
        },
        {
          path: 'works/:id/edit',
          element: lazyRoute(<WorkEditPage />),
          errorElement: routeError(
            appI18n.t('routes.workEditError'),
            '/works',
            appI18n.t('routes.fallbackWorks'),
          ),
        },
        {
          path: 'insights',
          element: lazyRoute(<PersonalInsightsPage />),
          errorElement: routeError(
            appI18n.t('routes.insightsError'),
            '/works',
            appI18n.t('routes.fallbackWorks'),
          ),
        },
        {
          path: 'tier-boards',
          element: tierBoardElement(flags, <TierBoardsPage />),
          errorElement: routeError(
            appI18n.t('routes.tierBoardsError'),
            '/works',
            appI18n.t('routes.fallbackWorks'),
          ),
        },
        {
          path: 'tier-boards/:boardId',
          element: tierBoardElement(flags, <TierBoardEditorPage />),
          errorElement: routeError(
            appI18n.t('routes.tierBoardEditorError'),
            '/tier-boards',
            appI18n.t('routes.fallbackTierBoards'),
          ),
        },
        {
          path: 'tier-boards/:boardId/view',
          element: tierBoardElement(flags, <TierBoardViewPage />),
          errorElement: routeError(
            appI18n.t('routes.tierBoardViewError'),
            '/tier-boards',
            appI18n.t('routes.fallbackTierBoards'),
          ),
        },
        {
          path: 'profile',
          element: sitesGuestPoc ? (
            <Navigate replace to="/" />
          ) : (
            lazyRoute(<ProfilePage />)
          ),
          errorElement: routeError(
            appI18n.t('routes.profileError'),
            '/account',
            appI18n.t('routes.fallbackAccount'),
          ),
        },
      ],
    },
    {
      path: '/auth',
      element: <AuthLayout />,
      children: [
        {
          path: 'login',
          element: sitesGuestPoc ? (
            <Navigate replace to="/" />
          ) : (
            lazyRoute(<LoginPage />)
          ),
          errorElement: routeError(
            appI18n.t('routes.loginError'),
            '/works',
            appI18n.t('routes.fallbackWorksMove'),
          ),
        },
        {
          path: 'register',
          element: <Navigate replace to="/auth/login" />,
        },
        {
          path: 'google/complete',
          element: sitesGuestPoc ? (
            <Navigate replace to="/" />
          ) : (
            lazyRoute(<GoogleAuthCompletePage />)
          ),
          errorElement: routeError(
            appI18n.t('routes.googleCompleteError'),
            '/auth/login',
            appI18n.t('routes.fallbackLogin'),
          ),
        },
        {
          path: 'password-reset',
          element: <Navigate replace to="/auth/login" />,
        },
        {
          path: 'password-reset/confirm',
          element: <Navigate replace to="/auth/login" />,
        },
      ],
    },
    {
      path: '/account',
      element: <AccountLayout />,
      children: [
        {
          index: true,
          element: sitesGuestPoc ? (
            <Navigate replace to="/account/settings" />
          ) : (
            lazyRoute(<AccountOverviewPage />)
          ),
          errorElement: routeError(
            appI18n.t('routes.accountOverviewError'),
            '/works',
            appI18n.t('routes.fallbackWorksMove'),
          ),
        },
        {
          path: 'transfer',
          element: sitesGuestPoc ? (
            <Navigate replace to="/account/settings" />
          ) : (
            lazyRoute(<GuestTransferReviewPage />)
          ),
          errorElement: routeError(
            appI18n.t('routes.transferError'),
            '/account',
            appI18n.t('routes.fallbackAccount'),
          ),
        },
        {
          path: 'settings',
          element: lazyRoute(<SettingsPage />),
          errorElement: routeError(
            appI18n.t('routes.settingsError'),
            '/account',
            appI18n.t('routes.fallbackAccount'),
          ),
        },
      ],
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
}

export const appRoutes: RouteObject[] = createAppRoutes();
