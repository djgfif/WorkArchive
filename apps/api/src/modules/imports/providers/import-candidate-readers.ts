export type UnknownRecord = Record<string, unknown>;

export function readString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return '';
}

export function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => readString(entry)).filter(Boolean)
    : [];
}

export function readPathArray(value: unknown, path: string[]) {
  const resolved = readPath(value, path);

  return Array.isArray(resolved) ? resolved : [];
}

export function readPathNumber(value: unknown, path: string[]) {
  return readNumber(readPath(value, path));
}

export function readPath(value: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    return isRecord(current) ? current[key] : undefined;
  }, value);
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
