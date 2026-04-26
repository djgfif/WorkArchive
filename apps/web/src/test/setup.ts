import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { resetWorkArchiveStorage } from '../features/works/db/work-archive.db';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }),
    writable: true,
  });
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}

    unobserve() {}

    disconnect() {}
  }

  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
    writable: true,
  });

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
    writable: true,
  });
}

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  await resetWorkArchiveStorage();
});
