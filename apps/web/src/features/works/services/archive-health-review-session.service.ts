import {
  ARCHIVE_HEALTH_ISSUE_CODES,
  type ArchiveHealthIssue,
  type ArchiveHealthIssueCode,
} from './archive-health.service';

const REVIEW_SESSION_STORAGE_PREFIX =
  'work-archive:archive-health-review-session:';
const REVIEW_SESSION_VERSION = 1;
const REVIEW_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const ARCHIVE_HEALTH_SETTINGS_PATH =
  '/account/settings#archive-health';

export interface ArchiveHealthReviewItem {
  issueCodes: ArchiveHealthIssueCode[];
  workId: string;
}

export interface ArchiveHealthReviewSession {
  createdAt: string;
  id: string;
  items: ArchiveHealthReviewItem[];
  version: 1;
}

export interface ArchiveHealthReviewContext {
  currentIndex: number;
  currentItem: ArchiveHealthReviewItem;
  nextItem: ArchiveHealthReviewItem | null;
  session: ArchiveHealthReviewSession;
  total: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

type StorageResolver = () => StorageLike | null;
type NowResolver = () => Date;
type IdResolver = () => string;

function getSessionStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function createSessionId() {
  return crypto.randomUUID();
}

function getStorageKey(sessionId: string) {
  return `${REVIEW_SESSION_STORAGE_PREFIX}${sessionId}`;
}

function isIssueCode(value: unknown): value is ArchiveHealthIssueCode {
  return (
    typeof value === 'string' &&
    (ARCHIVE_HEALTH_ISSUE_CODES as readonly string[]).includes(value)
  );
}

function parseSession(value: string | null): ArchiveHealthReviewSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ArchiveHealthReviewSession>;

    if (
      parsed.version !== REVIEW_SESSION_VERSION ||
      typeof parsed.id !== 'string' ||
      typeof parsed.createdAt !== 'string' ||
      !Array.isArray(parsed.items) ||
      parsed.items.length === 0
    ) {
      return null;
    }

    const items = parsed.items.flatMap((item) => {
      if (
        !item ||
        typeof item.workId !== 'string' ||
        !Array.isArray(item.issueCodes)
      ) {
        return [];
      }

      const issueCodes = item.issueCodes.filter(isIssueCode);

      return issueCodes.length > 0
        ? [{ issueCodes: [...new Set(issueCodes)], workId: item.workId }]
        : [];
    });

    return items.length > 0
      ? {
          createdAt: parsed.createdAt,
          id: parsed.id,
          items,
          version: REVIEW_SESSION_VERSION,
        }
      : null;
  } catch {
    return null;
  }
}

export function createArchiveHealthReviewItems(
  issues: ArchiveHealthIssue[],
): ArchiveHealthReviewItem[] {
  const items = new Map<string, ArchiveHealthReviewItem>();

  for (const issue of issues) {
    if (issue.severity === 'improvement' || issue.safeFix) {
      continue;
    }

    const existing = items.get(issue.workId);

    if (existing) {
      if (!existing.issueCodes.includes(issue.code)) {
        existing.issueCodes.push(issue.code);
      }

      continue;
    }

    items.set(issue.workId, {
      issueCodes: [issue.code],
      workId: issue.workId,
    });
  }

  return [...items.values()];
}

export function parseArchiveHealthIssueCodes(
  value: string | null,
): ArchiveHealthIssueCode[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(',')
        .map((code) => code.trim())
        .filter(isIssueCode),
    ),
  ];
}

export function buildArchiveHealthEditUrl(
  workId: string,
  options: {
    issueCodes?: ArchiveHealthIssueCode[];
    reviewSessionId?: string | null;
  } = {},
) {
  const searchParams = new URLSearchParams({ focus: 'archive-health' });
  const issueCodes = [...new Set(options.issueCodes ?? [])];

  if (issueCodes.length > 0) {
    searchParams.set('issues', issueCodes.join(','));
  }

  if (options.reviewSessionId) {
    searchParams.set('reviewSession', options.reviewSessionId);
  }

  return `/works/${encodeURIComponent(workId)}/edit?${searchParams.toString()}`;
}

export class ArchiveHealthReviewSessionService {
  constructor(
    private readonly storageResolver: StorageResolver = getSessionStorage,
    private readonly now: NowResolver = () => new Date(),
    private readonly createId: IdResolver = createSessionId,
  ) {}

  create(items: ArchiveHealthReviewItem[]): ArchiveHealthReviewSession | null {
    const storage = this.storageResolver();
    const normalizedItems = items.flatMap((item) => {
      const issueCodes = [...new Set(item.issueCodes.filter(isIssueCode))];

      return item.workId && issueCodes.length > 0
        ? [{ issueCodes, workId: item.workId }]
        : [];
    });

    if (!storage || normalizedItems.length === 0) {
      return null;
    }

    const session: ArchiveHealthReviewSession = {
      createdAt: this.now().toISOString(),
      id: this.createId(),
      items: normalizedItems,
      version: REVIEW_SESSION_VERSION,
    };

    try {
      storage.setItem(getStorageKey(session.id), JSON.stringify(session));
    } catch {
      return null;
    }

    return session;
  }

  getContext(
    sessionId: string | null,
    workId: string | null | undefined,
  ): ArchiveHealthReviewContext | null {
    if (!sessionId || !workId) {
      return null;
    }

    const storage = this.storageResolver();

    if (!storage) {
      return null;
    }

    let session: ArchiveHealthReviewSession | null;

    try {
      session = parseSession(storage.getItem(getStorageKey(sessionId)));
    } catch {
      return null;
    }

    if (!session || session.id !== sessionId) {
      this.remove(sessionId);
      return null;
    }

    const createdAt = Date.parse(session.createdAt);

    if (
      !Number.isFinite(createdAt) ||
      this.now().getTime() - createdAt > REVIEW_SESSION_TTL_MS
    ) {
      this.remove(sessionId);
      return null;
    }

    const currentIndex = session.items.findIndex(
      (item) => item.workId === workId,
    );

    if (currentIndex < 0) {
      return null;
    }

    return {
      currentIndex,
      currentItem: session.items[currentIndex]!,
      nextItem: session.items[currentIndex + 1] ?? null,
      session,
      total: session.items.length,
    };
  }

  remove(sessionId: string | null | undefined) {
    if (sessionId) {
      try {
        this.storageResolver()?.removeItem(getStorageKey(sessionId));
      } catch {
        // Storage cleanup is best-effort; an inaccessible tab store is harmless.
      }
    }
  }
}

export const archiveHealthReviewSessionService =
  new ArchiveHealthReviewSessionService();
