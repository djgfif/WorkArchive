import { Avatar, Group, Paper, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CommunityProfileView, UpdateCommunityProfileRequest } from '@work-archive/shared-types';

import { AppButton, FeedbackMessage, LoadingState, PageShell, StateMessage } from '@shared/components/AppPrimitives';
import { useAuthSession } from '@features/auth';
import { getDisplayImageUrl } from '@shared/utils/image-proxy';
import { useAppTranslation } from '@app/i18n';
import { fetchCommunityProfile, setCommunityFollow, updateCommunityProfile } from '../services/community.api';
import { CommunityFeedCard } from './CommunityPage';
import styles from './CommunityProfilePage.module.css';

type FeedbackState = { message: string; tone: 'error' | 'success' };

export function CommunityProfilePage() {
  const { t } = useAppTranslation();
  const { handle = '' } = useParams();
  const { mode } = useAuthSession();
  const [profile, setProfile] = useState<CommunityProfileView | null>(null);
  const [draft, setDraft] = useState<UpdateCommunityProfileRequest | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

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
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : t('community.social.profile.loadError'), tone: 'error' }); }
    finally { setLoading(false); }
  }, [handle, t]);
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
      setProfile(saved); setEditing(false); setFeedback({ message: t('community.social.profile.saveSuccess'), tone: 'success' });
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : t('community.social.profile.saveError'), tone: 'error' }); }
  }
  async function setBrowserNotifications(enabled: boolean) {
    if (!draft) return;
    if (enabled && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setFeedback({ message: t('community.social.profile.permissionError'), tone: 'error' }); return; }
    }
    setDraft({ ...draft, notifications: { ...draft.notifications, browser: enabled } });
  }

  if (loading) return <PageShell size={1050}><LoadingState rows={5} title={t('community.social.profile.loading')} /></PageShell>;
  if (!profile || !draft) return <PageShell size={1050}><StateMessage description={feedback?.message ?? t('community.social.profile.missingDescription')} title={t('community.social.profile.missingTitle')} tone="error" /></PageShell>;
  const avatar = getDisplayImageUrl(profile.author.avatarUrl);

  return (
    <PageShell size={1050}>
      <Paper className={styles.header ?? ''} p="xl" radius="lg" withBorder>
        <Group align="flex-start" justify="space-between">
          <Group align="center"><Avatar radius="xl" size={84} src={avatar || null}>{profile.author.displayName.slice(0, 1)}</Avatar><div><Text fw={900} size="xl">{profile.author.displayName}</Text><Text c="dimmed">@{profile.author.handle}</Text><Text c="dimmed" mt="xs" size="sm">{profile.isPrivate ? t('community.social.profile.private') : t('community.social.profile.public')}</Text></div></Group>
          <Group>{profile.viewerCanEdit && <AppButton onClick={() => setEditing((value) => !value)} tone="secondary">{editing ? t('community.social.profile.closeEdit') : t('community.social.profile.settings')}</AppButton>}{profile.viewerCanFollow && <AppButton onClick={() => void toggleFollow()} tone={profile.viewerIsFollowing ? 'secondary' : 'primary'}>{profile.viewerIsFollowing ? t('community.social.profile.following') : t('community.social.profile.follow')}</AppButton>}<button className={styles.share} onClick={() => void navigator.clipboard.writeText(window.location.href)} type="button">{t('community.social.profile.share')}</button></Group>
        </Group>
        {profile.bio && <Text className={styles.bio ?? ''}>{profile.bio}</Text>}
        <Group gap="xl"><Text><b>{profile.followerCount ?? '—'}</b> {t('community.social.profile.followers')}</Text><Text><b>{profile.followingCount ?? '—'}</b> {t('community.social.profile.following')}</Text></Group>
      </Paper>

      {feedback && <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage>}

      {editing && profile.viewerCanEdit && (
        <Paper className={styles.settings ?? ''} p="xl" radius="lg" withBorder>
          <Stack gap="lg">
            <div><Text fw={850}>{t('community.social.profile.settingsTitle')}</Text><Text c="dimmed" size="sm">{t('community.social.profile.settingsDescription')}</Text></div>
            <Switch checked={draft.visibility === 'public'} label={t('community.social.profile.publicProfile')} onChange={(event) => setDraft({ ...draft, visibility: event.currentTarget.checked ? 'public' : 'private' })} />
            <Switch checked={draft.allowFollowers} label={t('community.social.profile.allowFollowers')} onChange={(event) => setDraft({ ...draft, allowFollowers: event.currentTarget.checked })} />
            <Textarea autosize label={t('community.social.profile.bio')} maxLength={500} minRows={3} onChange={(event) => setDraft({ ...draft, bio: event.currentTarget.value })} value={draft.bio} />
            <div className={styles.switchGrid}>
              {([['showTasteSummary', t('community.social.profile.sections.taste')], ['showRatings', t('community.social.profile.sections.ratings')], ['showReviews', t('community.social.profile.sections.reviews')], ['showBoardPosts', t('community.social.profile.sections.posts')], ['showFollowers', t('community.social.profile.sections.followers')]] as const).map(([key, label]) => <Switch checked={draft.sections[key]} key={key} label={label} onChange={(event) => setDraft({ ...draft, sections: { ...draft.sections, [key]: event.currentTarget.checked } })} />)}
            </div>
            <Text fw={800}>{t('community.social.profile.notifications')}</Text>
            <Switch checked={draft.notifications.inCommunity} label={t('community.social.profile.inCommunity')} onChange={(event) => setDraft({ ...draft, notifications: { ...draft.notifications, inCommunity: event.currentTarget.checked } })} />
            <Switch checked={draft.notifications.globalBadge} label={t('community.social.profile.globalBadge')} onChange={(event) => setDraft({ ...draft, notifications: { ...draft.notifications, globalBadge: event.currentTarget.checked } })} />
            <Switch checked={draft.notifications.browser} label={t('community.social.profile.browser')} onChange={(event) => void setBrowserNotifications(event.currentTarget.checked)} />
            <Group justify="flex-end"><AppButton onClick={() => void save()} tone="primary">{t('community.social.profile.save')}</AppButton></Group>
          </Stack>
        </Paper>
      )}

      {profile.isPrivate && !profile.viewerCanEdit ? <StateMessage description={t('community.social.profile.privateDescription')} title={t('community.social.profile.privateTitle')} /> : (
        <div className={styles.content}>
          {profile.sections.showTasteSummary && <Paper p="lg" radius="lg" withBorder><Text fw={850}>{t('community.social.profile.tasteSummary')}</Text><Group gap="xs" mt="md">{profile.favoriteGenres.map((genre) => <span className={styles.tag} key={genre}>{genre}</span>)}</Group>{!profile.favoriteGenres.length && <Text c="dimmed" mt="sm" size="sm">{t('community.social.profile.noGenres')}</Text>}</Paper>}
          {profile.sections.showReviews && <section><Text fw={850} mb="md" size="lg">{t('community.social.profile.recentReviews')}</Text><Stack gap="md">{profile.recentReviews.map((review) => <CommunityFeedCard item={{ createdAt: review.createdAt, id: `review:${review.id}`, kind: 'review', post: null, review }} key={review.id} />)}</Stack></section>}
          {profile.sections.showBoardPosts && <section><Text fw={850} mb="md" size="lg">{t('community.social.profile.recentPosts')}</Text><Stack gap="sm">{profile.recentPosts.map((post) => <Link className={styles.post} key={post.id} to={`/community/posts/${post.id}`}>{post.body}</Link>)}</Stack></section>}
        </div>
      )}
      {mode !== 'authenticated' && <Text c="dimmed" mt="xl" size="sm">{t('community.social.profile.guestNote')}</Text>}
    </PageShell>
  );
}
