import { toDispatchBulkyWasteOrder, createDispatchEvent } from './domain/dispatchMapper.js';

export { toDispatchBulkyWasteOrder, createDispatchEvent };

export function getDispatchOutboxEvents(storage) {
  if (!storage) return [];
  const repo = typeof storage.getRepository === 'function' ? storage.getRepository() : {};
  const events = repo.dispatchOutbox || [];

  const seen = new Set();
  const deduped = [];

  for (const ev of events) {
    if (ev?.eventId && !seen.has(ev.eventId)) {
      seen.add(ev.eventId);
      deduped.push(ev);
    }
  }

  return deduped;
}
