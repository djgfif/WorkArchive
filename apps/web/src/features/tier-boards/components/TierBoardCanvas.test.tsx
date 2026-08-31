import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { describe, expect, it, vi } from 'vitest';
import type {
  TierBoardCardRecord,
  TierLaneRecord,
} from '@work-archive/shared-types';

import { renderWithProviders } from '@test/render-with-providers';
import { CardImage, SortableCard } from './TierBoardCanvas';

const now = '2026-08-14T00:00:00.000Z';

function buildLane(id: string, title: string): TierLaneRecord {
  return {
    id,
    boardId: 'board-1',
    title,
    description: '',
    colorToken: '#64748b',
    orderIndex: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'synced',
    serverVersion: 1,
  };
}

const card: TierBoardCardRecord = {
  id: 'card-1',
  boardId: 'board-1',
  laneId: null,
  orderIndex: 0,
  cardSourceType: 'custom',
  workId: null,
  title: '은하영웅전설',
  subtitle: '',
  imageUrl: '',
  note: '',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  syncStatus: 'synced',
  serverVersion: 1,
};

describe('CardImage poster privacy', () => {
  it('renders allowlisted covers only through the same-origin proxy', () => {
    renderWithProviders(
      <CardImage
        imageUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
      />,
    );

    const image = screen.getByAltText('Dune');

    expect(image).toHaveAttribute(
      'src',
      '/api/image-proxy?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F123-L.jpg',
    );
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('uses the local placeholder for arbitrary hosts and proxy failures', () => {
    const { unmount } = renderWithProviders(
      <CardImage
        imageUrl="https://cdn.example.test/track-user.jpg"
        title="Dune"
      />,
    );

    expect(screen.queryByAltText('Dune')).not.toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();

    unmount();
    renderWithProviders(
      <CardImage
        imageUrl="https://covers.openlibrary.org/b/id/123-L.jpg"
        title="Dune"
      />,
    );
    fireEvent.error(screen.getByAltText('Dune'));

    expect(screen.queryByAltText('Dune')).not.toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });
});

describe('SortableCard menu', () => {
  it('uses the correct Korean particle in lane move actions', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <DndContext>
        <SortableCard
          assetUrls={new Map()}
          card={card}
          lanes={[
            buildLane('lane-1', '최애'),
            buildLane('lane-2', '좋음'),
          ]}
          onDelete={vi.fn()}
          onDuplicate={vi.fn()}
          onEdit={vi.fn()}
          onMove={vi.fn()}
          showTitle
        />
      </DndContext>,
    );

    await user.click(
      screen.getByRole('button', { name: '은하영웅전설 메뉴' }),
    );

    expect(await screen.findByRole('menuitem', { name: '최애로 이동' }))
      .toBeInTheDocument();
    expect(screen.getByText('좋음으로 이동'))
      .toBeInTheDocument();
  });
});
