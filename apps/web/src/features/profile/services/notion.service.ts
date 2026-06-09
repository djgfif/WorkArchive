import type {
  NotionApplyRequest,
  NotionApplyResponse,
  NotionConnectionRequest,
  NotionConnectionTestResponse,
  NotionPreviewResponse,
  NotionPushResponse,
  NotionStatusResponse,
} from '@work-archive/shared-types';

import {
  requestAuthenticatedApi,
  requestAuthenticatedApiJson,
} from '@shared/services/api-client';

export type {
  NotionApplyResponse,
  NotionChangePreview,
  NotionConnectionTestResponse,
  NotionPreviewResponse,
  NotionPushResponse,
  NotionStatusResponse,
} from '@work-archive/shared-types';

const NOTION_STATUS_PATH = '/notion/status';
const NOTION_CONNECTION_PATH = '/notion/connection';
const NOTION_TEST_PATH = '/notion/test';
const NOTION_PUSH_PATH = '/notion/sync/push';
const NOTION_PREVIEW_PATH = '/notion/sync/preview';
const NOTION_APPLY_PATH = '/notion/sync/apply';

export const notionService = {
  getStatus() {
    return requestAuthenticatedApiJson<NotionStatusResponse>(
      NOTION_STATUS_PATH,
      {
        method: 'GET',
      },
    );
  },
  saveConnection(input: NotionConnectionRequest) {
    return requestAuthenticatedApiJson<NotionStatusResponse>(
      NOTION_CONNECTION_PATH,
      {
        body: JSON.stringify(input),
        method: 'PUT',
      },
    );
  },
  deleteConnection() {
    return requestAuthenticatedApi(NOTION_CONNECTION_PATH, {
      method: 'DELETE',
    });
  },
  testConnection() {
    return requestAuthenticatedApiJson<NotionConnectionTestResponse>(
      NOTION_TEST_PATH,
      {
        method: 'POST',
      },
    );
  },
  push() {
    return requestAuthenticatedApiJson<NotionPushResponse>(NOTION_PUSH_PATH, {
      method: 'POST',
    });
  },
  previewPull() {
    return requestAuthenticatedApiJson<NotionPreviewResponse>(
      NOTION_PREVIEW_PATH,
      {
        method: 'POST',
      },
    );
  },
  applyPull(input: NotionApplyRequest = {}) {
    return requestAuthenticatedApiJson<NotionApplyResponse>(
      NOTION_APPLY_PATH,
      {
        body: JSON.stringify(input),
        method: 'POST',
      },
    );
  },
};
