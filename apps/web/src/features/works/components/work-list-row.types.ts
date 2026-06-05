import type {
  ProgressUnit,
  WorkRecord,
  WorkStatus,
} from '@work-archive/shared-types';

export interface WorkQuickUpdate {
  favorite?: boolean;
  rating?: number | null;
  status?: WorkStatus;
}

export interface WorkQuickProgressUpdate {
  lastConsumedLabel: string;
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: ProgressUnit;
}

export interface WorkListRowProps {
  /** 카탈로그 일련번호(0-based). register처럼 행 앞에 모노스페이스로 표기. */
  index?: number;
  isLast?: boolean;
  isUpdating: boolean;
  onDelete: (work: WorkRecord) => Promise<void>;
  onQuickProgressUpdate: (
    work: WorkRecord,
    update: WorkQuickProgressUpdate,
  ) => Promise<void>;
  onQuickUpdate: (work: WorkRecord, update: WorkQuickUpdate) => Promise<void>;
  work: WorkRecord;
}
