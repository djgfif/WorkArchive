import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TierBoardEditorState } from '../services/tier-board.repository';
import type { TierBoardRecord } from '@work-archive/shared-types';

const tierBoardMocks = vi.hoisted(() => ({
  boards: [] as TierBoardRecord[],
  states: new Map<string, TierBoardEditorState>(),
}));

vi.mock('../services/tier-board.service', () => ({
  TIER_BOARD_TEMPLATES: [
    {
      title: 'S/A/B/C/D',
      lanes: [
        { title: 'S', colorToken: '#ef4444' },
        { title: 'A', colorToken: '#f97316' },
        { title: 'B', colorToken: '#22c55e' },
        { title: 'C', colorToken: '#38bdf8' },
        { title: 'D', colorToken: '#94a3b8' },
      ],
    },
    {
      title: 'SS/S/A/B/C/D/F',
      lanes: [
        { title: 'SS', colorToken: '#f43f5e' },
        { title: 'S', colorToken: '#ef4444' },
        { title: 'A', colorToken: '#f97316' },
        { title: 'B', colorToken: '#22c55e' },
        { title: 'C', colorToken: '#38bdf8' },
        { title: 'D', colorToken: '#94a3b8' },
        { title: 'F', colorToken: '#64748b' },
      ],
    },
    {
      title: '최애/좋음/무난/아쉬움',
      lanes: [
        { title: '최애', colorToken: '#ec4899' },
        { title: '좋음', colorToken: '#22c55e' },
        { title: '무난', colorToken: '#38bdf8' },
        { title: '아쉬움', colorToken: '#94a3b8' },
      ],
    },
    { title: '빈 보드', lanes: [] },
  ],
  tierBoardService: {
    createBoard: vi.fn(),
    deleteBoard: vi.fn(),
    duplicateBoard: vi.fn(),
    getBoardEditorState: vi.fn(async (id: string) => tierBoardMocks.states.get(id) ?? null),
    importBoardJson: vi.fn(),
    listBoards: vi.fn(async () => tierBoardMocks.boards),
    restoreBoardSnapshot: vi.fn(),
  },
}));

import { appRoutes } from '@app/router/routes';
import { renderWithProviders } from '@test/render-with-providers';
import { AuthProvider } from '@features/auth';
import { tierBoardService } from '../services/tier-board.service';

function buildBoard(overrides: Partial<TierBoardRecord> = {}): TierBoardRecord {
  return {
    id: 'board-1',
    title: '상용화 테스트 보드',
    description: '',
    slug: 'commerce-test-board',
    boardType: 'classic_tier',
    visibility: 'private',
    coverImageUrl: '',
    createdAt: '2026-05-21T00:00:00.000Z',
    updatedAt: '2026-05-21T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local-only',
    serverVersion: 0,
    ...overrides,
  };
}

function renderRoute(path = '/tier-boards') {
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

describe('TierBoardsPage', () => {
  beforeEach(() => {
    tierBoardMocks.boards = [];
    tierBoardMocks.states.clear();
    vi.mocked(tierBoardService.createBoard).mockResolvedValue(buildBoard({ id: 'created-board' }));
    vi.mocked(tierBoardService.deleteBoard).mockResolvedValue({
      assets: [],
      board: buildBoard(),
      cards: [],
      lanes: [],
    });
    vi.mocked(tierBoardService.duplicateBoard).mockResolvedValue(buildBoard({ id: 'copy-board' }));
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the tier board route instead of redirecting to works', async () => {
    renderRoute();

    expect(
      await screen.findByRole('heading', { name: '자유형 티어보드' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '아직 만든 티어보드가 없습니다.' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: '새 티어보드 만들기' }).length,
    ).toBeGreaterThan(0);
  });

  it('lists local boards with counts and editor/view actions', async () => {
    const board = buildBoard({
      description: '로컬 전용 테스트 보드',
    });
    tierBoardMocks.boards = [board];
    tierBoardMocks.states.set(board.id, {
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
          title: '스냅샷 카드',
          subtitle: '',
          imageUrl: '',
          note: '',
          createdAt: board.createdAt,
          updatedAt: board.updatedAt,
          deletedAt: null,
          syncStatus: 'local-only',
          serverVersion: 0,
        },
      ],
      lanes: Array.from({ length: 5 }, (_, index) => ({
        id: `lane-${index}`,
        boardId: board.id,
        title: ['S', 'A', 'B', 'C', 'D'][index]!,
        description: '',
        colorToken: '#64748b',
        orderIndex: index,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        deletedAt: null,
        syncStatus: 'local-only',
        serverVersion: 0,
      })),
    });

    renderRoute();

    expect(await screen.findByText('상용화 테스트 보드')).toBeInTheDocument();
    expect(screen.getByText('로컬 전용 테스트 보드')).toBeInTheDocument();
    expect(screen.getByText('5 lanes')).toBeInTheDocument();
    expect(screen.getByText('1 cards')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '열기' })).toHaveAttribute(
      'href',
      `/tier-boards/${board.id}`,
    );
    expect(screen.getByRole('link', { name: '보기' })).toHaveAttribute(
      'href',
      `/tier-boards/${board.id}/view`,
    );
  });

  it('creates boards from a modal with visual template choices', async () => {
    const user = userEvent.setup();

    renderRoute();

    await user.click((await screen.findAllByRole('button', { name: '새 티어보드 만들기' }))[0]!);

    expect(await screen.findByRole('dialog', { name: '새 티어보드 만들기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SS\/S\/A\/B\/C\/D\/F/ })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('새 티어보드 제목'));
    await user.type(screen.getByLabelText('새 티어보드 제목'), '새 UX 보드');
    await user.click(screen.getByRole('button', { name: /최애\/좋음\/무난\/아쉬움/ }));
    await user.click(screen.getByRole('button', { name: '만들기' }));

    expect(tierBoardService.createBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        templateTitle: '최애/좋음/무난/아쉬움',
        title: '새 UX 보드',
      }),
    );
  });
});
