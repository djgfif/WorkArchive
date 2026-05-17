import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '../../../shared/services/api-client';
import { getAuthSubmitErrorMessage } from './auth-error-message';

describe('getAuthSubmitErrorMessage', () => {
  it('turns login credential failures into an actionable message', () => {
    expect(
      getAuthSubmitErrorMessage(
        new ApiRequestError(401, '이메일 또는 비밀번호를 확인해주세요.'),
        'login',
      ),
    ).toBe(
      '이메일 또는 비밀번호가 맞지 않습니다. 입력한 정보를 다시 확인해주세요.',
    );
  });

  it('separates network and server failures from field errors', () => {
    expect(
      getAuthSubmitErrorMessage(
        new ApiRequestError(0, '네트워크 연결을 확인한 뒤 다시 시도해주세요.'),
        'login',
      ),
    ).toBe('네트워크 연결을 확인한 뒤 다시 로그인해주세요.');

    expect(
      getAuthSubmitErrorMessage(
        new ApiRequestError(503, '서버 오류가 발생했습니다.'),
        'password-reset-request',
      ),
    ).toBe(
      '계정 복구 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.',
    );
  });

  it('gives password reset link failures a recovery path', () => {
    expect(
      getAuthSubmitErrorMessage(
        new ApiRequestError(404, '요청한 정보를 찾을 수 없습니다.'),
        'password-reset-confirm',
      ),
    ).toBe(
      '복구 링크가 올바르지 않거나 만료되었습니다. 재설정 링크를 다시 요청해주세요.',
    );
  });
});
