import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import { appTheme } from '../app/mantine-theme';

export function renderWithProviders(ui: ReactNode) {
  return render(
    <MantineProvider defaultColorScheme="light" theme={appTheme}>
      {ui}
    </MantineProvider>,
  );
}
