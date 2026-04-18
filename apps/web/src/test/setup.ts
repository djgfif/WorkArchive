import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { resetWorkArchiveStorage } from '../features/works/db/work-archive.db';

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  await resetWorkArchiveStorage();
});
