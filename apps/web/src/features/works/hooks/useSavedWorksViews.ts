import { useCallback, useState } from 'react';

export interface SavedWorksView {
  id: string;
  name: string;
  /** 적용할 쿼리스트링 — 예) "?status=in_progress&serial=ongoing" */
  search: string;
  createdAt: string;
}

const STORAGE_KEY = 'work-archive.saved-works-views';

function readViews(): SavedWorksView[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is SavedWorksView =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SavedWorksView).id === 'string' &&
        typeof (item as SavedWorksView).name === 'string' &&
        typeof (item as SavedWorksView).search === 'string',
    );
  } catch {
    return [];
  }
}

function writeViews(views: SavedWorksView[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // 저장소가 막혀 있어도(quota·프라이빗 모드) 조용히 넘어간다.
  }
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `view-${Date.now()}`;
}

/**
 * 작품 목록의 필터 조합을 이름 붙여 저장하는 로컬 스마트뷰.
 * Notion 뷰 / Goodreads 셸프 패턴 — 로컬 우선 철학에 맞춰 localStorage에만 둔다.
 */
export function useSavedWorksViews() {
  const [views, setViews] = useState<SavedWorksView[]>(() => readViews());

  const saveView = useCallback((name: string, search: string) => {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    setViews((current) => {
      const next: SavedWorksView[] = [
        ...current.filter((view) => view.name !== trimmed),
        {
          id: createId(),
          name: trimmed,
          search,
          createdAt: new Date().toISOString(),
        },
      ];

      writeViews(next);

      return next;
    });
  }, []);

  const removeView = useCallback((id: string) => {
    setViews((current) => {
      const next = current.filter((view) => view.id !== id);

      writeViews(next);

      return next;
    });
  }, []);

  return { views, saveView, removeView };
}
