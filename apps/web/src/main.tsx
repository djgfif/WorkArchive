import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import Dexie from 'dexie';

import { App } from './app/App';
import {
  appColorSchemeManager,
  appCssVariablesResolver,
  appTheme,
} from './app/mantine-theme';
import '@mantine/core/styles.css';
import './app/styles/global.css';

Dexie.debug = false;

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container was not found.');
}

createRoot(container).render(
  <StrictMode>
    <MantineProvider
      colorSchemeManager={appColorSchemeManager}
      cssVariablesResolver={appCssVariablesResolver}
      defaultColorScheme="dark"
      theme={appTheme}
    >
      <App />
    </MantineProvider>
  </StrictMode>,
);
