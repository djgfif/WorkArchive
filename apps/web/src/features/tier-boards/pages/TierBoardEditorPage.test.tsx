import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TierBoardEditorState } from '../services/tier-board.repository';

const tierBoardMocks = vi.hoisted(() => ({
  states: new Map<string, TierBoardEditorState>(),
}));

const htmlToImageMocks = vi.hoisted(() => ({
  toBlob: vi.fn(),
  toPng: vi.fn(),
}));

vi.mock('../../works/services/works.repository', () => ({
  worksRepository: {
    listActive: vi.fn(async () => []),
  },
}));

vi.mock('../services/tier-board.service', () => ({
  TIER_BOARD_TEMPLATES: [
    { title: '기본 S/A/B/C/D', lanes: [] },
    { title: '빈 보드', lanes: [] },
  ],
  tierBoardService: {
    applyLaneTemplate: vi.fn(),
    createCardFromWorkSnapshot: vi.fn(),
    createCustomTextCard: vi.fn(),
    createImageUrlCard: vi.fn(),
    createLane: vi.fn(),
    createUploadedImageCard: vi.fn(),
    deleteCard: vi.fn(),
    deleteLane: vi.fn(),
    duplicateCard: vi.fn(),
    duplicateBoard: vi.fn(),
    exportBoardJson: vi.fn(),
    getBoardEditorState: vi.fn(async (id: string) => tierBoardMocks.states.get(id) ?? null),
    moveCardToLane: vi.fn(),
    removeCardFromLane: vi.fn(),
    reorderCard: vi.fn(),
    reorderLane: vi.fn(),
    restoreCardSnapshot: vi.fn(),
    restoreLaneDeleteSnapshot: vi.fn(),
    updateBoard: vi.fn(),
    updateCard: vi.fn(),
    updateLane: vi.fn(),
  },
}));

vi.mock('html-to-image', () => htmlToImageMocks);

import { appRoutes } from '../../../app/router/routes';
import { renderWithProviders } from '../../../test/render-with-providers';
import { AuthProvider } from '../../auth/context/AuthProvider';
import { tierBoardService } from '../services/tier-board.service';

function buildEditorState(): TierBoardEditorState {
  const now = '2026-05-21T00:00:00.000Z';
  const board = {
    id: 'board-1',
    title: '편집기 테스트 보드',
    description: '',
    slug: 'editor-test-board',
    boardType: 'classic_tier',
    visibility: 'private',
    coverImageUrl: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 1,
  } as const;

  return {
    assets: [],
    board,
    cards: [
      {
        id: 'card-1',
        boardId: board.id,
        laneId: null,
        orderIndex: 0,
        cardSourceType: 'custom',
        workId: null,
        title: '미배치 텍스트 카드',
        subtitle: '',
        imageUrl: '',
        note: '작품 기록과 독립적인 카드',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'synced',
        serverVersion: 1,
      },
    ],
    lanes: ['S', 'A', 'B', 'C', 'D'].map((title, index) => ({
      id: `lane-${title}`,
      boardId: board.id,
      title,
      description: '',
      colorToken: '#64748b',
      orderIndex: index,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'synced',
      serverVersion: 1,
    })),
  };
}

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderWithProviders(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
}

describe('TierBoardEditorPage', () => {
  beforeEach(() => {
    tierBoardMocks.states.clear();
    htmlToImageMocks.toBlob.mockResolvedValue(null);
    htmlToImageMocks.toPng.mockResolvedValue('data:image/png;base64,ok');
    vi.mocked(tierBoardService.updateBoard).mockClear();
  });

  it('renders the local-first editor with source panel, pool, and tier lanes', async () => {
    const state = buildEditorState();
    tierBoardMocks.states.set(state.board.id, state);

    renderRoute(`/tier-boards/${state.board.id}`);

    expect(
      await screen.findByRole('heading', { name: '편집기 테스트 보드' }),
    ).toBeInTheDocument();
    expect(screen.getByText('로컬 저장됨')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '카드 추가' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '텍스트' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '이미지 URL' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '업로드' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '작품에서 가져오기' })).toBeInTheDocument();
    expect(screen.getByText('미배치 카드')).toBeInTheDocument();
    expect(screen.getByText('미배치 텍스트 카드')).toBeInTheDocument();
    for (const laneTitle of ['S', 'A', 'B', 'C', 'D']) {
      expect(screen.getByRole('heading', { name: laneTitle })).toBeInTheDocument();
    }
  });

  it('keeps the source pool and lane canvas inside one DndContext shell', async () => {
    const state = buildEditorState();
    tierBoardMocks.states.set(state.board.id, state);

    renderRoute(`/tier-boards/${state.board.id}`);

    const shell = await screen.findByTestId('tier-board-dnd-context');

    expect(shell).toContainElement(screen.getByText('미배치 카드'));
    expect(shell).toContainElement(screen.getByRole('heading', { name: 'S' }));
    expect(shell).toContainElement(screen.getByText('미배치 텍스트 카드'));
  });

  it('saves board settings only after explicit save and keeps cancel local', async () => {
    const user = userEvent.setup();
    const state = buildEditorState();
    tierBoardMocks.states.set(state.board.id, state);

    renderRoute(`/tier-boards/${state.board.id}`);

    await user.click(await screen.findByRole('button', { name: '보드 설정' }));
    let dialog = await screen.findByRole('dialog', { name: '보드 설정' });
    await user.clear(within(dialog).getByLabelText('보드 제목'));
    await user.type(within(dialog).getByLabelText('보드 제목'), '취소할 제목');
    await user.click(within(dialog).getByRole('button', { name: '취소' }));

    expect(tierBoardService.updateBoard).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    dialog = await screen.findByRole('dialog', { name: '보드 설정' });
    await user.clear(within(dialog).getByLabelText('보드 제목'));
    await user.type(within(dialog).getByLabelText('보드 제목'), '저장할 제목');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(tierBoardService.updateBoard).toHaveBeenCalledWith(state.board.id, expect.objectContaining({ title: '저장할 제목' })),
    );
  });

  it('shows a clear PNG export fallback when html-to-image fails', async () => {
    const user = userEvent.setup();
    const state = buildEditorState();
    tierBoardMocks.states.set(state.board.id, state);
    htmlToImageMocks.toPng.mockRejectedValueOnce(new Error('cors'));

    renderRoute(`/tier-boards/${state.board.id}`);

    await user.click(await screen.findByRole('button', { name: '내보내기' }));
    await user.click(await screen.findByRole('menuitem', { name: 'PNG 이미지' }));

    expect(
      await screen.findByText('PNG 내보내기에 실패했습니다. 외부 이미지 CORS 때문에 실패했을 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('renders the local read-only view route without creating a public feed', async () => {
    const state = buildEditorState();
    tierBoardMocks.states.set(state.board.id, {
      ...state,
      board: {
        ...state.board,
        title: '읽기 전용 보드',
      },
    });

    renderRoute(`/tier-boards/${state.board.id}/view`);

    expect(
      await screen.findByRole('heading', { name: '읽기 전용 보드' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '편집' })).toHaveAttribute(
      'href',
      `/tier-boards/${state.board.id}`,
    );
    expect(screen.queryByText('댓글')).not.toBeInTheDocument();
    expect(screen.queryByText('좋아요')).not.toBeInTheDocument();
  });
});
