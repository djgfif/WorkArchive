import { useRouteError } from 'react-router-dom';
import { useEffect } from 'react';

import { AppButton, AppLinkButton, StateMessage } from './AppPrimitives';

interface RouteErrorBoundaryProps {
  fallbackPath: string;
  fallbackLabel: string;
  title: string;
}

export function getRouteErrorDescription(
  error: unknown,
  isDevelopment = import.meta.env.DEV,
) {
  if (isDevelopment && error instanceof Error && error.message.trim()) {
    return `화면을 다시 그리는 중 오류가 발생했습니다. ${error.message}`;
  }

  return '화면을 다시 그리는 중 오류가 발생했습니다.';
}

export function RouteErrorBoundary({
  fallbackLabel,
  fallbackPath,
  title,
}: RouteErrorBoundaryProps) {
  const error = useRouteError();

  useEffect(() => {
    console.error(
      'Route error boundary caught an unrecoverable route error.',
      error,
    );
  }, [error]);

  return (
    <StateMessage
      actions={
        <>
          <AppButton onClick={() => window.location.reload()} tone="primary">
            다시 시도
          </AppButton>
          <AppLinkButton to={fallbackPath} tone="quiet">
            {fallbackLabel}
          </AppLinkButton>
        </>
      }
      description={`${getRouteErrorDescription(error)} 로컬 IndexedDB 데이터는 이 오류만으로 삭제되지 않습니다. 필요한 경우 설정의 JSON export로 현재 로컬 데이터를 먼저 보관한 뒤 다시 시도하세요.`}
      eyebrow="화면 오류"
      title={title}
      tone="error"
    />
  );
}
