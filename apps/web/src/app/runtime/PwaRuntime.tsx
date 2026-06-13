import { Group, Paper, Stack, Text } from '@mantine/core';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { AppButton } from '@shared/components/AppPrimitives';
import { useAppTranslation } from '@app/i18n';
import { cn } from '@shared/utils/class-names';
import styles from './PwaRuntime.module.css';

const css = styles;

export function PwaRuntime() {
  const { t } = useAppTranslation();
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

  const title = needRefresh ? t('pwa.refreshTitle') : t('pwa.offlineTitle');
  const description = needRefresh
    ? t('pwa.refreshDescription')
    : t('pwa.offlineDescription');

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
                {t('pwa.refreshAction')}
              </AppButton>
              <AppButton
                onClick={() => setNeedRefresh(false)}
                size="compact-sm"
                tone="quiet"
                type="button"
              >
                {t('pwa.later')}
              </AppButton>
            </>
          ) : (
            <AppButton
              onClick={() => setOfflineReady(false)}
              size="compact-sm"
              tone="quiet"
              type="button"
            >
              {t('pwa.confirm')}
            </AppButton>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
