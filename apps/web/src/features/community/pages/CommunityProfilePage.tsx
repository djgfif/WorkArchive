import { Avatar, Group, Paper, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CommunityProfileView, UpdateCommunityProfileRequest } from '@work-archive/shared-types';

import { AppButton, FeedbackMessage, LoadingState, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';
import { fetchCommunityProfile, setCommunityFollow, updateCommunityProfile } from '../services/community.api';
import { CommunityFeedCard } from './CommunityPage';
import styles from './CommunityProfilePage.module.css';

export function CommunityProfilePage() {
  const { handle = '' } = useParams();
  const { mode } = useAuthSession();
  const [profile, setProfile] = useState<CommunityProfileView | null>(null);
  const [draft, setDraft] = useState<UpdateCommunityProfileRequest | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchCommunityProfile(handle);
      setProfile(next);
      setDraft({
        allowFollowers: next.allowFollowers,
        bio: next.bio,
        favoriteCatalogTitleIds: next.favoriteWorks.map((work) => work.catalogTitleId!).filter(Boolean),
        favoriteGenres: next.favoriteGenres,
        notifications: next.notifications ?? { browser: false, globalBadge: false, inCommunity: true },
        sections: next.sections,
        visibility: next.isPrivate ? 'private' : 'public',
      });
    } catch (error) { setFeedback(error instanceof Error ? error.message : '프로필을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [handle]);
  useEffect(() => void load(), [load]);

  async function toggleFollow() {
    if (!profile) return;
    await setCommunityFollow(handle, profile.viewerIsFollowing);
    setProfile({ ...profile, viewerIsFollowing: !profile.viewerIsFollowing });
  }
  async function save() {
    if (!draft) return;
    try {
      const saved = await updateCommunityProfile(draft);
      setProfile(saved); setEditing(false); setFeedback('공개 프로필 설정을 저장했습니다.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.'); }
  }
  async function setBrowserNotifications(enabled: boolean) {
    if (!draft) return;
    if (enabled && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setFeedback('브라우저 알림 권한이 허용되지 않았습니다.'); return; }
    }
    setDraft({ ...draft, notifications: { ...draft.notifications, browser: enabled } });
  }

  if (loading) return <PageShell size={1050}><LoadingState rows={5} title="프로필을 불러오는 중" /></PageShell>;
  if (!profile || !draft) return <PageShell size={1050}><StateMessage description={feedback ?? '존재하지 않거나 공개되지 않은 프로필입니다.'} title="프로필을 찾을 수 없습니다" tone="error" /></PageShell>;
  const avatar = getDisplayImageUrl(profile.author.avatarUrl);

  return (
    <PageShell size={1050}>
      <Paper className={styles.header ?? ''} p="xl" radius="lg" withBorder>
        <Group align="flex-start" justify="space-between">
          <Group align="center"><Avatar radius="xl" size={84} src={avatar || null}>{profile.author.displayName.slice(0, 1)}</Avatar><div><Text fw={900} size="xl">{profile.author.displayName}</Text><Text c="dimmed">@{profile.author.handle}</Text><Text c="dimmed" mt="xs" size="sm">{profile.isPrivate ? '비공개 프로필' : '공개 프로필'}</Text></div></Group>
          <Group>{profile.viewerCanEdit && <AppButton onClick={() => setEditing((value) => !value)} tone="secondary">{editing ? '편집 닫기' : '공개 설정'}</AppButton>}{profile.viewerCanFollow && <AppButton onClick={() => void toggleFollow()} tone={profile.viewerIsFollowing ? 'secondary' : 'primary'}>{profile.viewerIsFollowing ? '팔로잉' : '팔로우'}</AppButton>}<button className={styles.share} onClick={() => void navigator.clipboard.writeText(window.location.href)} type="button">프로필 공유</button></Group>
        </Group>
        {profile.bio && <Text className={styles.bio ?? ''}>{profile.bio}</Text>}
        <Group gap="xl"><Text><b>{profile.followerCount ?? '—'}</b> 팔로워</Text><Text><b>{profile.followingCount ?? '—'}</b> 팔로잉</Text></Group>
      </Paper>

      {feedback && <FeedbackMessage tone={feedback.includes('못') || feedback.includes('않았') ? 'error' : 'success'}>{feedback}</FeedbackMessage>}

      {editing && profile.viewerCanEdit && (
        <Paper className={styles.settings ?? ''} p="xl" radius="lg" withBorder>
          <Stack gap="lg">
            <div><Text fw={850}>공개 프로필과 알림</Text><Text c="dimmed" size="sm">프로필 기본값은 비공개입니다. 각 항목을 따로 선택할 수 있습니다.</Text></div>
            <Switch checked={draft.visibility === 'public'} label="프로필 전체 공개" onChange={(event) => setDraft({ ...draft, visibility: event.currentTarget.checked ? 'public' : 'private' })} />
            <Switch checked={draft.allowFollowers} label="팔로우 허용" onChange={(event) => setDraft({ ...draft, allowFollowers: event.currentTarget.checked })} />
            <Textarea autosize label="소개" maxLength={500} minRows={3} onChange={(event) => setDraft({ ...draft, bio: event.currentTarget.value })} value={draft.bio} />
            <div className={styles.switchGrid}>
              {([['showTasteSummary', '취향 요약'], ['showRatings', '평가'], ['showReviews', '리뷰'], ['showBoardPosts', '게시글'], ['showFollowers', '팔로우 수']] as const).map(([key, label]) => <Switch checked={draft.sections[key]} key={key} label={label} onChange={(event) => setDraft({ ...draft, sections: { ...draft.sections, [key]: event.currentTarget.checked } })} />)}
            </div>
            <Text fw={800}>커뮤니티 알림</Text>
            <Switch checked={draft.notifications.inCommunity} label="커뮤니티 내부 알림" onChange={(event) => setDraft({ ...draft, notifications: { ...draft.notifications, inCommunity: event.currentTarget.checked } })} />
            <Switch checked={draft.notifications.globalBadge} label="전역 메뉴 배지" onChange={(event) => setDraft({ ...draft, notifications: { ...draft.notifications, globalBadge: event.currentTarget.checked } })} />
            <Switch checked={draft.notifications.browser} label="브라우저 알림" onChange={(event) => void setBrowserNotifications(event.currentTarget.checked)} />
            <Group justify="flex-end"><AppButton onClick={() => void save()} tone="primary">설정 저장</AppButton></Group>
          </Stack>
        </Paper>
      )}

      {profile.isPrivate && !profile.viewerCanEdit ? <StateMessage description="공개한 글과 댓글에서는 닉네임·핸들·아바타만 계속 표시됩니다." title="이 사용자는 취향과 활동 목록을 비공개로 설정했습니다" /> : (
        <div className={styles.content}>
          {profile.sections.showTasteSummary && <Paper p="lg" radius="lg" withBorder><Text fw={850}>취향 요약</Text><Group gap="xs" mt="md">{profile.favoriteGenres.map((genre) => <span className={styles.tag} key={genre}>{genre}</span>)}</Group>{!profile.favoriteGenres.length && <Text c="dimmed" mt="sm" size="sm">아직 공개한 선호 장르가 없습니다.</Text>}</Paper>}
          {profile.sections.showReviews && <section><Text fw={850} mb="md" size="lg">최근 리뷰</Text><Stack gap="md">{profile.recentReviews.map((review) => <CommunityFeedCard item={{ createdAt: review.createdAt, id: `review:${review.id}`, kind: 'review', post: null, review }} key={review.id} />)}</Stack></section>}
          {profile.sections.showBoardPosts && <section><Text fw={850} mb="md" size="lg">최근 게시글</Text><Stack gap="sm">{profile.recentPosts.map((post) => <Link className={styles.post} key={post.id} to={`/community/posts/${post.id}`}>{post.body}</Link>)}</Stack></section>}
        </div>
      )}
      {mode !== 'authenticated' && <Text c="dimmed" mt="xl" size="sm">공개 프로필과 공개 콘텐츠는 로그인 없이 열람할 수 있습니다.</Text>}
    </PageShell>
  );
}
