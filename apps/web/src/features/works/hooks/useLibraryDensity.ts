import { useState } from 'react';

/**
 * 서재 포스터 그리드 밀도 — 개인 보기 편의 설정이므로(공유 필터 아님)
 * URL 이 아니라 localStorage 에 보관한다.
 */
export type LibraryDensity = 'comfortable' | 'compact';

const STORAGE_KEY = 'work-archive.ui.library-density';

function readStoredDensity(): LibraryDensity {
  if (typeof window === 'undefined') {
    return 'comfortable';
  }

  return window.localStorage.getItem(STORAGE_KEY) === 'compact'
    ? 'compact'
    : 'comfortable';
}

export function useLibraryDensity(): [
  LibraryDensity,
  (density: LibraryDensity) => void,
] {
  const [density, setDensityState] = useState<LibraryDensity>(readStoredDensity);

  function setDensity(next: LibraryDensity) {
    setDensityState(next);

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage 가 막혀 있어도 이번 세션 동안의 선택은 유지된다.
    }
  }

  return [density, setDensity];
}
