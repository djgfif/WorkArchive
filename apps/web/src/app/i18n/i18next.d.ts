import 'i18next';

import type { ko } from './resources/ko';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    parseInterpolation: false;
    resources: {
      translation: typeof ko;
    };
  }
}
