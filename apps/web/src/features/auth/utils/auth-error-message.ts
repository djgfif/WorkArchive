import { ApiRequestError } from '../../../shared/services/api-client';

type AuthErrorContext =
  | 'login'
  | 'password-reset-confirm'
  | 'password-reset-request'
  | 'register';

const fallbackMessages: Record<AuthErrorContext, string> = {
  login: '로그인하지 못했습니다. 입력한 정보를 확인해주세요.',
  register: '지금은 회원가입을 완료할 수 없습니다. 잠시 후 다시 시도해주세요.',
  'password-reset-request': '비밀번호 재설정 요청을 처리하지 못했습니다.',
  'password-reset-confirm': '비밀번호를 재설정하지 못했습니다.',
};

function getNetworkMessage(context: AuthErrorContext) {
  if (context === 'password-reset-request' || context === 'password-reset-confirm') {
    return '네트워크 연결을 확인한 뒤 복구 요청을 다시 시도해주세요.';
  }

  return '네트워크 연결을 확인한 뒤 다시 로그인해주세요.';
}

function getServerMessage(context: AuthErrorContext) {
  if (context === 'password-reset-request' || context === 'password-reset-confirm') {
    return '계정 복구 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
  }

  return '인증 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
}

export function getAuthSubmitErrorMessage(
  error: unknown,
  context: AuthErrorContext,
) {
  if (!(error instanceof ApiRequestError)) {
    return fallbackMessages[context];
  }

  if (error.status === 0) {
    return getNetworkMessage(context);
  }

  if (error.status >= 500) {
    return getServerMessage(context);
  }

  if (context === 'login') {
    if (error.status === 400) {
      return '이메일 형식과 비밀번호 길이를 확인해주세요.';
    }

    if (error.status === 401) {
      return '이메일 또는 비밀번호가 맞지 않습니다. 입력한 정보를 다시 확인해주세요.';
    }
  }

  if (context === 'register') {
    if (error.status === 400) {
      return '이메일 형식과 비밀번호 8자 이상 조건을 확인해주세요.';
    }

    if (error.status === 409) {
      return '이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.';
    }
  }

  if (context === 'password-reset-request') {
    if (error.status === 400) {
      return '가입에 사용한 이메일 형식을 확인해주세요.';
    }
  }

  if (context === 'password-reset-confirm') {
    if (error.status === 400 || error.status === 401 || error.status === 404) {
      return '복구 링크가 올바르지 않거나 만료되었습니다. 재설정 링크를 다시 요청해주세요.';
    }
  }

  return error.message || fallbackMessages[context];
}
