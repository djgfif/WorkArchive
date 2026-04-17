import globals from 'globals';

import { baseConfig } from './base.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['test/**/*.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
];
