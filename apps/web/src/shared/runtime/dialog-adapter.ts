export interface ConfirmDialogOptions {
  description?: string;
  title: string;
}

export interface ConfirmDialogAdapter {
  confirm(options: ConfirmDialogOptions): Promise<boolean>;
}

function getBrowserConfirm() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.confirm.bind(window);
}

export function createBrowserConfirmDialogAdapter(
  confirmImplementation: ((message: string) => boolean) | null = getBrowserConfirm(),
): ConfirmDialogAdapter {
  return {
    async confirm({ description, title }) {
      if (!confirmImplementation) {
        return false;
      }

      const message = [title.trim(), description?.trim()].filter(Boolean).join('\n');

      return confirmImplementation(message);
    },
  };
}

export const confirmDialogAdapter = createBrowserConfirmDialogAdapter();
