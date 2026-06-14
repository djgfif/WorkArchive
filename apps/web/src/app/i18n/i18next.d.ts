import 'i18next';

import type { AppTranslationResource } from './types';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    parseInterpolation: false;
    resources: {
      translation: AppTranslationResource;
    };
  }
}
