import {staticFile} from 'remotion';

export const resolveMediaSource = (source: string): string =>
  /^(https?:\/\/|data:)/i.test(source) || source.startsWith('/')
    ? source
    : staticFile(source);
