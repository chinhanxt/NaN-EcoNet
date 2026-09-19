import { useState } from 'react';
import { Box, Switch, FormControlLabel, Typography, Chip } from '@mui/material';

/**
 * Bảng màu nhận diện đồ cồng kềnh theo danh mục (YOLOv11 & Gemini Vision)
 */
export const CATEGORY_COLORS = {
  SOFA: '#059669', // Xanh ngọc lục bảo
  MATTRESS: '#2563eb', // Xanh đại dương
  CABINET: '#d97706', // Cam hổ phách
  TABLE: '#7c3aed', // Tím
  OTHER: '#0d9488', // Xanh mòng két
  HAZARDOUS: '#dc2626', // Đỏ cảnh báo rác nguy hại / cấm
};

export const CATEGORY_LABELS = {
  SOFA: 'Sofa / Ghế salon',
  MATTRESS: 'Đệm / Giường',
  CABINET: 'Tủ / Kệ',
  TABLE: 'Bàn / Ghế',
  OTHER: 'Đồ cồng kềnh khác',
  HAZARDOUS: 'Rác cấm / Nguy hại',
};

/**
 * Lấy mã màu dựa theo loại vật thể và cờ rác nguy hại
 */
export function getCategoryColor(box) {
  if (box?.isHazardous) return CATEGORY_COLORS.HAZARDOUS;
  const type = box?.itemType?.toUpperCase();
  return CATEGORY_COLORS[type] || CATEGORY_COLORS.OTHER;
}

/**
 * Định dạng độ tin cậy % (ví dụ: 0.96 -> 96%, 94 -> 94%)
 */
export function formatConfidence(confidence) {
  if (confidence == null || isNaN(confidence)) return '';
  const pct = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
  return pct > 0 ? `${pct}%` : '';
}

/**
 * Tạo nhãn tiếng Việt và độ tin cậy cho badge nổi
 */
export function getBoxBadgeText(box) {
  const name =
    box?.displayName ||
    CATEGORY_LABELS[box?.itemType?.toUpperCase()] ||
    box?.itemType ||
    'Vật dụng';
  const conf = formatConfidence(box?.confidence);
  return conf ? `${name} • ${conf}` : name;
}

/**
 * Tạo đường dẫn SVG bo góc cho phần nền badge mà không dùng thẻ <rect>
 * (giúp giữ nguyên số lượng <rect> strictly cho các bounding boxes)
 */
export function getRoundedRectPath(x, y, width, height, r = 6) {
  const radius = Math.min(r, width / 2, height / 2);
  return (
    `M ${x + radius} ${y} ` +
    `h ${width - 2 * radius} ` +
    `a ${radius} ${radius} 0 0 1 ${radius} ${radius} ` +
    `v ${height - 2 * radius} ` +
    `a ${radius} ${radius} 0 0 1 -${radius} ${radius} ` +
    `h -${width - 2 * radius} ` +
    `a ${radius} ${radius} 0 0 1 -${radius} -${radius} ` +
    `v -${height - 2 * radius} ` +
    `a ${radius} ${radius} 0 0 1 ${radius} -${radius} ` +
    `Z`
  );
}

/**
 * Chuẩn hoá tọa độ box_2d [ymin, xmin, ymax, xmax] sang thang đo 0..1000
 */
export function normalizeBoxCoordinates(box2d) {
  if (!Array.isArray(box2d) || box2d.length < 4) return null;
  const [yminRaw, xminRaw, ymaxRaw, xmaxRaw] = box2d;
  const isFloatScale = [yminRaw, xminRaw, ymaxRaw, xmaxRaw].every(
    (v) => typeof v === 'number' && v <= 1.0,
  );
  const scale = isFloatScale ? 1000 : 1;

  const ymin = Math.round(yminRaw * scale);
  const xmin = Math.round(xminRaw * scale);
  const ymax = Math.round(ymaxRaw * scale);
  const xmax = Math.round(xmaxRaw * scale);

  const x = Math.max(0, Math.min(1000, xmin));
  const y = Math.max(0, Math.min(1000, ymin));
  const width = Math.max(0, Math.min(1000 - x, xmax - xmin));
  const height = Math.max(0, Math.min(1000 - y, ymax - ymin));

  return { x, y, width, height, ymin, xmin, ymax, xmax };
}

/**
 * Component hiển thị ảnh kèm lớp phủ SVG Bounding Box trực quan (chuẩn YOLOv11 & Gemini Vision)
 *
 * @param {Object} props
 * @param {string|Object} props.image - URL hoặc object { dataUrl, filename, mimeType }
 * @param {Array} props.boxes - Mảng boxes [{ box_2d: [ymin, xmin, ymax, xmax], displayName, confidence, itemType, isHazardous }]
 * @param {number|null} props.selectedBoxIndex - Index của box đang được chọn hoặc hover
 * @param {Function} props.onSelectBox - Callback khi chọn hoặc hover (index: number | null)
 * @param {boolean} [props.showToggle=true] - Bật/tắt thanh điều khiển hiển thị khung
 * @param {boolean} [props.showBoxesToggle] - Alias hỗ trợ cho showToggle
 */
export function BulkyImageBoundingBoxOverlay({
  image,
  boxes = [],
  selectedBoxIndex = null,
  onSelectBox,
  showToggle = true,
  showBoxesToggle,
}) {
  const [isVisible, setIsVisible] = useState(true);

  const shouldShowToggle = (showBoxesToggle !== undefined ? showBoxesToggle : showToggle) !== false;

  const imageUrl = typeof image === 'string' ? image : image?.dataUrl || image?.url || '';

  const imageAlt =
    typeof image === 'object' && image?.filename ? image.filename : 'Ảnh vật dụng cồng kềnh';

  const validBoxes = Array.isArray(boxes) ? boxes : [];

  return (
    <Box sx={{ width: '100%', userSelect: 'none' }}>
      {/* Thanh điều khiển hiển thị khung AI */}
      {shouldShowToggle && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
            px: 0.5,
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                data-testid="bbox-toggle-switch"
                size="small"
                color="primary"
              />
            }
            label={
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: 'text.primary',
                }}
              >
                <span>👁️</span> Khung nhận diện AI
              </Typography>
            }
          />

          {validBoxes.length > 0 && (
            <Chip
              label={`${validBoxes.length} vật thể nhận diện`}
              size="small"
              color={isVisible ? 'primary' : 'default'}
              variant={isVisible ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          )}
        </Box>
      )}

      {/* Khung chứa ảnh và SVG Overlay */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
          lineHeight: 0,
        }}
      >
        <Box
          component="img"
          src={imageUrl}
          alt={imageAlt}
          data-testid="bounding-box-image"
          sx={{
            width: '100%',
            height: 'auto',
            display: 'block',
            objectFit: 'contain',
            maxHeight: 560,
          }}
        />

        {/* Lớp SVG Bounding Box chuẩn YOLOv11 */}
        {isVisible && validBoxes.length > 0 && (
          <svg
            data-testid="bounding-box-svg"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {/* Nhóm Bounding Box & Badge nhãn nổi tương tác */}
            {validBoxes.map((box, index) => {
              const coords = normalizeBoxCoordinates(box.box_2d);
              if (!coords) return null;
              const isSelected = selectedBoxIndex === index;
              const color = getCategoryColor(box);
              const labelText = getBoxBadgeText(box);

              const badgeHeight = 28;
              const badgeWidth = Math.max(110, Math.min(420, labelText.length * 10 + 24));
              const badgeX = Math.max(4, Math.min(coords.xmin, 1000 - badgeWidth - 4));
              const badgeY =
                coords.ymin >= badgeHeight + 6 ? coords.ymin - badgeHeight - 4 : coords.ymin + 6;

              return (
                <g
                  key={`bbox-group-${index}`}
                  style={{
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBox?.(index);
                  }}
                  onMouseEnter={() => onSelectBox?.(index)}
                  onMouseLeave={() => onSelectBox?.(null)}
                >
                  <rect
                    data-testid={`bbox-rect-${index}`}
                    x={coords.x}
                    y={coords.y}
                    width={coords.width}
                    height={coords.height}
                    rx="8"
                    stroke={color}
                    strokeWidth={isSelected ? 6 : 3}
                    strokeDasharray={box.isHazardous ? '10 5' : undefined}
                    fill={isSelected ? `${color}4d` : `${color}26`}
                    style={{
                      transition: 'all 0.15s ease-in-out',
                    }}
                  />
                  <g data-testid={`bbox-badge-${index}`}>
                    <path
                      d={getRoundedRectPath(badgeX, badgeY, badgeWidth, badgeHeight, 6)}
                      fill={color}
                      stroke={isSelected ? '#ffffff' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                      opacity={isSelected ? 1 : 0.94}
                    />
                    <text
                      x={badgeX + 10}
                      y={badgeY + 19}
                      fill="#ffffff"
                      fontSize="14"
                      fontWeight={isSelected ? '700' : '600'}
                      fontFamily="Roboto, Helvetica, Arial, sans-serif"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {labelText}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        )}
      </Box>
    </Box>
  );
}

export default BulkyImageBoundingBoxOverlay;
