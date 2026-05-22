import { isValidElement } from 'react';
import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { getPrimaryNavigationItems } from '../layouts/navigation';
import { createAppRoutes } from './routes';
import { RouteErrorBoundary } from '../../shared/components/RouteErrorBoundary';
import type { FeatureFlags } from '../../shared/runtime/feature-flags';

const flagsWithTierBoardsOff: FeatureFlags = {
  diagnostics: false,
  publicShare: false,
  pwaInstall: false,
  tierBoards: false,
};

describe('app routes', () => {
  it('hides tier board navigation and redirects tier board routes when the flag is off', () => {
    expect(getPrimaryNavigationItems(flagsWithTierBoardsOff)).toEqual([
      { label: '홈', to: '/' },
      { label: '작품', to: '/works' },
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

  it('adds route error boundaries to primary product, auth, and account routes', () => {
    const routes = createAppRoutes();
    const productRoutes = routes[0]?.children ?? [];
    const authRoutes = routes.find((route) => route.path === '/auth')?.children ?? [];
    const accountRoutes =
      routes.find((route) => route.path === '/account')?.children ?? [];
    const routePathsWithBoundaries = [
      productRoutes.find((route) => route.index),
      productRoutes.find((route) => route.path === 'works'),
      productRoutes.find((route) => route.path === 'works/:id'),
      productRoutes.find((route) => route.path === 'works/:id/edit'),
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
      expect(isValidElement(route?.errorElement) && route.errorElement.type).toBe(
        RouteErrorBoundary,
      );
    }
  });
});
