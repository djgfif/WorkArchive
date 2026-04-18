import { Transform } from 'class-transformer';

export function Trim() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

export function NormalizeStringArray() {
  return Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return value;
    }

    const normalized = value
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter((item) => item !== '');

    return Array.from(new Set(normalized));
  });
}
