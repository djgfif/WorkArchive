import { useEffect } from 'react';

import { appI18n } from '@app/i18n';

const UNSAVED_CHANGES_MESSAGE = appI18n.t('works.errors.unsavedChanges');

function isPlainLeftClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

export function useUnsavedChangesWarning(
  shouldWarn: boolean,
  message = UNSAVED_CHANGES_MESSAGE,
) {
  useEffect(() => {
    if (!shouldWarn) {
      return undefined;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = message;

      return message;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [message, shouldWarn]);

  useEffect(() => {
    if (!shouldWarn) {
      return undefined;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!isPlainLeftClick(event) || event.defaultPrevented) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);

      if (
        nextUrl.origin !== window.location.origin ||
        nextUrl.href === window.location.href
      ) {
        return;
      }

      if (window.confirm(message)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [message, shouldWarn]);
}
