export const DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS = 1_000;

export function downloadUrl(filename: string, href: string) {
  const link = document.createElement('a');

  link.download = filename;
  link.href = href;
  link.hidden = true;
  document.body.append(link);

  try {
    link.click();
  } finally {
    link.remove();
  }
}

export function downloadBlob(filename: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    downloadUrl(filename, objectUrl);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  // Some browsers start reading the object URL after the synthetic click
  // returns. Revoking synchronously can cancel an otherwise valid download.
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS);
}

export function downloadTextFile(
  filename: string,
  type: string,
  content: string,
) {
  downloadBlob(filename, new Blob([content], { type }));
}
