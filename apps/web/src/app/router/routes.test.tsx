import { Suspense, isValidElement, type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { getPrimaryNavigationItems } from '../layouts/navigation';
import { createAppRoutes } from './routes';
import { RouteErrorBoundary } from '@shared/components/RouteErrorBoundary';
import type { FeatureFlags } from '@shared/runtime/feature-flags';
import { StateMessage } from '@shared/components/AppPrimitives';

const flagsWithTierBoardsOff: FeatureFlags = {
  diagnostics: false,
  publicShare: false,
  pwaInstall: false,
  tierBoards: false,
};

interface SuspenseElementProps {
  fallback: unknown;
}

describe('app routes', () => {
  it('hides tier board navigation and redirects tier board routes when the flag is off', () => {
    expect(getPrimaryNavigationItems(flagsWithTierBoardsOff)).toEqual([
      { label: '홈', to: '/' },
      { label: '작품', to: '/works' },
      { label: '인사이트', to: '/insights' },
    ]);

    const productRoute = createAppRoutes(flagsWithTierBoardsOff)[0];

    if (!productRoute) {
      throw new Error('Expected product route to exist.');
    }

    const tierBoardRoutes = productRoute.children?.filter((route) =>
      route.path?.startsWith('tier-boards'),
    );

    expect(tierBoardRoutes).toHaveLength(3);
    for (const route of tierBoardRoutes ?? []) {
      expect(isValidElement(route.element)).toBe(true);
      expect(isValidElement(route.element) && route.element.type).toBe(
        Navigate,
      );
      expect(
        isValidElement(route.element) && route.element.props,
      ).toMatchObject({
        replace: true,
        to: '/works',
      });
    }
  });
  it('does not register Community routes in the default personal archive', () => {
    const paths = createAppRoutes()[0]?.children?.map((route) => route.path);
    expect(paths).not.toContain('community');
    expect(paths).not.toContain('community/boards');
    expect(paths).not.toContain('u/:handle');
  });

  it('registers only the approved root Community route for reflection alpha', () => {
    const routes = createAppRoutes(
      undefined,
      'standard',
      'community-reflection-alpha',
    );
    const productRoutes = routes[0]?.children ?? [];
    const communityRoute = productRoutes.find(
      (route) => route.path === 'community',
    );

    expect(communityRoute).toBeDefined();
    expect(isValidElement(communityRoute?.element)).toBe(true);
    expect(
      isValidElement(communityRoute?.element) && communityRoute.element.type,
    ).toBe(Suspense);
    expect(productRoutes.map((route) => route.path)).not.toEqual(
      expect.arrayContaining([
        'community/boards',
        'community/posts/:id',
        'community/reviews/:id',
        'community/taste',
        'u/:handle',
      ]),
    );
  });

  it('registers expanded routes only for the social experiment', () => {
    const paths = createAppRoutes(
      undefined,
      'standard',
      'community-social-experiment',
    )[0]?.children?.map((route) => route.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'community',
        'community/boards',
        'community/posts/:id',
        'community/reviews/:id',
        'community/taste',
        'u/:handle',
      ]),
    );
  });

  it('keeps network routes closed for Community core', () => {
    const paths = createAppRoutes(
      undefined,
      'standard',
      'community-core',
    )[0]?.children?.map((route) => route.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'community',
        'community/boards',
        'community/posts/:id',
        'community/reviews/:id',
        'u/:handle',
      ]),
    );
    expect(paths).not.toContain('community/taste');
  });

  it('opens every Community route for Community full', () => {
    const paths = createAppRoutes(
      undefined,
      'standard',
      'community-full',
    )[0]?.children?.map((route) => route.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'community',
        'community/taste',
        'u/:handle',
      ]),
    );
  });

  it('keeps /insights in the product layout instead of redirecting to /works', () => {
    const routes = createAppRoutes();
    const productRoutes = routes[0]?.children ?? [];
    const insightsRoute = productRoutes.find(
      (route) => route.path === 'insights',
    );

    expect(insightsRoute).toBeDefined();
    expect(isValidElement(insightsRoute?.element)).toBe(true);
    // 페이지는 lazy 로드되므로 Suspense 경계로 감싸 product 레이아웃에 둔다.
    expect(
      isValidElement(insightsRoute?.element) && insightsRoute.element.type,
    ).toBe(Suspense);
    expect(
      routes.some(
        (route) =>
          route.path === '/insights' &&
          isValidElement(route.element) &&
          route.element.type === Navigate,
      ),
    ).toBe(false);
  });

  it('renders lazy route loading fallback from translation resources', () => {
    const routes = createAppRoutes();
    const productRoutes = routes[0]?.children ?? [];
    const worksRoute = productRoutes.find((route) => route.path === 'works');

    expect(isValidElement(worksRoute?.element)).toBe(true);
    if (!isValidElement(worksRoute?.element)) {
      throw new Error('Expected works route element to be valid.');
    }

    expect(worksRoute.element.type).toBe(Suspense);
    const fallback = (worksRoute.element as ReactElement<SuspenseElementProps>)
      .props.fallback;

    expect(isValidElement(fallback)).toBe(true);
    expect(isValidElement(fallback) && fallback.type).toBe(StateMessage);
    expect(isValidElement(fallback) && fallback.props).toMatchObject({
      description: '화면 데이터를 준비하는 중입니다.',
      eyebrow: '불러오는 중',
      title: '화면을 불러오고 있습니다',
      tone: 'loading',
    });
  });

  it('adds route error boundaries to primary product, auth, and account routes', () => {
    const routes = createAppRoutes(
      undefined,
      'standard',
      'community-reflection-alpha',
    );
    const productRoutes = routes[0]?.children ?? [];
    const authRoutes =
      routes.find((route) => route.path === '/auth')?.children ?? [];
    const accountRoutes =
      routes.find((route) => route.path === '/account')?.children ?? [];
    const routePathsWithBoundaries = [
      productRoutes.find((route) => route.index),
      productRoutes.find((route) => route.path === 'works'),
      productRoutes.find((route) => route.path === 'works/:id'),
      productRoutes.find((route) => route.path === 'works/:id/edit'),
      productRoutes.find((route) => route.path === 'insights'),
      productRoutes.find((route) => route.path === 'community'),
      productRoutes.find((route) => route.path === 'tier-boards/:boardId/view'),
      productRoutes.find((route) => route.path === 'profile'),
      authRoutes.find((route) => route.path === 'login'),
      authRoutes.find((route) => route.path === 'google/complete'),
      accountRoutes.find((route) => route.index),
      accountRoutes.find((route) => route.path === 'transfer'),
    ];

    for (const route of routePathsWithBoundaries) {
      expect(route?.errorElement).toBeDefined();
      expect(isValidElement(route?.errorElement)).toBe(true);
      expect(
        isValidElement(route?.errorElement) && route.errorElement.type,
      ).toBe(RouteErrorBoundary);
    }
  });
  it('redirects account and authentication-only routes in the Sites guest POC', () => {
    const routes = createAppRoutes(flagsWithTierBoardsOff, 'sites-guest-poc');
    const productRoutes = routes[0]?.children ?? [];
    const authRoutes =
      routes.find((route) => route.path === '/auth')?.children ?? [];
    const accountRoutes =
      routes.find((route) => route.path === '/account')?.children ?? [];
    const redirects = [
      [productRoutes.find((route) => route.path === 'profile'), '/'],
      [authRoutes.find((route) => route.path === 'login'), '/'],
      [authRoutes.find((route) => route.path === 'google/complete'), '/'],
      [accountRoutes.find((route) => route.index), '/account/settings'],
      [
        accountRoutes.find((route) => route.path === 'transfer'),
        '/account/settings',
      ],
    ] as const;

    for (const [route, target] of redirects) {
      expect(isValidElement(route?.element)).toBe(true);
      expect(isValidElement(route?.element) && route.element.type).toBe(
        Navigate,
      );
      expect(
        isValidElement(route?.element) && route.element.props,
      ).toMatchObject({ replace: true, to: target });
    }
  });
});
