import { appI18n } from '@app/i18n';

export const workRecordRatingOptions = Array.from(
  { length: 10 },
  (_, index) => {
    const value = (index + 1) * 0.5;

    return {
      label: appI18n.t('works.rating.semanticValue', {
        value: value.toFixed(1),
      }),
      value,
    };
  },
);
