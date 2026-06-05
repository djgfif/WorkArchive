import { useState } from 'react';
import { ActionIcon, Group, Text, TextInput } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';

import { AppButton } from '@shared/components/AppPrimitives';
import { useSavedWorksViews } from '../hooks/useSavedWorksViews';

/**
 * 작품 페이지 상단의 스마트뷰 스트립 — 저장된 필터 조합을 칩으로 빠르게 적용/관리한다.
 */
export function SavedWorksViews() {
  const location = useLocation();
  const navigate = useNavigate();
  const { views, saveView, removeView } = useSavedWorksViews();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const currentSearch = location.search;
  const hasFilters = currentSearch.replace(/^\?/, '').length > 0;

  function handleSave() {
    saveView(name, currentSearch);
    setName('');
    setNaming(false);
  }

  if (views.length === 0 && !hasFilters) {
    return null;
  }

  return (
    <Group gap="xs" wrap="wrap">
      <Text
        c="dimmed"
        fw={750}
        size="xs"
        style={{ letterSpacing: '0.08em' }}
        tt="uppercase"
      >
        스마트뷰
      </Text>

      {views.map((view) => {
        const active = view.search === currentSearch;

        return (
          <Group gap={2} key={view.id} wrap="nowrap">
            <AppButton
              onClick={() => navigate(`/works${view.search}`)}
              size="compact-xs"
              tone={active ? 'primary' : 'secondary'}
            >
              {view.name}
            </AppButton>
            <ActionIcon
              aria-label={`${view.name} 스마트뷰 삭제`}
              color="gray"
              onClick={() => removeView(view.id)}
              size="sm"
              variant="subtle"
            >
              ✕
            </ActionIcon>
          </Group>
        );
      })}

      {hasFilters && !naming && (
        <AppButton
          onClick={() => setNaming(true)}
          size="compact-xs"
          tone="quiet"
        >
          + 현재 필터 저장
        </AppButton>
      )}

      {naming && (
        <Group gap={4} wrap="nowrap">
          <TextInput
            autoFocus
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSave();
              }

              if (event.key === 'Escape') {
                setNaming(false);
                setName('');
              }
            }}
            placeholder="뷰 이름 (예: 연재중 4★)"
            size="xs"
            value={name}
            w={170}
          />
          <AppButton
            disabled={!name.trim()}
            onClick={handleSave}
            size="compact-xs"
            tone="primary"
          >
            저장
          </AppButton>
          <AppButton
            onClick={() => {
              setNaming(false);
              setName('');
            }}
            size="compact-xs"
            tone="quiet"
          >
            취소
          </AppButton>
        </Group>
      )}
    </Group>
  );
}
