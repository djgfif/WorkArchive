function getGenericRequestErrorMessage(status: number) {
  if (status === 400) {
    return '입력한 내용을 다시 확인해주세요.';
  }

  if (status === 401) {
    return '로그인 상태가 만료되었습니다. 다시 로그인해주세요.';
  }

  if (status === 404) {
    return '요청한 정보를 찾을 수 없습니다.';
  }

  if (status === 409) {
    return '이미 처리된 요청이거나 충돌이 발생했습니다.';
  }

  if (status >= 500) {
    return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }

  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

export function localizeServerMessage(
  message: string,
  fallback = '요청을 처리하지 못했습니다.',
) {
  const normalized = message.trim();

  if (!normalized) {
    return fallback;
  }

  if (!/[A-Za-z]/.test(normalized)) {
    return normalized;
  }

  const conflictMatch = normalized.match(
    /^Conflict: server version (\d+) updated at (.+) won\.$/,
  );

  if (conflictMatch) {
    return '다른 곳에서 더 최근 변경이 반영되어 충돌이 발생했습니다. 내용을 확인한 뒤 다시 시도해주세요.';
  }

  if (/^Work with id ".+" was not found\.$/.test(normalized)) {
    return '작품을 찾을 수 없습니다.';
  }

  if (/must be an email/i.test(normalized)) {
    return '이메일 형식을 확인해주세요.';
  }

  if (/must be longer than or equal to 8 characters/i.test(normalized)) {
    return '비밀번호는 8자 이상 입력해주세요.';
  }

  if (/title must not be empty/i.test(normalized)) {
    return '제목을 입력해주세요.';
  }

  if (/rating must be a valid number/i.test(normalized)) {
    return '별점 형식을 확인해주세요.';
  }

  switch (normalized) {
    case 'The server returned an empty JSON response.':
      return '서버 응답을 확인할 수 없습니다.';
    case 'Missing Bearer access token.':
    case 'Malformed Bearer access token.':
    case 'Invalid or expired token.':
    case 'Invalid or expired refresh token.':
    case 'Session is no longer valid.':
      return '로그인 정보가 만료되었습니다. 다시 로그인해주세요.';
    case 'An account with this email already exists.':
      return '이미 가입된 이메일입니다.';
    case 'Invalid email or password.':
      return '이메일 또는 비밀번호를 확인해주세요.';
    case 'Queued record created on the server.':
      return '서버에 작품이 저장되었습니다.';
    case 'Queued change applied on the server.':
      return '서버에 변경 사항이 반영되었습니다.';
    case 'Queued tombstone applied on the server.':
      return '서버에 삭제 상태가 반영되었습니다.';
    case 'Remote record already matches the queued change.':
      return '서버에 이미 같은 변경이 반영되어 있습니다.';
    case 'Remote delete was a no-op because the server record is missing.':
      return '서버에 해당 작품이 없어 삭제 요청을 건너뛰었습니다.';
    case 'Server mismatch: the record cannot be modified remotely.':
      return '서버 상태가 달라 변경 사항을 반영하지 못했습니다.';
    case 'Server mismatch: the record does not exist remotely anymore.':
      return '서버에 해당 작품이 없어 충돌이 발생했습니다.';
    case 'Server mismatch: the record was already missing remotely when a previously synced delete was pushed.':
      return '이미 서버에서 삭제된 작품이라 충돌이 발생했습니다.';
    case 'Sync server is unavailable.':
      return '동기화 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
    default:
      return fallback;
  }
}

export function localizeApiErrorMessage(
  status: number,
  message?: string | null,
) {
  if (message) {
    return localizeServerMessage(message, getGenericRequestErrorMessage(status));
  }

  return getGenericRequestErrorMessage(status);
}
