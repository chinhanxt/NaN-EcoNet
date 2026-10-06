import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { findPostTime } from '../../libraries/nestjs-libraries/src/agent/find.post.time';
dayjs.extend(utc);

describe('draft posting time', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-29T12:34:20Z')); });
  afterEach(() => jest.useRealTimers());
  it.each([{ slots: [] }, { slots: [-1, 1440, NaN, 2.5] }])('returns a future draft time without scanning an empty/invalid schedule', async ({slots}) => {
    const available = jest.fn();
    expect(await findPostTime(slots, available)).toBe('2026-09-29T12:35:00');
    expect(available).not.toHaveBeenCalled();
  });
  it('preserves configured-slot ordering and continues to the next day when today is full', async () => {
    const available = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([120, 60]);
    expect(await findPostTime([60, 120], available)).toBe('2026-09-30T01:00:00');
    expect(available).toHaveBeenCalledTimes(2);
  });
  it('stops a pending scan when the client disconnects', async () => {
    const abort = new AbortController();
    const available = jest.fn(async () => { abort.abort(new Error('Disconnected')); return []; });
    await expect(findPostTime([60], available, abort.signal)).rejects.toThrow('Disconnected');
    expect(available).toHaveBeenCalledTimes(1);
  });
});
