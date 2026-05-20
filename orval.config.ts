import { defineConfig } from 'orval';

export default defineConfig({
  workArchiveApi: {
    input: {
      target: 'http://localhost:3000/docs/openapi.json',
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
