import { defineConfig } from 'orval';

export default defineConfig({
  workArchiveApi: {
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
    input: {
      target: 'openapi/work-archive-api.json',
    },
    output: {
      clean: true,
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'tags-split',
      schemas: 'apps/web/src/shared/generated/model',
      target: 'apps/web/src/shared/generated/work-archive-api.ts',
    },
  },
});
