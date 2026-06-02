import { lazy } from 'react';

// 라우트 단위 코드 스플리팅: 첫 진입(홈/404)을 제외한 페이지는 네비게이션 시점에
// 로드한다. 무거운 서비스(중복 정리, 그래프 저장소 등)를 초기 번들에서 분리한다.

export const WorksListPage = lazy(() =>
  import('@features/works').then((module) => ({
    default: module.WorksListPage,
  })),
);

export const WorkCreatePage = lazy(() =>
  import('@features/works').then((module) => ({
    default: module.WorkCreatePage,
  })),
);

export const WorkDetailPage = lazy(() =>
  import('@features/works').then((module) => ({
    default: module.WorkDetailPage,
  })),
);

export const WorkEditPage = lazy(() =>
  import('@features/works').then((module) => ({
    default: module.WorkEditPage,
  })),
);

export const PersonalInsightsPage = lazy(() =>
  import('@features/insights').then((module) => ({
    default: module.PersonalInsightsPage,
  })),
);

export const ProfilePage = lazy(() =>
  import('@features/profile').then((module) => ({
    default: module.ProfilePage,
  })),
);

export const AccountOverviewPage = lazy(() =>
  import('@features/profile').then((module) => ({
    default: module.AccountOverviewPage,
  })),
);

export const SettingsPage = lazy(() =>
  import('@features/profile').then((module) => ({
    default: module.SettingsPage,
  })),
);

export const LoginPage = lazy(() =>
  import('@features/auth').then((module) => ({
    default: module.LoginPage,
  })),
);

export const GoogleAuthCompletePage = lazy(() =>
  import('@features/auth').then((module) => ({
    default: module.GoogleAuthCompletePage,
  })),
);

export const GuestTransferReviewPage = lazy(() =>
  import('@features/auth').then((module) => ({
    default: module.GuestTransferReviewPage,
  })),
);
