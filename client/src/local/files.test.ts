import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile } from './files';

describe('file downloads', () => {
  const create = vi.fn(() => 'blob:synthetic'); const revoke = vi.fn(); let click: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { vi.useFakeTimers(); URL.createObjectURL = create; URL.revokeObjectURL = revoke; click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined); });
  afterEach(() => { vi.useRealTimers(); click.mockRestore(); create.mockClear(); revoke.mockClear(); });
  it('keeps the blob URL alive long enough for the browser to start the download', () => {
    downloadFile('flags.json', '{}', 'application/json');
    expect(click).toHaveBeenCalledTimes(1); expect(document.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(0); expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999); expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000); expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic');
  });
});
