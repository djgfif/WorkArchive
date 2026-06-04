import { useEffect } from 'react';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;

  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

function collectWorkLinks() {
  return Array.from(
    document.querySelectorAll<HTMLAnchorElement>('main a[href*="/works/"]'),
  ).filter((anchor) => {
    const href = anchor.getAttribute('href') ?? '';

    // /works/<id> 상세 링크만 — /works/new, /works/<id>/edit 등은 제외.
    return /\/works\/[^/]+$/.test(href) && !href.endsWith('/works/new');
  });
}

/**
 * 목록·선반의 작품 링크를 j/k 로 순회하는 가벼운 로빙 포커스 (Linear/Gmail 패턴).
 * 카드 컴포넌트를 건드리지 않고 DOM 셀렉터로만 동작한다.
 */
export function useWorkLinkKeyboardNav() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key !== 'j' && event.key !== 'k') {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const links = collectWorkLinks();

      if (links.length === 0) {
        return;
      }

      event.preventDefault();

      const currentIndex = links.indexOf(
        document.activeElement as HTMLAnchorElement,
      );
      const nextIndex =
        event.key === 'j'
          ? Math.min(links.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1);

      const next = links[nextIndex];

      if (next) {
        next.focus();
        next.scrollIntoView({ block: 'nearest' });
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
