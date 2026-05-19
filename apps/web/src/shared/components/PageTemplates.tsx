import type { ReactNode } from 'react';
import { Box, Divider, Group, Stack, Text, Title } from '@mantine/core';

import {
  ActionRow,
  PageShell,
  SectionCard,
} from './AppPrimitives';
import { PageHero } from './PageHero';

interface PageFrameProps {
  children: ReactNode;
}

export function HomeLandingTemplate({ children }: PageFrameProps) {
  return <PageShell gap="var(--app-space-section)" size={1280}>{children}</PageShell>;
}

export function LibraryTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1320}>{children}</PageShell>;
}

export function WorkDetailTemplate({ children }: PageFrameProps) {
  return <PageShell gap="var(--app-space-section)" size={1180}>{children}</PageShell>;
}

export function FormFlowTemplate({ children }: PageFrameProps) {
  return <PageShell gap="xl" size={1160}>{children}</PageShell>;
}

export function AccountSettingsTemplate({ children }: PageFrameProps) {
  return <PageShell gap="lg" size={1120}>{children}</PageShell>;
}

export const HomeHubPageTemplate = HomeLandingTemplate;
export const WorkspacePageTemplate = LibraryTemplate;
export const DetailPageTemplate = WorkDetailTemplate;
export const FlowPageTemplate = FormFlowTemplate;

/* ── 브랜드 패널 특징 아이템 ── */
const AUTH_BRAND_FEATURES = [
  {
    icon: (
      <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={15}>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Local-first',
    description: '모든 기록은 이 기기에 먼저 저장됩니다.',
  },
  {
    icon: (
      <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={15}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
    ),
    title: '자동 백업',
    description: '계정 연결 시 변경 사항이 자동으로 동기화됩니다.',
  },
  {
    icon: (
      <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24" width={15}>
        <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: '개인 기록 전용',
    description: '공개 프로필이나 커뮤니티 피드를 만들지 않습니다.',
  },
] as const;

interface AuthPageTemplateProps {
  description?: string;
  footer?: ReactNode;
  form: ReactNode;
  highlights?: Array<{ description: string; title: string }>;
  eyebrow?: string;
  title: string;
}

export function AuthPageTemplate({
  description,
  footer,
  form,
  eyebrow,
  title,
}: AuthPageTemplateProps) {
  return (
    <Box
      style={{
        minHeight:      'calc(100vh - 64px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        'clamp(1.5rem, 4vw, 3rem) var(--mantine-spacing-md)',
      }}
    >
      <Box
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          maxWidth:            860,
          width:               '100%',
          borderRadius:        'var(--mantine-radius-xl)',
          overflow:            'hidden',
          border:              '1px solid var(--app-border-default)',
          boxShadow:           '0 24px 64px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
        {/* ── 좌측: 브랜드 패널 ── */}
        <Box
          style={{
            background:    'linear-gradient(155deg, #3b82f6 0%, #1d4ed8 55%, #1e1b4b 100%)',
            padding:       'clamp(2rem, 5vw, 3rem)',
            display:       'flex',
            flexDirection: 'column',
            gap:           '2rem',
            position:      'relative',
            overflow:      'hidden',
          }}
        >
          {/* 배경 장식 원 */}
          <Box
            style={{
              position:     'absolute',
              top:          '-80px',
              right:        '-80px',
              width:        220,
              height:       220,
              borderRadius: '50%',
              background:   'rgba(255,255,255,0.07)',
              pointerEvents:'none',
            }}
          />
          <Box
            style={{
              position:     'absolute',
              bottom:       '-50px',
              left:         '-50px',
              width:        180,
              height:       180,
              borderRadius: '50%',
              background:   'rgba(255,255,255,0.04)',
              pointerEvents:'none',
            }}
          />

          {/* 브랜드 로고 */}
          <Group gap="sm" wrap="nowrap" style={{ position: 'relative', zIndex: 1 }}>
            <Box
              style={{
                width:         38,
                height:        38,
                borderRadius:  10,
                background:    'rgba(255,255,255,0.18)',
                backdropFilter:'blur(4px)',
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                fontWeight:    900,
                fontSize:      '0.88rem',
                color:         '#fff',
                letterSpacing: '-0.02em',
                flexShrink:    0,
                border:        '1px solid rgba(255,255,255,0.25)',
              }}
            >
              WA
            </Box>
            <Stack gap={0}>
              <Text fw={800} size="sm" style={{ color: '#fff', letterSpacing: '-0.01em' }}>
                Work Archive
              </Text>
              <Text size="xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                개인 감상 서재
              </Text>
            </Stack>
          </Group>

          {/* 슬로건 */}
          <Stack gap="sm" style={{ position: 'relative', zIndex: 1 }}>
            <Title
              order={2}
              style={{
                color:         '#fff',
                fontWeight:    800,
                fontSize:      'clamp(1.35rem, 3vw, 1.85rem)',
                lineHeight:    1.25,
                letterSpacing: '-0.025em',
              }}
            >
              감상한 모든 작품을,<br />한 곳에서 기록하세요.
            </Title>
            <Text
              size="sm"
              style={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.65 }}
            >
              소설·애니·만화·드라마·영화 —<br />
              장르 불문, 나만의 아카이브를 만들어 보세요.
            </Text>
          </Stack>

          {/* 특징 목록 */}
          <Stack gap="md" style={{ position: 'relative', zIndex: 1 }}>
            {AUTH_BRAND_FEATURES.map((feature) => (
              <Group key={feature.title} gap="sm" wrap="nowrap" align="flex-start">
                <Box
                  style={{
                    width:         30,
                    height:        30,
                    borderRadius:  8,
                    background:    'rgba(255,255,255,0.14)',
                    border:        '1px solid rgba(255,255,255,0.18)',
                    display:       'flex',
                    alignItems:    'center',
                    justifyContent:'center',
                    color:         '#fff',
                    flexShrink:    0,
                    marginTop:     2,
                  }}
                >
                  {feature.icon}
                </Box>
                <Stack gap={1}>
                  <Text fw={700} size="sm" style={{ color: '#fff' }}>
                    {feature.title}
                  </Text>
                  <Text size="xs" style={{ color: 'rgba(255,255,255,0.62)', lineHeight: 1.5 }}>
                    {feature.description}
                  </Text>
                </Stack>
              </Group>
            ))}
          </Stack>
        </Box>

        {/* ── 우측: 폼 패널 ── */}
        <Box
          style={{
            background:    'var(--app-surface-card)',
            padding:       'clamp(2rem, 5vw, 3rem)',
            display:       'flex',
            flexDirection: 'column',
            justifyContent:'center',
            gap:           '1.5rem',
          }}
        >
          {/* 폼 헤더 */}
          <Stack gap={6}>
            {eyebrow && (
              <Text
                size="xs"
                fw={700}
                style={{
                  color:         'var(--app-accent-primary)',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                }}
              >
                {eyebrow}
              </Text>
            )}
            <Title
              order={1}
              style={{
                fontSize:      'clamp(1.4rem, 3vw, 1.75rem)',
                fontWeight:    800,
                letterSpacing: '-0.025em',
                color:         'var(--app-text-primary)',
              }}
            >
              {title}
            </Title>
            {description && (
              <Text size="sm" c="dimmed" style={{ lineHeight: 1.65 }}>
                {description}
              </Text>
            )}
          </Stack>

          <Divider color="var(--app-border-subtle)" />

          {/* 폼 */}
          {form}

          {/* 푸터 링크 */}
          {footer && (
            <Box
              style={{
                paddingTop: '0.75rem',
                borderTop:  '1px solid var(--app-border-subtle)',
              }}
            >
              {footer}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

interface AccountPageTemplateProps {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  meta?: ReactNode;
  title: string;
}

export function AccountPageTemplate({
  actions,
  children,
  description,
  eyebrow,
  meta,
  title,
}: AccountPageTemplateProps) {
  return (
    <AccountSettingsTemplate>
      <PageHero
        actions={actions}
        description={description}
        eyebrow={eyebrow}
        meta={meta}
        title={title}
        titleAs="h1"
      />
      {children}
    </AccountSettingsTemplate>
  );
}

interface MinimalPageTemplateProps {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}

export function MinimalPageTemplate({
  actions,
  description,
  eyebrow,
  title,
}: MinimalPageTemplateProps) {
  return (
    <PageShell gap="lg" size={760}>
      <SectionCard padding="xl" tone="hero">
        <Text c="archive.2" fw={800} size="xs" tt="uppercase">
          {eyebrow}
        </Text>
        <Title order={1}>{title}</Title>
        <Text c="dimmed" maw="58ch">{description}</Text>
        {actions && <ActionRow>{actions}</ActionRow>}
      </SectionCard>
    </PageShell>
  );
}
