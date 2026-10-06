'use client';

import { RefObject, useEffect, useRef } from 'react';

/**
 * Image/video files in a clipboard or drop payload. Screenshots usually arrive only as a clipboard
 * item (kind 'file', type image/png) with an empty `files` list, so items are read first.
 */
export const mediaFilesFrom = (data: DataTransfer | null | undefined): File[] => {
  const files: File[] = [];
  for (const item of Array.from(data?.items || [])) {
    if (item.kind !== 'file' || !/^(image|video)\//.test(item.type)) continue;
    const file = item.getAsFile();
    if (!file) continue;
    files.push(file.type ? file : new File([file], file.name || `clipboard.${item.type.split('/')[1]}`, { type: item.type }));
  }
  if (!files.length) {
    for (const file of Array.from(data?.files || [])) if (/^(image|video)\//.test(file.type)) files.push(file);
  }
  return files;
};

/**
 * Native capture-phase paste/drop listeners on `ref`: they run before any inner textarea (or a
 * library) can swallow the event. Files are taken (preventDefault) only when the payload has
 * image/video files; plain text paste is left alone.
 */
export const useMediaPaste = (
  ref: RefObject<HTMLElement | null>,
  onFiles: ((files: File[]) => void) | undefined,
  onDragging?: (dragging: boolean) => void
) => {
  const latest = useRef({ onFiles, onDragging });
  latest.current = { onFiles, onDragging };
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const take = (event: Event, data: DataTransfer | null | undefined) => {
      if (!latest.current.onFiles) return;
      const files = mediaFilesFrom(data);
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.onFiles(files);
    };
    const paste = (event: ClipboardEvent) => take(event, event.clipboardData);
    const dragOver = (event: DragEvent) => {
      if (!latest.current.onFiles || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
      event.preventDefault();
      latest.current.onDragging?.(true);
    };
    const dragLeave = () => latest.current.onDragging?.(false);
    const drop = (event: DragEvent) => {
      latest.current.onDragging?.(false);
      take(event, event.dataTransfer);
    };
    element.addEventListener('paste', paste, true);
    element.addEventListener('dragover', dragOver, true);
    element.addEventListener('dragleave', dragLeave, true);
    element.addEventListener('drop', drop, true);
    return () => {
      element.removeEventListener('paste', paste, true);
      element.removeEventListener('dragover', dragOver, true);
      element.removeEventListener('dragleave', dragLeave, true);
      element.removeEventListener('drop', drop, true);
    };
  }, [ref]);
};
