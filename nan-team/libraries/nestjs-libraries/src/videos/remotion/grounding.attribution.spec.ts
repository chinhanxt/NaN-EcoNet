import { attributeFactSources, basisKey, sourceId, UNATTRIBUTED_BASIS } from './grounding.attribution';

const fact = (claim: string, basis: string) => ({ claim, basis, verified: false as const });

describe('attributeFactSources', () => {
  it('idea15 job 3a0ae677: one source cited for all 5 facts is not shown as their source', () => {
    const facts = [
      fact('Ngủ đủ 7–9 tiếng giúp củng cố trí nhớ.', 'National Science Foundation (NSF)'),
      fact('Ánh sáng xanh từ màn hình làm chậm tiết melatonin.', 'National Science Foundation (NSF)'),
      fact('Caffeine có thể còn tác dụng nhiều giờ sau khi uống.', 'NSF'),
      fact('Phòng ngủ mát giúp dễ ngủ sâu hơn.', 'https://www.nsf.gov/news/sleep'),
      fact('Giờ ngủ cố định giúp ổn định nhịp sinh học.', 'theo National Science Foundation (NSF)'),
    ];
    const result = attributeFactSources(facts);
    // "NSF", nsf.gov and "National Science Foundation (NSF)" are one source reused for every fact.
    expect(result.facts.map((f) => f.basis)).toEqual(Array(5).fill(UNATTRIBUTED_BASIS));
    expect(result.facts.map((f) => f.claim)).toEqual(facts.map((f) => f.claim));
    expect(result.facts.every((f) => f.verified === false)).toBe(true);
    expect(result.rejections).toEqual(Array(5).fill('blanket'));
  });
  it('a single URL reused for every fact is dropped for all of them', () => {
    const facts = ['A giúp B.', 'C giúp D.', 'E giúp F.', 'G giúp H.'].map((claim, i) => fact(claim, `https://example.org/page-${i}`));
    const result = attributeFactSources(facts);
    expect(result.facts.map((f) => f.basis)).toEqual(Array(4).fill(UNATTRIBUTED_BASIS));
    expect(result.unattributed).toBe(4);
  });
  it('keeps distinct per-fact sources and a source shared by only two facts', () => {
    const facts = [fact('Nước chiếm khoảng 60% trọng lượng cơ thể.', 'WHO'), fact('Mất nước 1–2% làm giảm tập trung.', 'EFSA'),
      fact('20–30% lượng nước đến từ thức ăn.', 'EFSA'), fact('Nước tiểu vàng nhạt là dấu hiệu đủ nước.', 'NHS')];
    expect(attributeFactSources(facts)).toEqual({ facts, unattributed: 0, rejections: [] });
  });
  it('a source named in the claim itself does not count as blanket reuse (live a134b487 EFSA facts)', () => {
    const efsa = 'Cơ quan An toàn Thực phẩm châu Âu (EFSA)';
    const facts = [fact('Nước chiếm khoảng 60% trọng lượng cơ thể.', 'WHO'), fact('Mất nước 1–2% làm giảm tập trung.', efsa),
      fact('EFSA khuyến nghị khoảng 2 lít nước mỗi ngày cho nữ.', efsa), fact('20–30% lượng nước đến từ thức ăn.', efsa),
      fact('Nước tiểu vàng nhạt là dấu hiệu đủ nước.', 'NHS'), fact('Uống một ly khi thức dậy giúp bù nước.', 'CDC')];
    expect(attributeFactSources(facts).unattributed).toBe(0);
  });
  it('one source for 3 of 4 facts is blanket; the claim that names the source keeps it', () => {
    const result = attributeFactSources([fact('WHO khuyến nghị 150 phút vận động mỗi tuần.', 'WHO'),
      fact('Đi bộ nhanh là vận động vừa phải.', 'WHO'), fact('Ngồi lâu làm giảm lưu thông máu.', 'WHO'), fact('Cây xanh lọc bụi mịn.', 'WHO')]);
    expect(result.facts.map((f) => f.basis)).toEqual(['WHO', UNATTRIBUTED_BASIS, UNATTRIBUTED_BASIS, UNATTRIBUTED_BASIS]);
  });
  it('generic or placeholder bases become "no specific source"', () => {
    const result = attributeFactSources([fact('A giúp B.', 'Các nghiên cứu khoa học'), fact('C giúp D.', 'unverified'),
      fact('E giúp F.', 'Theo chuyên gia'), fact('G giúp H.', 'general knowledge'), fact('I giúp K.', 'Bộ Y tế Việt Nam')]);
    expect(result.facts.map((f) => f.basis)).toEqual([...Array(4).fill(UNATTRIBUTED_BASIS), 'Bộ Y tế Việt Nam']);
    expect(result.rejections).toEqual(['generic', 'generic', 'generic', 'generic']);
  });
  it('normalizes keys (diacritics, "theo", URL host)', () => {
    expect(basisKey('Theo Bộ Y tế Việt Nam')).toBe(basisKey('bo y te viet nam'));
    expect(basisKey('http://www.who.int/news')).toBe('who.int');
    expect(sourceId('https://www.nsf.gov/x')).toBe(sourceId('National Science Foundation (NSF)'));
    expect(sourceId('US EPA')).not.toBe(sourceId('US DOE'));
    expect(attributeFactSources([fact('A giúp B.', 'https://www.who.int/news/item-1')]).facts[0].basis).toBe('who.int');
  });
});
