export function getRouteErrorDescription(
  error: unknown,
  isDevelopment = import.meta.env.DEV,
) {
  if (isDevelopment && error instanceof Error && error.message.trim()) {
    return `화면을 다시 그리는 중 오류가 발생했습니다. ${error.message}`;
  }

  return '화면을 다시 그리는 중 오류가 발생했습니다.';
}
