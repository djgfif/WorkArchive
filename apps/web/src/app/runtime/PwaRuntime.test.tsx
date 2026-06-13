import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@test/render-with-providers';
import { PwaRuntime } from './PwaRuntime';

const pwaState = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(async (_reloadPage?: boolean) => undefined),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(() => ({
    needRefresh: [pwaState.needRefresh, pwaState.setNeedRefresh],
    offlineReady: [pwaState.offlineReady, pwaState.setOfflineReady],
    updateServiceWorker: pwaState.updateServiceWorker,
  })),
}));

describe('PwaRuntime', () => {
  afterEach(() => {
    pwaState.needRefresh = false;
    pwaState.offlineReady = false;
    vi.clearAllMocks();
  });

  it('stays hidden until there is a service worker event', () => {
    renderWithProviders(<PwaRuntime />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows offline-ready copy and can be dismissed', async () => {
    const user = userEvent.setup();

    pwaState.offlineReady = true;
    renderWithProviders(<PwaRuntime />);

    expect(screen.getByText('오프라인에서도 열 수 있습니다')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(pwaState.setOfflineReady).toHaveBeenCalledWith(false);
  });

  it('applies a waiting service worker only after user action', async () => {
    const user = userEvent.setup();

    pwaState.needRefresh = true;
    renderWithProviders(<PwaRuntime />);

    expect(screen.getByText('새 버전이 준비됐습니다')).toBeInTheDocument();
    expect(pwaState.updateServiceWorker).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '새 버전 적용' }));
    expect(pwaState.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
