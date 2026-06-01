export const workRecordRatingOptions = Array.from(
  { length: 10 },
  (_, index) => {
    const value = (index + 1) * 0.5;

    return {
      label: `${value.toFixed(1)}점`,
      value,
    };
  },
);
