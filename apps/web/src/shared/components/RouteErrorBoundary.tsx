import { useRouteError } from 'react-router-dom';

import {
  AppButton,
  AppLinkButton,
  StateMessage,
} from './AppPrimitives';

interface RouteErrorBoundaryProps {
  fallbackPath: string;
  fallbackLabel: string;
  title: string;
}

function getErrorDescription(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
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
      description={`${getErrorDescription(error)} 로컬 IndexedDB 데이터는 이 오류만으로 삭제되지 않습니다. 필요한 경우 설정의 JSON export로 현재 로컬 데이터를 먼저 보관한 뒤 다시 시도하세요.`}
      eyebrow="화면 오류"
      title={title}
      tone="error"
    />
  );
}
