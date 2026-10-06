// context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

type Ctx = {
  requestId: string;
  auth: any; // replace with your org type if you have it, e.g. Organization
  /** Images attached to the latest user chat message (sample images for "make one like this"). */
  referenceImages?: string[];
};

const als = new AsyncLocalStorage<Ctx>();

export function runWithContext<T>(ctx: Ctx, fn: () => Promise<T> | T) {
  return als.run(ctx, fn);
}

export function getContext(): Ctx | undefined {
  return als.getStore();
}

export function getAuth<T = any>(): T | undefined {
  return als.getStore()?.auth as T | undefined;
}

export function getReferenceImages(): string[] {
  return als.getStore()?.referenceImages ?? [];
}

export function getRequestId(): string | undefined {
  return als.getStore()?.requestId;
}