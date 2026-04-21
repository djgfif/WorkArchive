import { createTheme } from '@mantine/core';

export const appTheme = createTheme({
  black: '#07111f',
  colors: {
    archive: [
      '#e4f4ff',
      '#cce6fb',
      '#9bc9f1',
      '#68abe7',
      '#3d91df',
      '#1f81db',
      '#0d6bc2',
      '#01549a',
      '#003f74',
      '#00294e',
    ],
  },
  defaultRadius: 'xl',
  fontFamily:
    '"IBM Plex Sans KR", "Pretendard Variable", "Pretendard", sans-serif',
  headings: {
    fontFamily:
      '"IBM Plex Sans KR", "Pretendard Variable", "Pretendard", sans-serif',
  },
  primaryColor: 'archive',
  primaryShade: 6,
  radius: {
    md: '1rem',
    xl: '1.5rem',
  },
  components: {
    Alert: {
      defaultProps: {
        radius: 'xl',
        variant: 'light',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'xl',
        variant: 'light',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'xl',
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: 'xl',
        size: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'xl',
        size: 'md',
      },
    },
  },
});
