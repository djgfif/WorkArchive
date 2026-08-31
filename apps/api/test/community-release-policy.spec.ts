import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import {
  CommunityReleaseGuard,
  isCommunityReleaseEnabled,
  readProductReleaseProfile,
} from '../src/modules/community/community-release-policy';

describe('community release policy', () => {
  it('defaults to personal archive with every community surface disabled', () => {
    expect(readProductReleaseProfile(undefined)).toBe('personal-archive');
    expect(isCommunityReleaseEnabled('personal-archive', 'reflection')).toBe(
      false,
    );
    expect(isCommunityReleaseEnabled('personal-archive', 'social')).toBe(false);
    expect(isCommunityReleaseEnabled('personal-archive', 'full')).toBe(false);
  });

  it('keeps reflection alpha narrower than the social experiment', () => {
    expect(
      isCommunityReleaseEnabled('community-reflection-alpha', 'reflection'),
    ).toBe(true);
    expect(
      isCommunityReleaseEnabled('community-reflection-alpha', 'social'),
    ).toBe(false);
    expect(
      isCommunityReleaseEnabled('community-social-experiment', 'social'),
    ).toBe(true);
  });

  it('opens formal core without enabling follow, taste, or notifications', () => {
    expect(isCommunityReleaseEnabled('community-core', 'core')).toBe(true);
    expect(isCommunityReleaseEnabled('community-core', 'full')).toBe(false);
    expect(isCommunityReleaseEnabled('community-full', 'full')).toBe(true);
  });

  it('rejects a misspelled explicit server profile', () => {
    expect(() => readProductReleaseProfile('community')).toThrow(
      /PRODUCT_RELEASE_PROFILE/,
    );
  });

  it('returns 404 when a controller has no release requirement metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new CommunityReleaseGuard(reflector);
    const context = {
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
  });

  it('returns 404 when the active profile does not meet the requirement', () => {
    const previous = process.env.PRODUCT_RELEASE_PROFILE;
    process.env.PRODUCT_RELEASE_PROFILE = 'personal-archive';
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('social'),
    } as unknown as Reflector;
    const guard = new CommunityReleaseGuard(reflector);
    const context = {
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;

    try {
      expect(() => guard.canActivate(context)).toThrow(NotFoundException);
    } finally {
      if (previous === undefined) delete process.env.PRODUCT_RELEASE_PROFILE;
      else process.env.PRODUCT_RELEASE_PROFILE = previous;
    }
  });
});
