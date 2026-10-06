/** Decode complete NDJSON frames across arbitrary network/UTF-8 boundaries. */
export async function* readNdjson(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<any> {
  const decoder = new TextDecoder('utf-8');
  let buffered = '';
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffered += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (line) yield JSON.parse(line);
      }
      if (done) {
        finished = true;
        if (buffered.trim()) yield JSON.parse(buffered);
        return;
      }
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
