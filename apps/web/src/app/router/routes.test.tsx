import { isValidElement } from 'react';
import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { getPrimaryNavigationItems } from '../layouts/MainProductLayout';
import { createAppRoutes } from './routes';
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
});
