import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import {
  appColorSchemeManager,
  appCssVariablesResolver,
  appTheme,
} from '@app/mantine-theme';

export function renderWithProviders(ui: ReactNode) {
  return render(
    <MantineProvider
      colorSchemeManager={appColorSchemeManager}
      cssVariablesResolver={appCssVariablesResolver}
      defaultColorScheme="dark"
      theme={appTheme}
    >
      {ui}
    </MantineProvider>,
  );
}
