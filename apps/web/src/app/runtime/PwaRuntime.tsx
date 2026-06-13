import { Group, Paper, Stack, Text } from '@mantine/core';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { AppButton } from '@shared/components/AppPrimitives';
import { cn } from '@shared/utils/class-names';
import styles from './PwaRuntime.module.css';

const css = styles;

export function PwaRuntime() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  });

  if (!needRefresh && !offlineReady) {
    return null;
  }

  const title = needRefresh
    ? '새 버전이 준비됐습니다'
    : '오프라인에서도 열 수 있습니다';
  const description = needRefresh
    ? '지금 적용하면 최신 화면으로 다시 열립니다. 기록은 이 기기에 그대로 남아 있습니다.'
    : '앱 기본 화면을 저장했습니다. 인터넷이 끊겨도 이 기기의 기록을 계속 확인하고 수정할 수 있습니다.';

  return (
    <Paper
      aria-live="polite"
      className={cn(css.notice)}
      p="md"
      radius="md"
      role="status"
      withBorder
    >
      <Stack gap="sm">
        <Stack gap={3}>
          <Text className={cn(css.noticeTitle)}>{title}</Text>
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        </Stack>
        <Group className={cn(css.noticeActions)} gap="xs" justify="flex-end">
          {needRefresh ? (
            <>
              <AppButton
                onClick={() => void updateServiceWorker(true)}
                size="compact-sm"
                tone="primary"
                type="button"
              >
                새 버전 적용
              </AppButton>
              <AppButton
                onClick={() => setNeedRefresh(false)}
                size="compact-sm"
                tone="quiet"
                type="button"
              >
                나중에
              </AppButton>
            </>
          ) : (
            <AppButton
              onClick={() => setOfflineReady(false)}
              size="compact-sm"
              tone="quiet"
              type="button"
            >
              확인
            </AppButton>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
