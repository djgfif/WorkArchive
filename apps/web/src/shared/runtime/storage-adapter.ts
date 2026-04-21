export interface StringStorageAdapter {
  clear(key: string): void;
  isAvailable(): boolean;
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export interface JsonStorageAdapter<TValue> {
  clear(): void;
  read(): TValue | null;
  write(value: TValue): void;
}

interface JsonStorageAdapterOptions<TValue> {
  key: string;
  storage: StringStorageAdapter;
  validate(value: unknown): value is TValue;
}

function getBrowserLocalStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function createBrowserLocalStorageAdapter(
  storage: Storage | null = getBrowserLocalStorage(),
): StringStorageAdapter {
  return {
    clear(key) {
      storage?.removeItem(key);
    },
    isAvailable() {
      return storage !== null;
    },
    read(key) {
      return storage?.getItem(key) ?? null;
    },
    write(key, value) {
      storage?.setItem(key, value);
    },
  };
}

export function createJsonStorageAdapter<TValue>({
  key,
  storage,
  validate,
}: JsonStorageAdapterOptions<TValue>): JsonStorageAdapter<TValue> {
  return {
    clear() {
      storage.clear(key);
    },
    read() {
      if (!storage.isAvailable()) {
        return null;
      }

      const rawValue = storage.read(key);

      if (!rawValue) {
        return null;
      }

      try {
        const parsedValue = JSON.parse(rawValue) as unknown;

        return validate(parsedValue) ? parsedValue : null;
      } catch {
        return null;
      }
    },
    write(value) {
      if (!storage.isAvailable()) {
        return;
      }

      storage.write(key, JSON.stringify(value));
    },
  };
}
