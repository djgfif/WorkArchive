import { useEffect } from 'react';

const BASE_TITLE = 'Work Archive';

/**
 * 라우트별 브라우저 탭 제목을 지정한다.
 * 빈 값이면 기본 제목(Work Archive)만 남긴다.
 */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    const trimmed = title?.trim();
    document.title = trimmed ? `${trimmed} · ${BASE_TITLE}` : BASE_TITLE;

    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
