import type {TimedCaption} from '../types/schema';
import {pageBreakCost} from './source-caption-model';

export interface CaptionPage {
  tokens: TimedCaption[];
  startMs: number;
  endMs: number;
}

// Group timed tokens without inventing word timestamps. A provider returning
// phrase cues highlights each complete phrase at its supplied time interval.
// Pages follow spoken phrases (punctuation or pauses); a long phrase is split
// into evenly sized pages instead of leaving a dangling one-word page; an even
// cut moves by one token when that avoids splitting a tight join (pageBreakCost).
export const buildCaptionPages = (captions: TimedCaption[]): CaptionPage[] => {
  const phrases: TimedCaption[][] = [];
  let phrase: TimedCaption[] = [];
  for (const token of captions) {
    const text = token.text.trim();
    if (!text) continue;
    const previous = phrase[phrase.length - 1];
    if (previous && token.startMs - previous.endMs > 350) { phrases.push(phrase); phrase = []; }
    phrase.push({...token, text});
    if (/[.!?…,;:]$/.test(text)) { phrases.push(phrase); phrase = []; }
  }
  if (phrase.length) phrases.push(phrase);
  const pages: CaptionPage[] = [];
  const fits = (slice: TimedCaption[]) => slice.length > 0 && slice.length <= 8 &&
    slice.reduce((sum, item) => sum + item.text.length + 1, -1) <= 40 &&
    slice[slice.length - 1].endMs - slice[0].startMs <= 2800;
  for (const tokens of phrases) {
    const chars = tokens.reduce((sum, item) => sum + item.text.length + 1, -1);
    const count = Math.max(1, Math.ceil(tokens.length / 8), Math.ceil(chars / 40),
      Math.ceil((tokens[tokens.length - 1].endMs - tokens[0].startMs) / 2800));
    const cuts = [0];
    for (let index = 1; index < count; index++) {
      // Shift an even cut by one token when that avoids splitting a tight join (e.g. "xe | tải").
      const even = Math.round(index * tokens.length / count);
      const next = Math.round((index + 1) * tokens.length / count);
      let best = even;
      for (const cut of even > 0 && even < tokens.length ? [even - 1, even + 1] : []) {
        if (cut <= cuts[cuts.length - 1] || cut >= next || cut <= 0 || cut >= tokens.length) continue;
        if (!fits(tokens.slice(cuts[cuts.length - 1], cut)) || !fits(tokens.slice(cut, next))) continue;
        if (pageBreakCost(tokens[cut - 1], tokens[cut]) < pageBreakCost(tokens[best - 1], tokens[best])) best = cut;
      }
      cuts.push(best);
    }
    cuts.push(tokens.length);
    for (let index = 0; index + 1 < cuts.length; index++) {
      const slice = tokens.slice(cuts[index], cuts[index + 1]);
      if (slice.length) pages.push({tokens: slice, startMs: slice[0].startMs, endMs: slice[slice.length - 1].endMs});
    }
  }
  return pages;
};
