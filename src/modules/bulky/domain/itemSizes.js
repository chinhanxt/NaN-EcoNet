export const ITEM_SIZES = Object.freeze({
  SOFA: { SMALL: 'Sofa đơn', MEDIUM: 'Sofa 2 chỗ', LARGE: 'Sofa 3 chỗ' },
  MATTRESS: {
    SMALL: 'Nệm rộng đến 1 m',
    MEDIUM: 'Nệm rộng trên 1 m đến 1,6 m',
    LARGE: 'Nệm rộng trên 1,6 m đến 1,8 m',
  },
  CABINET: {
    SMALL: 'Tủ: cạnh dài nhất đến 1 m',
    MEDIUM: 'Tủ: cạnh dài nhất trên 1 m đến 1,8 m',
    LARGE: 'Tủ: cạnh dài nhất trên 1,8 m đến 2 m',
  },
  TABLE: {
    SMALL: 'Bàn/ghế: cạnh dài nhất đến 1 m',
    MEDIUM: 'Bàn: cạnh dài nhất trên 1 m đến 1,6 m',
    LARGE: 'Bàn: cạnh dài nhất trên 1,6 m đến 2 m',
  },
});

export function needsItemReview(items = [], recognition = {}) {
  return Boolean(
    recognition.requiresManualReview ||
    recognition.decision === 'MANUAL_REVIEW' ||
    recognition.containsHazardousWaste ||
    recognition.containsConstructionWaste ||
    !items.length ||
    items.some(
      (item) =>
        item.oversize || !ITEM_SIZES[item.catalogItemCode || item.itemType]?.[item.sizeCode],
    ),
  );
}

export const PRICE_CHANGE_NOTICE =
  'Giá áp dụng cho loại đồ, số lượng, kích thước và điều kiện bốc xếp đã xác nhận. Nếu thực tế khác khai báo, nhân viên phải giải thích và được bạn đồng ý mức phí mới trước khi thực hiện.';
