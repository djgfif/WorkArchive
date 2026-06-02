const REQUEST_ID_MAX_LENGTH = 80;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function normalizeRequestId(value: string | string[] | null | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== 'string') {
    return null;
  }

  const requestId = rawValue.trim();

  if (
    requestId.length === 0 ||
    requestId.length > REQUEST_ID_MAX_LENGTH ||
    !REQUEST_ID_PATTERN.test(requestId)
  ) {
    return null;
  }

  return requestId;
}
