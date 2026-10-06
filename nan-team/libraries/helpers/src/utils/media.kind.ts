// Scoped to agent/studio media. hasExtension keeps its substring behaviour
// because many providers depend on it.
const VIDEO_EXTENSION = /\.(mp4|mov|webm|m4v)$/i;

export const mediaPathname = (path?: string | null): string => {
  const value = (path || '').trim();
  if (!value) {
    return '';
  }
  try {
    return new URL(value, 'http://local').pathname;
  } catch {
    return value.split(/[?#]/)[0];
  }
};

export const isVideoPath = (path?: string | null): boolean =>
  VIDEO_EXTENSION.test(mediaPathname(path));
