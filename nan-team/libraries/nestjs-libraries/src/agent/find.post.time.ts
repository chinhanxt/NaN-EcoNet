import dayjs from 'dayjs';

/** Suggest a draft time, or scan the configured posting slots until one is free. */
export async function findPostTime(
  times: number[],
  available: (times: number[], date: dayjs.Dayjs) => Promise<number[]>,
  signal?: AbortSignal
): Promise<string> {
  signal?.throwIfAborted();
  const slots = [...new Set(times.filter(time => Number.isInteger(time) && time >= 0 && time < 1440))];
  const now = dayjs.utc();
  if (!slots.length) return now.add(1, 'minute').second(0).format('YYYY-MM-DDTHH:mm:00');
  let date = now.startOf('day');
  for (;;) {
    signal?.throwIfAborted();
    const free = await available(slots, date);
    signal?.throwIfAborted();
    if (free.length) return date.add(Math.min(...free), 'minutes').format('YYYY-MM-DDTHH:mm:00');
    date = date.add(1, 'day');
  }
}
