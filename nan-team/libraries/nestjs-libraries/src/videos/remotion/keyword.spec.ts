import { isKeywordToken } from '../../../../../packages/remotion-engine/src/components/keyword';

describe('Vietnamese caption keyword phrases', () => {
  it('accents each constituent token, preserving Vietnamese diacritics', () => {
    expect(isKeywordToken('Gòn,', 'Bình minh gõ cửa Sài Gòn')).toBe(true);
    expect(isKeywordToken('BÌNH', 'Bình minh gõ cửa Sài Gòn')).toBe(true);
    expect(isKeywordToken('ban', 'Bình minh gõ cửa Sài Gòn')).toBe(false);
  });
  it('requires whole tokens and ignores empty punctuation', () => {
    expect(isKeywordToken('minh', 'bình minh')).toBe(true);
    expect(isKeywordToken('min', 'bình minh')).toBe(false);
    expect(isKeywordToken(',', ',')).toBe(false);
    expect(isKeywordToken('xanh')).toBe(false);
  });
});
