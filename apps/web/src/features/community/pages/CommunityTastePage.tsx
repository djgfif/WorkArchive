import { Avatar, Group, Paper, Progress, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CommunityTasteMatchView } from '@work-archive/shared-types';

import { AppButton, AppLinkButton, LoadingState, PageHeader, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { worksRepository } from '@features/works';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';
import { useAppTranslation } from '@app/i18n';
import { fetchCommunityTasteCandidates, setCommunityFollow } from '../services/community.api';
import { buildLocalTasteFingerprint, rankTasteCandidates } from '../services/taste-match';
import styles from './CommunityTastePage.module.css';

export function CommunityTastePage() {
  const { t } = useAppTranslation();
  const { mode, user } = useAuthSession();
  const [matches, setMatches] = useState<CommunityTasteMatchView[]>([]);
  const [loading, setLoading] = useState(mode === 'authenticated');
  const [error, setError] = useState<string | null>(null);
  usePageTitle(t('community.social.taste.pageTitle'));

  useEffect(() => {
    if (mode !== 'authenticated' || !user?.handle) return;
    void Promise.all([worksRepository.listActive(), fetchCommunityTasteCandidates()])
      .then(([works, candidates]) => {
        const localFingerprint = buildLocalTasteFingerprint(works);
        setMatches(rankTasteCandidates(localFingerprint, candidates));
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : t('community.social.taste.error')))
      .finally(() => setLoading(false));
  }, [mode, t, user?.handle]);

  if (mode !== 'authenticated') return <PageShell size={980}><PageHeader description={t('community.social.taste.privacyDescription')} eyebrow="PRIVATE TASTE MATCH" title={t('community.social.taste.pageTitle')} titleOrder={1} /><StateMessage actions={<AppLinkButton state={{ returnTo: '/community/taste' }} to="/auth/login" tone="primary">{t('community.social.taste.login')}</AppLinkButton>} description={t('community.social.taste.loginDescription')} title={t('community.social.taste.loginTitle')} /></PageShell>;
  if (!user?.handle) return <PageShell size={980}><PageHeader description={t('community.social.taste.privacyDescription')} eyebrow="PRIVATE TASTE MATCH" title={t('community.social.taste.pageTitle')} titleOrder={1} /><StateMessage actions={<AppLinkButton to="/account/settings" tone="primary">{t('community.social.taste.handleAction')}</AppLinkButton>} description={t('community.social.taste.handleDescription')} title={t('community.social.taste.handleTitle')} /></PageShell>;
  return (
    <PageShell size={980}>
      <PageHeader description={t('community.social.taste.pageDescription')} eyebrow="PRIVATE TASTE MATCH" title={t('community.social.taste.pageTitle')} titleOrder={1} />
      <Paper className={styles.formula ?? ''} p="lg" radius="lg" withBorder><Text fw={800}>{t('community.social.taste.formulaTitle')}</Text><Text c="dimmed" mt="xs" size="sm">{t('community.social.taste.formula')}</Text></Paper>
      {loading ? <LoadingState rows={5} title={t('community.social.taste.loading')} /> : error ? <StateMessage description={error} title={t('community.social.taste.error')} tone="error" /> : matches.length ? (
        <Stack gap="md">{matches.map((match) => <Paper key={match.author.handle} p="lg" radius="lg" withBorder><Group align="center" justify="space-between"><Link className={styles.author} to={`/u/${match.author.handle}`}><Avatar radius="xl" size={52} src={getDisplayImageUrl(match.author.avatarUrl) || null}>{match.author.displayName.slice(0, 1)}</Avatar><span><Text fw={850}>{match.author.displayName}</Text><Text c="dimmed" size="sm">@{match.author.handle}</Text></span></Link><Text className={styles.score ?? ''}>{match.score}%</Text></Group><Progress color="indigo" mt="md" size="sm" value={match.score} /><Group gap="xs" mt="md">{match.reasons.map((reason) => <span className={styles.reason} key={reason}>{reason}</span>)}</Group><Group justify="flex-end" mt="md"><AppButton onClick={() => match.author.handle && void setCommunityFollow(match.author.handle, false)} tone="primary">{t('community.social.profile.follow')}</AppButton></Group></Paper>)}</Stack>
      ) : <StateMessage description={t('community.social.taste.emptyDescription')} title={t('community.social.taste.emptyTitle')} />}
    </PageShell>
  );
}
