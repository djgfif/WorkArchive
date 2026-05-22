import { describe, expect, it } from 'vitest';

import { getRouteErrorDescription } from './route-error-description';

describe('RouteErrorBoundary', () => {
  it('keeps raw error messages visible in development', () => {
    expect(
      getRouteErrorDescription(new Error('IndexedDB 연결 실패'), true),
    ).toContain('IndexedDB 연결 실패');
  });

  it('hides raw error messages from production users', () => {
    expect(
      getRouteErrorDescription(
        new Error('database token leaked in stack'),
        false,
      ),
    ).toBe('화면을 다시 그리는 중 오류가 발생했습니다.');
  });
});
