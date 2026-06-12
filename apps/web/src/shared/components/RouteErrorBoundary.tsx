import { useRouteError } from 'react-router-dom';
import { useEffect } from 'react';

import { AppButton, AppLinkButton, StateMessage } from './AppPrimitives';
import { getRouteErrorDescription } from './route-error-description';

interface RouteErrorBoundaryProps {
  fallbackPath: string;
  fallbackLabel: string;
  title: string;
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
      description={`${getRouteErrorDescription(error)} 이 기기에 저장된 기록은 이 오류만으로 삭제되지 않습니다. 필요한 경우 설정의 JSON 내보내기로 현재 기록을 먼저 보관한 뒤 다시 시도하세요.`}
      eyebrow="화면 오류"
      title={title}
      tone="error"
    />
  );
}
