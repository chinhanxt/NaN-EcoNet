/** This API writes only deterministic video artifacts owned by the backend. */
export function validateSourceVideoStorageKey(key: string, mimetype: string): string {
  if (mimetype !== 'video/mp4' || typeof key !== 'string' || key.length > 350 ||
    !/^source-video\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\.mp4$/.test(key)) {
    throw new Error('Invalid deterministic source video storage key');
  }
  return key;
}
