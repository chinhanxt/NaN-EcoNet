import type {TimedCaption} from '../types/schema';
import type {CaptionAppearance} from '../types/source-video';

// Vietnamese function words: a page break next to one falls on a phrase boundary,
// while a break between two content syllables may split a compound ("xe | tải").
// Mirrors core/subtitles.py _break_cost (keep both in sync).
const FUNCTION_WORDS = new Set(`bị được là của và với cho thì mà đã đang sẽ vừa mới rồi cũng vẫn còn không chưa
rất quá những các một mọi này kia đó ấy khi lúc nếu vì nên nhưng hay hoặc để tại
từ đến tới trong ngoài trên dưới về vào lại bởi do cả hãy đừng có ở`.split(/\s+/));
const PAGE_PUNCT = '.,!?;:…';
const strip = (text: string, chars: string) => {
  let start = 0, end = text.length;
  while (start < end && chars.includes(text[start])) start++;
  while (end > start && chars.includes(text[end - 1])) end--;
  return text.slice(start, end);
};

/** Cost of a caption page break between two tokens (lower = better). */
export function pageBreakCost(left: TimedCaption, right: TimedCaption) {
  const text = left.text.trim().replace(/["'”’)»\]]+$/u, '');
  if (PAGE_PUNCT.includes(text.slice(-1)) && text) return 0;
  const gap = right.startMs - left.endMs;
  if (gap >= 150) return 1;
  if ([left, right].some((token) => FUNCTION_WORDS.has(strip(token.text.trim(), PAGE_PUNCT + '"\'“”‘’()').toLowerCase()))) return 2;
  return gap >= 60 ? 3 : 4;
}

export function sourceCaptionPages(captions: TimedCaption[], maxChars = 20, maxMs = 2000) {
  const pages: TimedCaption[][] = [];
  let current: TimedCaption[] = [];
  const size = (text: string) => Array.from(text).length;
  for (const item of captions) {
    const text = item.text.trim();
    if (!text) continue;
    const token = {...item, text};
    const length = current.reduce((sum, word) => sum + size(word.text) + 1, 0);
    if (current.length && (length + size(text) > maxChars || item.endMs - current[0].startMs > maxMs)) {
      // Break one word earlier when the forced break splits a tight join and that is cheaper.
      const moved = current[current.length - 1];
      if (current.length >= 3 && pageBreakCost(current[current.length - 2], moved) < pageBreakCost(moved, token)
          && size(moved.text) + 1 + size(text) <= maxChars && item.endMs - moved.startMs <= maxMs) {
        pages.push(current.slice(0, -1)); current = [moved];
      } else {
        pages.push(current); current = [];
      }
    }
    current.push(token);
  }
  if (current.length) pages.push(current);
  return pages;
}

// Python round uses ties-to-even, unlike Math.round, for inactive RGB dimming.
const roundEven = (value: number) => value % 1 === .5
  ? (Math.floor(value) % 2 ? Math.ceil(value) : Math.floor(value)) : Math.round(value);
export function dimCaptionColor(color: string, opacity: number) {
  const factor = .5 + .5 * Math.max(.05, Math.min(1, opacity));
  return '#' + [1,3,5].map((offset) => roundEven(parseInt(color.slice(offset, offset + 2),16) * factor)
    .toString(16).padStart(2,'0')).join('');
}

export function captionFont(name = 'Verdana') {
  const key = name.trim().toLowerCase();
  const files: Record<string,string> = {
    verdana:'LiberationSans-Bold.ttf', arial:'LiberationSans-Bold.ttf', helvetica:'LiberationSans-Bold.ttf',
    'liberation sans':'LiberationSans-Bold.ttf', georgia:'LiberationSerif-Bold.ttf',
    'liberation serif':'LiberationSerif-Bold.ttf', impact:'Anton-Regular.ttf', anton:'Anton-Regular.ttf',
    montserrat:'Montserrat-ExtraBold.ttf', 'montserrat extrabold':'Montserrat-ExtraBold.ttf',
    'noto serif':'NotoSerif-Bold.ttf', 'noto serif bold':'NotoSerif-Bold.ttf',
  };
  return {family: 'SourceCaptionFont', file: files[key], requested: name};
}

export function captionMetrics(appearance: CaptionAppearance, height: number) {
  const scale = height / 288;
  return {fontSize: Math.max(10, Math.floor((appearance.fontSize ?? 16) * .85)) * scale,
    margin: 43 * scale, border: Math.max(1, Math.floor(appearance.borderWidth ?? 2)) * scale,
    scale};
}
