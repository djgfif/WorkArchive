import { Avatar, Group, Paper, Progress, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CommunityTasteMatchView } from '@work-archive/shared-types';

import { AppButton, AppLinkButton, LoadingState, PageHeader, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { worksRepository } from '@features/works';
import { usePageTitle } from '@shared/hooks/usePageTitle';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';
import { fetchCommunityTasteCandidates, setCommunityFollow } from '../services/community.api';
import { buildLocalTasteFingerprint, rankTasteCandidates } from '../services/taste-match';
import styles from './CommunityTastePage.module.css';

export function CommunityTastePage() {
  const { mode, user } = useAuthSession();
  const [matches, setMatches] = useState<CommunityTasteMatchView[]>([]);
  const [loading, setLoading] = useState(mode === 'authenticated');
  const [error, setError] = useState<string | null>(null);
  usePageTitle('취향 찾기');

  useEffect(() => {
    if (mode !== 'authenticated' || !user?.handle) return;
    void Promise.all([worksRepository.listActive(), fetchCommunityTasteCandidates()])
      .then(([works, candidates]) => {
        const localFingerprint = buildLocalTasteFingerprint(works);
        setMatches(rankTasteCandidates(localFingerprint, candidates));
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : '취향을 비교하지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [mode, user?.handle]);

  if (mode !== 'authenticated') return <PageShell size={980}><PageHeader description="개인 기록은 브라우저 안에서만 비교되며 서버로 전송되지 않습니다." eyebrow="PRIVATE TASTE MATCH" title="취향 찾기" titleOrder={1} /><StateMessage actions={<AppLinkButton state={{ returnTo: '/community/taste' }} to="/auth/login" tone="primary">로그인</AppLinkButton>} description="로그인한 뒤 공개 취향 후보와 내 기록을 브라우저에서 비교할 수 있습니다." title="로그인이 필요합니다" /></PageShell>;
  if (!user?.handle) return <PageShell size={980}><PageHeader description="개인 기록은 브라우저 안에서만 비교되며 서버로 전송되지 않습니다." eyebrow="PRIVATE TASTE MATCH" title="취향 찾기" titleOrder={1} /><StateMessage actions={<AppLinkButton to="/account/settings" tone="primary">핸들 만들기</AppLinkButton>} description="고유 핸들을 만든 뒤 공개 취향 후보와 내 기록을 비교할 수 있습니다." title="핸들을 만들면 시작할 수 있어요" /></PageShell>;
  return (
    <PageShell size={980}>
      <PageHeader description="내 IndexedDB 기록으로 브라우저에서만 계산하고, 서버에는 로컬 벡터나 작품 기록을 보내지 않습니다." eyebrow="PRIVATE TASTE MATCH" title="취향 찾기" titleOrder={1} />
      <Paper className={styles.formula ?? ''} p="lg" radius="lg" withBorder><Text fw={800}>결정적 유사도 공식</Text><Text c="dimmed" mt="xs" size="sm">장르 35% · 공통 작품 평가 25% · 작품 유형 20% · 태그 20%</Text></Paper>
      {loading ? <LoadingState rows={5} title="브라우저에서 취향을 비교하는 중" /> : error ? <StateMessage description={error} title="취향을 비교하지 못했습니다" tone="error" /> : matches.length ? (
        <Stack gap="md">{matches.map((match) => <Paper key={match.author.handle} p="lg" radius="lg" withBorder><Group align="center" justify="space-between"><Link className={styles.author} to={`/u/${match.author.handle}`}><Avatar radius="xl" size={52} src={getDisplayImageUrl(match.author.avatarUrl) || null}>{match.author.displayName.slice(0, 1)}</Avatar><span><Text fw={850}>{match.author.displayName}</Text><Text c="dimmed" size="sm">@{match.author.handle}</Text></span></Link><Text className={styles.score ?? ''}>{match.score}%</Text></Group><Progress color="indigo" mt="md" size="sm" value={match.score} /><Group gap="xs" mt="md">{match.reasons.map((reason) => <span className={styles.reason} key={reason}>{reason}</span>)}</Group><Group justify="flex-end" mt="md"><AppButton onClick={() => match.author.handle && void setCommunityFollow(match.author.handle, false)} tone="primary">팔로우</AppButton></Group></Paper>)}</Stack>
      ) : <StateMessage description="공개 취향을 허용한 다른 프로필이 생기면 여기에서 유사도와 근거를 확인할 수 있습니다." title="아직 비교할 공개 프로필이 없습니다" />}
    </PageShell>
  );
}
