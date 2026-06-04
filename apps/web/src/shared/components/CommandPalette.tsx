import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Kbd,
  Modal,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export const COMMAND_PALETTE_EVENT = 'work-archive:open-command-palette';

interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

/**
 * 전역 ⌘K / Ctrl+K 커맨드 팔레트 — 어디서든 이동·추가·필터·테마 전환.
 * @mantine/spotlight 의존 없이 Modal + 전역 keydown 으로 구현한다.
 */
export function CommandPalette() {
  const [opened, setOpened] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  function close() {
    setOpened(false);
    setQueryText('');
    setActiveIndex(0);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpened((value) => !value);
      }
    }

    function handleOpenEvent() {
      setOpened(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(COMMAND_PALETTE_EVENT, handleOpenEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(COMMAND_PALETTE_EVENT, handleOpenEvent);
    };
  }, []);

  const commands = useMemo<Command[]>(() => {
    const trimmed = queryText.trim();
    const list: Command[] = [
      {
        id: 'add',
        label: '작품 추가',
        hint: '새 기록',
        keywords: 'add new 추가 등록 기록',
        run: () => navigate('/works/new'),
      },
      {
        id: 'home',
        label: '홈으로',
        keywords: 'home 홈',
        run: () => navigate('/'),
      },
      {
        id: 'works',
        label: '작품 서재',
        keywords: 'works library 서재 목록',
        run: () => navigate('/works'),
      },
      {
        id: 'insights',
        label: '인사이트',
        keywords: 'insights stats 통계 분석',
        run: () => navigate('/insights'),
      },
      {
        id: 'tier',
        label: '티어보드',
        keywords: 'tier board 티어',
        run: () => navigate('/tier-boards'),
      },
      {
        id: 'continue',
        label: '이어볼 작품',
        hint: '진행 중',
        keywords: '이어보기 진행 in progress 보는중',
        run: () => navigate('/works?status=in_progress'),
      },
      {
        id: 'completed-serial',
        label: '완결작만 보기',
        keywords: '완결 completed serial 연재',
        run: () => navigate('/works?serial=completed'),
      },
      {
        id: 'favorites',
        label: '즐겨찾기',
        keywords: 'favorite 즐겨찾기 좋아요',
        run: () => navigate('/works?smart=favorites'),
      },
      {
        id: 'unrated',
        label: '평가 안 한 작품',
        keywords: 'unrated 미평가 별점',
        run: () => navigate('/works?sort=rating&dir=asc'),
      },
      {
        id: 'settings',
        label: '설정과 백업',
        keywords: 'settings backup 설정 백업 내보내기',
        run: () => navigate('/account/settings'),
      },
      {
        id: 'theme',
        label: colorScheme === 'dark' ? '라이트 모드로' : '다크 모드로',
        keywords: 'theme dark light 테마 모드',
        run: () => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark'),
      },
    ];

    if (trimmed) {
      list.unshift({
        id: 'search',
        label: `"${trimmed}" 검색`,
        hint: '제목·작가',
        run: () => navigate(`/works?q=${encodeURIComponent(trimmed)}`),
      });
    }

    return list;
  }, [queryText, navigate, colorScheme, setColorScheme]);

  const filtered = useMemo(() => {
    const needle = queryText.trim().toLowerCase();

    if (!needle) {
      return commands;
    }

    return commands.filter(
      (command) =>
        command.id === 'search' ||
        command.label.toLowerCase().includes(needle) ||
        (command.keywords ?? '').toLowerCase().includes(needle),
    );
  }, [commands, queryText]);

  useEffect(() => {
    setActiveIndex(0);
  }, [queryText]);

  function execute(command: Command | undefined) {
    if (!command) {
      return;
    }

    command.run();
    close();
  }

  return (
    <Modal
      onClose={close}
      opened={opened}
      padding={0}
      radius="lg"
      size="lg"
      withCloseButton={false}
      yOffset="12vh"
    >
      <Box p="sm">
        <TextInput
          aria-label="명령 검색"
          data-autofocus
          onChange={(event) => setQueryText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) =>
                Math.min(filtered.length - 1, index + 1),
              );
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              execute(filtered[activeIndex]);
            }
          }}
          placeholder="명령 또는 검색…"
          size="md"
          value={queryText}
          variant="unstyled"
        />
      </Box>

      <Box
        p="xs"
        style={{
          borderTop: '1px solid var(--app-border-subtle)',
          maxHeight: '52vh',
          overflowY: 'auto',
        }}
      >
        {filtered.length === 0 ? (
          <Text c="dimmed" p="md" size="sm">
            일치하는 명령이 없습니다.
          </Text>
        ) : (
          <Stack gap={2}>
            {filtered.map((command, index) => (
              <Box
                key={command.id}
                onClick={() => execute(command)}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  alignItems: 'center',
                  background:
                    index === activeIndex
                      ? 'var(--app-surface-hero)'
                      : 'transparent',
                  borderRadius: 'var(--mantine-radius-md)',
                  color:
                    index === activeIndex
                      ? 'var(--app-text-primary)'
                      : 'var(--app-text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                }}
              >
                <Text fw={650} size="sm">
                  {command.label}
                </Text>
                {command.hint && (
                  <Text c="dimmed" size="xs">
                    {command.hint}
                  </Text>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Box
        px="sm"
        py={8}
        style={{ borderTop: '1px solid var(--app-border-subtle)' }}
      >
        <Text c="dimmed" size="xs">
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> 이동 · <Kbd>Enter</Kbd> 실행 ·{' '}
          <Kbd>Esc</Kbd> 닫기
        </Text>
      </Box>
    </Modal>
  );
}
