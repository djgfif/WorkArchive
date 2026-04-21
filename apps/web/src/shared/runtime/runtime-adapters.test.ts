import { describe, expect, it, vi } from 'vitest';

import {
  createBrowserConfirmDialogAdapter,
} from './dialog-adapter';
import {
  createBrowserLocalStorageAdapter,
  createJsonStorageAdapter,
} from './storage-adapter';

interface DemoValue {
  accessToken: string;
}

function isDemoValue(value: unknown): value is DemoValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accessToken' in value &&
    typeof value.accessToken === 'string'
  );
}

describe('runtime adapters', () => {
  it('reads, writes, and clears JSON values through the storage adapter', () => {
    const storage = createBrowserLocalStorageAdapter(window.localStorage);
    const adapter = createJsonStorageAdapter<DemoValue>({
      key: 'runtime-adapter-test',
      storage,
      validate: isDemoValue,
    });

    adapter.write({
      accessToken: 'token-123',
    });

    expect(adapter.read()).toEqual({
      accessToken: 'token-123',
    });

    adapter.clear();

    expect(adapter.read()).toBeNull();
  });

  it('returns null when a stored JSON value does not match the validator', () => {
    window.localStorage.setItem(
      'runtime-adapter-test',
      JSON.stringify({
        wrong: true,
      }),
    );

    const storage = createBrowserLocalStorageAdapter(window.localStorage);
    const adapter = createJsonStorageAdapter<DemoValue>({
      key: 'runtime-adapter-test',
      storage,
      validate: isDemoValue,
    });

    expect(adapter.read()).toBeNull();
  });

  it('formats confirm dialog messages through the dialog adapter', async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    const adapter = createBrowserConfirmDialogAdapter(confirmSpy);

    await expect(
      adapter.confirm({
        description: '현재는 목록에서 숨겨집니다.',
        title: '"Frieren"을 삭제할까요?',
      }),
    ).resolves.toBe(true);

    expect(confirmSpy).toHaveBeenCalledWith(
      '"Frieren"을 삭제할까요?\n현재는 목록에서 숨겨집니다.',
    );
  });
});
