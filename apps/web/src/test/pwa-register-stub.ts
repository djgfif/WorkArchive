/**
 * 테스트용 stub. 실제 빌드에서는 vite-plugin-pwa 가 제공하는
 * virtual:pwa-register/react 가 사용된다.
 */
export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (swUrl: string, registration?: unknown) => void;
  onRegisterError?: (error: unknown) => void;
}

export function useRegisterSW(_options?: RegisterSWOptions) {
  return {
    needRefresh: [false, () => undefined] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => undefined] as [
      boolean,
      (value: boolean) => void,
    ],
    updateServiceWorker: (_reloadPage?: boolean) => Promise.resolve(),
  };
}
