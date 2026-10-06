import { isVideoPath } from './media.kind';

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// HTML for an agent chat user message. Only the media markup is HTML; typed
// text such as "<div>" stays literal. The integrations block is agent context.
export const agentUserMessageHtml = (text: string): string =>
  text
    .replace(/\[--integrations--\][\s\S]*?\[--integrations--\]/g, '')
    // Odd indexes of the split are the captured media block bodies
    .split(/\[--Media--\]([\s\S]*?)\[--Media--\]/)
    .map((part, index) => {
      if (index % 2 === 0) return escapeHtml(part);
      // Only Video/Image items are rendered; MediaId lines are for the
      // agent tools and any other block text is dropped, never shown
      const items: string[] = [];
      part.replace(/(Video|Image): (\S+)/g, (item: string, kind: string, url: string) => {
        const src = escapeHtml(url);
        // Older messages labelled .mov/.webm clips as Image
        items.push(
          kind === 'Video' || isVideoPath(url)
            ? `<video controls preload="metadata" class="h-[150px] w-[150px] rounded-[8px] mb-[10px]" src="${src}"></video>`
            : `<img src="${src}" class="h-[150px] w-[150px] max-w-full border border-newBgColorInner" />`
        );
        return item;
      });
      return `<div class="flex justify-center mt-[20px]">${items.join('')}</div>`;
    })
    .join('');
