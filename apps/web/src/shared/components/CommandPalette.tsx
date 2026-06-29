import { useEffect, useMemo, useRef, useState } from 'react';
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

import { useAppTranslation } from '@app/i18n';

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
  const { t } = useAppTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const listRef = useRef<HTMLDivElement>(null);

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
        label: t('navigation.addWork'),
        hint: t('commandPalette.newRecordHint'),
        keywords: t('commandPalette.keywords.add'),
        run: () => navigate('/works/new'),
      },
      {
        id: 'home',
        label: t('routes.fallbackHome'),
        keywords: t('commandPalette.keywords.home'),
        run: () => navigate('/'),
      },
      {
        id: 'works',
        label: t('navigation.worksLibrary'),
        keywords: t('commandPalette.keywords.works'),
        run: () => navigate('/works'),
      },
      {
        id: 'insights',
        label: t('navigation.insights'),
        keywords: t('commandPalette.keywords.insights'),
        run: () => navigate('/insights'),
      },
      {
        id: 'tier',
        label: t('navigation.tierBoards'),
        keywords: t('commandPalette.keywords.tier'),
        run: () => navigate('/tier-boards'),
      },
      {
        id: 'continue',
        label: t('commandPalette.showInProgress'),
        hint: t('commandPalette.showInProgressHint'),
        keywords: t('commandPalette.keywords.continue'),
        run: () => navigate('/works?status=in_progress'),
      },
      {
        id: 'completed-serial',
        label: t('commandPalette.showCompletedSerial'),
        keywords: t('commandPalette.keywords.completedSerial'),
        run: () => navigate('/works?serial=completed'),
      },
      {
        id: 'favorites',
        label: t('commandPalette.showFavorites'),
        keywords: t('commandPalette.keywords.favorites'),
        run: () => navigate('/works?smart=favorites'),
      },
      {
        id: 'unrated',
        label: t('commandPalette.noRating'),
        keywords: t('commandPalette.keywords.unrated'),
        run: () => navigate('/works?sort=rating&dir=asc'),
      },
      {
        id: 'settings',
        label: t('navigation.settingsBackup'),
        keywords: t('commandPalette.keywords.settings'),
        run: () => navigate('/account/settings'),
      },
      {
        id: 'theme',
        label:
          colorScheme === 'dark'
            ? t('theme.switchToLight')
            : t('theme.switchToDark'),
        keywords: t('commandPalette.keywords.theme'),
        run: () => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark'),
      },
    ];

    if (trimmed) {
      list.unshift({
        id: 'search',
        label: t('commandPalette.searchLabel', { query: trimmed }),
        hint: t('commandPalette.searchHint'),
        run: () => navigate(`/works?q=${encodeURIComponent(trimmed)}`),
      });
    }

    return list;
  }, [queryText, navigate, colorScheme, setColorScheme, t]);

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

  // 키보드(↑/↓)로 옮긴 활성 항목이 스크롤 영역 밖이면 시야로 끌어온다.
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(
      '[data-command-active="true"]',
    );
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, filtered.length]);

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
          aria-label={t('commandPalette.inputLabel')}
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
          placeholder={t('commandPalette.placeholder')}
          size="md"
          value={queryText}
          variant="unstyled"
        />
      </Box>

      <Box
        ref={listRef}
        p="xs"
        style={{
          borderTop: '1px solid var(--app-border-subtle)',
          maxHeight: '52vh',
          overflowY: 'auto',
        }}
      >
        {filtered.length === 0 ? (
          <Text c="dimmed" p="md" size="sm">
            {t('commandPalette.empty')}
          </Text>
        ) : (
          <Stack gap={2}>
            {filtered.map((command, index) => (
              <Box
                key={command.id}
                data-command-active={index === activeIndex ? 'true' : undefined}
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
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> {t('commandPalette.move')} ·{' '}
          <Kbd>Enter</Kbd> {t('commandPalette.execute')} · <Kbd>Esc</Kbd>{' '}
          {t('commandPalette.close')}
        </Text>
      </Box>
    </Modal>
  );
}
