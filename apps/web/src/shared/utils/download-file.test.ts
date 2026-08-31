import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS,
  downloadTextFile,
} from './download-file';

const createObjectUrl = vi.fn(() => 'blob:work-archive-download');
const revokeObjectUrl = vi.fn();

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: createObjectUrl,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: revokeObjectUrl,
});

describe('downloadTextFile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
  });

  it('clicks a connected download link and delays object URL revocation', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function clickDownloadLink(this: HTMLAnchorElement) {
        expect(this.isConnected).toBe(true);
      });

    downloadTextFile('archive.json', 'application/json', '{"works":[]}');

    expect(click).toHaveBeenCalledOnce();
    expect(
      document.querySelector('a[download="archive.json"]'),
    ).not.toBeInTheDocument();
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DOWNLOAD_OBJECT_URL_REVOKE_DELAY_MS);

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:work-archive-download');
  });

  it('revokes the object URL immediately when starting the download fails', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('download blocked');
    });

    expect(() =>
      downloadTextFile('archive.json', 'application/json', '{}'),
    ).toThrow('download blocked');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:work-archive-download');
  });
});
