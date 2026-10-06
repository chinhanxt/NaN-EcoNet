import type { Writable } from "node:stream";

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export interface ProcessLineWriter {
  write(line: string): boolean;
  close(): void;
}

export function createProcessLineWriter(
  stream: Writable,
  onFailure: (error: Error) => void,
): ProcessLineWriter {
  let writable = true;

  const fail = (error: unknown): void => {
    if (!writable) return;
    writable = false;
    onFailure(asError(error));
  };

  // A failed Windows anonymous pipe emits an error even when write() also receives
  // an error callback. Keeping this listener installed prevents an Electron helper
  // from turning an expected parent disconnect into an uncaught main-process error.
  stream.on("error", fail);

  return {
    write(line: string): boolean {
      if (!writable || stream.destroyed || stream.writableEnded) return false;
      try {
        stream.write(`${line}\n`, error => {
          if (error) fail(error);
        });
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    },
    close(): void {
      writable = false;
    },
  };
}
