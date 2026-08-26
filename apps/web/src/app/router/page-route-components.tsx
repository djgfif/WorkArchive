import { lazy } from 'react';

// 라우트 단위 코드 스플리팅: 첫 진입(홈/404)을 제외한 페이지는 네비게이션 시점에
// 로드한다. 무거운 서비스(중복 정리, 그래프 저장소 등)를 초기 번들에서 분리한다.

export const WorksListPage = lazy(() =>
  import('@features/works/routes').then((module) => ({
    default: module.WorksListPage,
  })),
);

export const WorkCreatePage = lazy(() =>
  import('@features/works/routes').then((module) => ({
    default: module.WorkCreatePage,
  })),
);

export const WorkDetailPage = lazy(() =>
  import('@features/works/routes').then((module) => ({
    default: module.WorkDetailPage,
  })),
);

export const WorkEditPage = lazy(() =>
  import('@features/works/routes').then((module) => ({
    default: module.WorkEditPage,
  })),
);

export const PersonalInsightsPage = lazy(() =>
  import('@features/insights/pages/PersonalInsightsPage').then((module) => ({
    default: module.PersonalInsightsPage,
  })),
);

export const CommunityReflectionPage = lazy(() =>
  import('@features/community/pages/CommunityReflectionPage').then((module) => ({
    default: module.CommunityReflectionPage,
  })),
);

export const CommunityPage = lazy(() =>
  import('@features/community/pages/CommunityPage').then((module) => ({
    default: module.CommunityPage,
  })),
);
export const CommunityBoardsPage = lazy(() =>
  import('@features/community/pages/CommunityBoardsPage').then((module) => ({
    default: module.CommunityBoardsPage,
  })),
);
export const CommunityPostDetailPage = lazy(() =>
  import('@features/community/pages/CommunityDetailPage').then((module) => ({
    default: module.CommunityPostDetailPage,
  })),
);
export const CommunityReviewDetailPage = lazy(() =>
  import('@features/community/pages/CommunityDetailPage').then((module) => ({
    default: module.CommunityReviewDetailPage,
  })),
);
export const CommunityProfilePage = lazy(() =>
  import('@features/community/pages/CommunityProfilePage').then((module) => ({
    default: module.CommunityProfilePage,
  })),
);
export const CommunityTastePage = lazy(() =>
  import('@features/community/pages/CommunityTastePage').then((module) => ({
    default: module.CommunityTastePage,
  })),
);

export const ProfilePage = lazy(() =>
  import('@features/profile/pages/ProfilePage').then((module) => ({
    default: module.ProfilePage,
  })),
);

export const AccountOverviewPage = lazy(() =>
  import('@features/profile/pages/AccountOverviewPage').then((module) => ({
    default: module.AccountOverviewPage,
  })),
);

export const SettingsPage = lazy(() =>
  import('@features/profile/pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);

export const LoginPage = lazy(() =>
  import('@features/auth/pages/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
);

export const GoogleAuthCompletePage = lazy(() =>
  import('@features/auth/pages/GoogleAuthCompletePage').then((module) => ({
    default: module.GoogleAuthCompletePage,
  })),
);

export const GuestTransferReviewPage = lazy(() =>
  import('@features/auth/pages/GuestTransferReviewPage').then((module) => ({
    default: module.GuestTransferReviewPage,
  })),
);
