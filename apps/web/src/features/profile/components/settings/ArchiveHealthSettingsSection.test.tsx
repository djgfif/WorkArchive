import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import {
  archiveHealthReviewSessionService,
  archiveHealthService,
  type ArchiveHealthFixHistoryEntry,
  type ArchiveHealthReport,
} from '@features/works';
import { ArchiveHealthSettingsSection } from './ArchiveHealthSettingsSection';

const report: ArchiveHealthReport = {
  affectedWorkCount: 2,
  issueCounts: {
    attention: 1,
    improvement: 1,
    review: 1,
  },
  issues: [
    {
      code: 'progress_over_total',
      details: {
        current: 12,
        total: 10,
      },
      id: 'work-progress:progress_over_total',
      severity: 'attention',
      workId: 'work-progress',
      workTitle: '진행도 오류 작품',
    },
    {
      code: 'progress_unit_missing',
      details: {
        suggestedUnit: 'volume',
      },
      id: 'work-progress:progress_unit_missing',
      safeFix: {
        kind: 'set_progress_unit',
        progressUnit: 'volume',
      },
      severity: 'review',
      workId: 'work-progress',
      workTitle: '진행도 오류 작품',
    },
    {
      code: 'missing_thumbnail',
      details: {},
      id: 'work-cover:missing_thumbnail',
      severity: 'improvement',
      workId: 'work-cover',
      workTitle: '표지 없는 작품',
    },
  ],
  scannedAt: '2026-07-29T10:00:00.000Z',
  totalWorkCount: 2,
};

const historyEntry: ArchiveHealthFixHistoryEntry = {
  afterProgressUnit: 'volume',
  appliedAt: '2026-07-29T10:05:00.000Z',
  beforeProgressUnit: null,
  id: 'fix-history-1',
  kind: 'set_progress_unit',
  undoneAt: null,
  workId: 'work-progress',
  workTitle: '진행도 오류 작품',
};

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe('ArchiveHealthSettingsSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows health counts and links issues to record editing', async () => {
    vi.spyOn(archiveHealthService, 'scan').mockResolvedValue(report);
    vi.spyOn(archiveHealthService, 'listFixHistory').mockResolvedValue([]);

    renderWithProviders(
      <MemoryRouter>
        <ArchiveHealthSettingsSection archiveScopeKey="guest" />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: '아카이브 건강검진' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('진행도 오류 작품')).toBeInTheDocument();
    expect(
      screen.getByText('현재 진행도가 전체 분량보다 큽니다'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: '기록 수정' })[0],
    ).toHaveAttribute(
      'href',
      '/works/work-progress/edit?focus=archive-health&issues=progress_over_total%2Cprogress_unit_missing',
    );
  });

  it('starts a guided review with only manual-decision records', async () => {
    vi.spyOn(archiveHealthService, 'scan').mockResolvedValue(report);
    vi.spyOn(archiveHealthService, 'listFixHistory').mockResolvedValue([]);
    vi.spyOn(archiveHealthReviewSessionService, 'create').mockReturnValue({
      createdAt: '2026-08-02T00:00:00.000Z',
      id: 'review-session',
      items: [
        {
          issueCodes: ['progress_over_total'],
          workId: 'work-progress',
        },
      ],
      version: 1,
    });
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={['/account/settings#archive-health']}>
        <ArchiveHealthSettingsSection archiveScopeKey="guest" />
        <LocationProbe />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole('button', {
        name: '확인이 필요한 기록 1개 검토 시작',
      }),
    );

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/works/work-progress/edit?focus=archive-health&issues=progress_over_total&reviewSession=review-session',
    );
  });

  it('shows completion feedback after a guided review returns', async () => {
    vi.spyOn(archiveHealthService, 'scan').mockResolvedValue(report);
    vi.spyOn(archiveHealthService, 'listFixHistory').mockResolvedValue([]);

    renderWithProviders(
      <MemoryRouter
        initialEntries={[
          {
            hash: '#archive-health',
            pathname: '/account/settings',
            state: { archiveHealthReviewCompleted: 2 },
          },
        ]}
      >
        <ArchiveHealthSettingsSection archiveScopeKey="guest" />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        '2개 기록 검토를 마쳤습니다. 최신 상태로 다시 검사했습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('filters the result and reruns the scan', async () => {
    const scan = vi
      .spyOn(archiveHealthService, 'scan')
      .mockResolvedValue(report);
    vi.spyOn(archiveHealthService, 'listFixHistory').mockResolvedValue([]);
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter>
        <ArchiveHealthSettingsSection archiveScopeKey="guest" />
      </MemoryRouter>,
    );

    await screen.findByText('진행도 오류 작품');
    await user.click(screen.getByRole('radio', { name: '보강 제안 1' }));

    expect(screen.queryByText('진행도 오류 작품')).not.toBeInTheDocument();
    expect(screen.getByText('표지 없는 작품')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 검사' }));

    await waitFor(() => expect(scan).toHaveBeenCalledTimes(2));
  });

  it('applies and undoes a deterministic fix from persistent history', async () => {
    const fixedReport: ArchiveHealthReport = {
      ...report,
      affectedWorkCount: 1,
      issueCounts: {
        attention: 0,
        improvement: 1,
        review: 0,
      },
      issues: report.issues.filter((issue) => issue.workId !== 'work-progress'),
    };
    vi.spyOn(archiveHealthService, 'scan')
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce(fixedReport)
      .mockResolvedValueOnce(report);
    vi.spyOn(archiveHealthService, 'listFixHistory')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([historyEntry])
      .mockResolvedValueOnce([
        {
          ...historyEntry,
          undoneAt: '2026-07-29T10:10:00.000Z',
        },
      ]);
    const applySafeFix = vi
      .spyOn(archiveHealthService, 'applySafeFix')
      .mockResolvedValue(historyEntry);
    const undoSafeFix = vi
      .spyOn(archiveHealthService, 'undoSafeFix')
      .mockResolvedValue({
        ...historyEntry,
        undoneAt: '2026-07-29T10:10:00.000Z',
      });
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter>
        <ArchiveHealthSettingsSection archiveScopeKey="guest" />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole('button', {
        name: '진행도 오류 작품 안전 수정',
      }),
    );

    await waitFor(() =>
      expect(applySafeFix).toHaveBeenCalledWith('work-progress', {
        kind: 'set_progress_unit',
        progressUnit: 'volume',
      }),
    );
    expect(
      await screen.findByText(
        '“진행도 오류 작품”의 진행 단위를 설정했습니다: 권. 아래 변경 이력에서 되돌릴 수 있습니다.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '진행도 오류 작품 안전 수정 되돌리기',
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '진행도 오류 작품 안전 수정 되돌리기',
      }),
    );

    await waitFor(() =>
      expect(undoSafeFix).toHaveBeenCalledWith(historyEntry.id),
    );
    expect(
      await screen.findByText('“진행도 오류 작품”의 안전 수정을 되돌렸습니다.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('되돌림')).toBeInTheDocument();
  });
});
