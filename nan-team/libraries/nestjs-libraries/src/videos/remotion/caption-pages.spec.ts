import { buildCaptionPages } from '../../../../../packages/remotion-engine/src/components/caption-pages';

const words = (items: Array<[string, number, number]>) => items.map(([text, startMs, endMs]) => ({ text, startMs, endMs }));

describe('idea video caption pages', () => {
  it('does not split the Vietnamese compound "xe tải" across pages', () => {
    // 9 gapless tokens -> 2 even pages cut at 5 ("... bị xe | tải ..."); the cut moves before "xe".
    const tokens = words([['Lan', 0, 200], ['Ngọc', 200, 400], ['từng', 400, 600], ['bị', 600, 800], ['xe', 800, 1000],
      ['tải', 1000, 1200], ['tông', 1200, 1400], ['khi', 1400, 1600], ['quay', 1600, 1800]]);
    const pages = buildCaptionPages(tokens).map((page) => page.tokens.map((t) => t.text).join(' '));
    expect(pages).toEqual(['Lan Ngọc từng bị', 'xe tải tông khi quay']);
  });
  it('keeps even cuts when no cheaper neighbour exists', () => {
    const tokens = words(Array.from({ length: 10 }, (_, i) => [`từ${i}`, i * 200, i * 200 + 200] as [string, number, number]));
    expect(buildCaptionPages(tokens).map((page) => page.tokens.length)).toEqual([5, 5]);
  });
});
