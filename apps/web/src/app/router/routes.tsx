import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';

import { AccountLayout } from '../layouts/AccountLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainProductLayout } from '../layouts/MainProductLayout';
import { MinimalLayout } from '../layouts/MinimalLayout';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorBoundary } from '@shared/components/RouteErrorBoundary';
import {
  featureFlags,
  type FeatureFlags,
} from '@shared/runtime/feature-flags';
import {
  GoogleAuthCompletePage,
  GuestTransferReviewPage,
  LoginPage,
} from '@features/auth';
import { HomePage } from '@features/home';
import {
  AccountOverviewPage,
  ProfilePage,
  SettingsPage,
} from '@features/profile';
import {
  WorkCreatePage,
  WorkDetailPage,
  WorkEditPage,
  WorksListPage,
} from '@features/works';
import { StateMessage } from '@shared/components/AppPrimitives';

const TierBoardsPage = lazy(() =>
  import('@features/tier-boards').then((module) => ({
    default: module.TierBoardsPage,
  })),
);
const TierBoardEditorPage = lazy(() =>
  import('@features/tier-boards').then((module) => ({
    default: module.TierBoardEditorPage,
  })),
);
const TierBoardViewPage = lazy(() =>
  import('@features/tier-boards').then((module) => ({
    default: module.TierBoardViewPage,
  })),
);

function lazyRoute(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <StateMessage
          description="화면 데이터를 준비하는 중입니다."
          eyebrow="Loading"
          title="화면을 불러오고 있습니다"
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
): RouteObject[] {
  return [
    {
      element: <MainProductLayout />,
      children: [
        {
          index: true,
          element: <HomePage />,
          errorElement: routeError(
            '홈 화면을 복구할 수 없습니다',
            '/works',
            '작품 목록으로 이동',
          ),
        },
        {
          path: 'home',
          element: <Navigate replace to="/" />,
        },
        {
          path: 'works',
          element: <WorksListPage />,
          errorElement: routeError(
            '작품 목록을 복구할 수 없습니다',
            '/',
            '홈으로 돌아가기',
          ),
        },
        {
          path: 'works/new',
          element: <WorkCreatePage />,
          errorElement: routeError(
            '작품 추가 화면을 복구할 수 없습니다',
            '/works',
            '작품 목록으로 돌아가기',
          ),
        },
        {
          path: 'works/:id',
          element: <WorkDetailPage />,
          errorElement: routeError(
            '작품 상세 화면을 복구할 수 없습니다',
            '/works',
            '작품 목록으로 돌아가기',
          ),
        },
        {
          path: 'works/:id/edit',
          element: <WorkEditPage />,
          errorElement: routeError(
            '작품 편집 화면을 복구할 수 없습니다',
            '/works',
            '작품 목록으로 돌아가기',
          ),
        },
        {
          path: 'tier-boards',
          element: tierBoardElement(flags, <TierBoardsPage />),
          errorElement: routeError(
            '티어보드 목록을 복구할 수 없습니다',
            '/works',
            '작품 목록으로 돌아가기',
          ),
        },
        {
          path: 'tier-boards/:boardId',
          element: tierBoardElement(flags, <TierBoardEditorPage />),
          errorElement: routeError(
            '티어보드 편집 화면을 복구할 수 없습니다',
            '/tier-boards',
            '티어보드 목록으로 돌아가기',
          ),
        },
        {
          path: 'tier-boards/:boardId/view',
          element: tierBoardElement(flags, <TierBoardViewPage />),
          errorElement: routeError(
            '티어보드 보기 화면을 복구할 수 없습니다',
            '/tier-boards',
            '티어보드 목록으로 돌아가기',
          ),
        },
        {
          path: 'profile',
          element: <ProfilePage />,
          errorElement: routeError(
            '프로필 화면을 복구할 수 없습니다',
            '/account',
            '계정 개요로 돌아가기',
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
          element: <LoginPage />,
          errorElement: routeError(
            '로그인 화면을 복구할 수 없습니다',
            '/works',
            '작품 목록으로 이동',
          ),
        },
        {
          path: 'register',
          element: <Navigate replace to="/auth/login" />,
        },
        {
          path: 'google/complete',
          element: <GoogleAuthCompletePage />,
          errorElement: routeError(
            'Google 로그인 완료 화면을 복구할 수 없습니다',
            '/auth/login',
            '로그인으로 돌아가기',
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
          element: <AccountOverviewPage />,
          errorElement: routeError(
            '계정 개요를 복구할 수 없습니다',
            '/works',
            '작품 목록으로 이동',
          ),
        },
        {
          path: 'transfer',
          element: <GuestTransferReviewPage />,
          errorElement: routeError(
            '게스트 기록 이전 화면을 복구할 수 없습니다',
            '/account',
            '계정 개요로 돌아가기',
          ),
        },
        {
          path: 'settings',
          element: <SettingsPage />,
          errorElement: routeError(
            '설정 화면을 복구할 수 없습니다',
            '/account',
            '계정 개요로 돌아가기',
          ),
        },
      ],
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
}

export const appRoutes: RouteObject[] = createAppRoutes();
