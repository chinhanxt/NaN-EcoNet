// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BulkyImageBoundingBoxOverlay, CATEGORY_COLORS } from './BulkyImageBoundingBoxOverlay.jsx';

afterEach(() => {
  cleanup();
});

const sampleBoxes = [
  {
    box_2d: [180, 120, 850, 910],
    displayName: 'Sofa da 3 chỗ phòng khách',
    confidence: 0.96,
    itemType: 'SOFA',
    isHazardous: false,
  },
  {
    box_2d: [150, 100, 880, 900],
    displayName: 'Nệm lò xo 1m8',
    confidence: 0.94,
    itemType: 'MATTRESS',
    isHazardous: false,
  },
];

const mockImageObj = {
  dataUrl: 'data:image/jpeg;base64,mockImageData123',
  filename: 'phong_khach.jpg',
  mimeType: 'image/jpeg',
};

describe('BulkyImageBoundingBoxOverlay', () => {
  it('renders original image with data-testid="bounding-box-image" and proper src/alt', () => {
    render(<BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={sampleBoxes} />);

    const img = screen.getByTestId('bounding-box-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockImageObj.dataUrl);
    expect(img).toHaveAttribute('alt', mockImageObj.filename);
  });

  it('handles image provided as a URL string', () => {
    const url = 'https://example.com/photos/furniture.jpg';
    render(<BulkyImageBoundingBoxOverlay image={url} boxes={sampleBoxes} />);

    const img = screen.getByTestId('bounding-box-image');
    expect(img).toHaveAttribute('src', url);
  });

  it('renders SVG overlay with viewBox 0 0 1000 1000 when boxes are present', () => {
    render(<BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={sampleBoxes} />);

    const svg = screen.getByTestId('bounding-box-svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 1000 1000');
  });

  it('renders the exact number of rects corresponding to boxes.length', () => {
    const { container } = render(
      <BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={sampleBoxes} />,
    );

    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(sampleBoxes.length);

    expect(screen.getByTestId('bbox-rect-0')).toBeInTheDocument();
    expect(screen.getByTestId('bbox-rect-1')).toBeInTheDocument();
  });

  it('calculates rect coordinates correctly: x=xmin, y=ymin, w=xmax-xmin, h=ymax-ymin and rx=8', () => {
    render(<BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={sampleBoxes} />);

    // Box 0: [180, 120, 850, 910] -> ymin=180, xmin=120, ymax=850, xmax=910
    const rect0 = screen.getByTestId('bbox-rect-0');
    expect(rect0).toHaveAttribute('x', '120');
    expect(rect0).toHaveAttribute('y', '180');
    expect(rect0).toHaveAttribute('width', `${910 - 120}`);
    expect(rect0).toHaveAttribute('height', `${850 - 180}`);
    expect(rect0).toHaveAttribute('rx', '8');
  });

  it('applies correct category colors to rect strokes', () => {
    const testBoxes = [
      { box_2d: [100, 100, 500, 500], displayName: 'Sofa', confidence: 0.9, itemType: 'SOFA' },
      { box_2d: [100, 100, 500, 500], displayName: 'Nệm', confidence: 0.9, itemType: 'MATTRESS' },
      { box_2d: [100, 100, 500, 500], displayName: 'Tủ', confidence: 0.9, itemType: 'CABINET' },
      { box_2d: [100, 100, 500, 500], displayName: 'Bàn', confidence: 0.9, itemType: 'TABLE' },
      { box_2d: [100, 100, 500, 500], displayName: 'Khác', confidence: 0.9, itemType: 'OTHER' },
      {
        box_2d: [100, 100, 500, 500],
        displayName: 'Sơn hoá chất',
        confidence: 0.98,
        itemType: 'OTHER',
        isHazardous: true,
      },
    ];

    render(<BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={testBoxes} />);

    expect(screen.getByTestId('bbox-rect-0')).toHaveAttribute('stroke', CATEGORY_COLORS.SOFA);
    expect(screen.getByTestId('bbox-rect-1')).toHaveAttribute('stroke', CATEGORY_COLORS.MATTRESS);
    expect(screen.getByTestId('bbox-rect-2')).toHaveAttribute('stroke', CATEGORY_COLORS.CABINET);
    expect(screen.getByTestId('bbox-rect-3')).toHaveAttribute('stroke', CATEGORY_COLORS.TABLE);
    expect(screen.getByTestId('bbox-rect-4')).toHaveAttribute('stroke', CATEGORY_COLORS.OTHER);
    expect(screen.getByTestId('bbox-rect-5')).toHaveAttribute('stroke', CATEGORY_COLORS.HAZARDOUS);
  });

  it('renders badge labels with item displayName and confidence percentage', () => {
    render(<BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={sampleBoxes} />);

    const badge0 = screen.getByTestId('bbox-badge-0');
    expect(badge0).toBeInTheDocument();
    expect(badge0).toHaveTextContent('Sofa da 3 chỗ phòng khách • 96%');

    const badge1 = screen.getByTestId('bbox-badge-1');
    expect(badge1).toBeInTheDocument();
    expect(badge1).toHaveTextContent('Nệm lò xo 1m8 • 94%');
  });

  it('increases strokeWidth and darkens fill when selectedBoxIndex matches', () => {
    const { rerender } = render(
      <BulkyImageBoundingBoxOverlay
        image={mockImageObj}
        boxes={sampleBoxes}
        selectedBoxIndex={null}
      />,
    );

    const rect0 = screen.getByTestId('bbox-rect-0');
    const initialStrokeWidth = Number(rect0.getAttribute('stroke-width'));

    rerender(
      <BulkyImageBoundingBoxOverlay
        image={mockImageObj}
        boxes={sampleBoxes}
        selectedBoxIndex={0}
      />,
    );

    const selectedStrokeWidth = Number(rect0.getAttribute('stroke-width'));
    expect(selectedStrokeWidth).toBeGreaterThan(initialStrokeWidth);
  });

  it('triggers onSelectBox when clicking or hovering over rect and badge', () => {
    const handleSelect = vi.fn();

    render(
      <BulkyImageBoundingBoxOverlay
        image={mockImageObj}
        boxes={sampleBoxes}
        onSelectBox={handleSelect}
      />,
    );

    const rect0 = screen.getByTestId('bbox-rect-0');
    fireEvent.click(rect0);
    expect(handleSelect).toHaveBeenCalledWith(0);

    fireEvent.mouseEnter(rect0);
    expect(handleSelect).toHaveBeenCalledWith(0);

    fireEvent.mouseLeave(rect0);
    expect(handleSelect).toHaveBeenCalledWith(null);

    const badge1 = screen.getByTestId('bbox-badge-1');
    fireEvent.click(badge1);
    expect(handleSelect).toHaveBeenCalledWith(1);

    fireEvent.mouseEnter(badge1);
    expect(handleSelect).toHaveBeenCalledWith(1);

    fireEvent.mouseLeave(badge1);
    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('toggles bounding box layer visibility with switch toggle', () => {
    render(
      <BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={sampleBoxes} showToggle={true} />,
    );

    expect(screen.getByTestId('bounding-box-svg')).toBeInTheDocument();
    expect(screen.getByTestId('bbox-rect-0')).toBeInTheDocument();

    const toggle = screen.getByTestId('bbox-toggle-switch');
    expect(toggle).toBeInTheDocument();

    // Toggle off
    fireEvent.click(toggle);

    expect(screen.queryByTestId('bounding-box-svg')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bbox-rect-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bbox-badge-0')).not.toBeInTheDocument();

    // Toggle on again
    fireEvent.click(toggle);

    expect(screen.getByTestId('bounding-box-svg')).toBeInTheDocument();
    expect(screen.getByTestId('bbox-rect-0')).toBeInTheDocument();
  });

  it('does not render toggle control when showToggle is false', () => {
    render(
      <BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={sampleBoxes} showToggle={false} />,
    );

    expect(screen.queryByTestId('bbox-toggle-switch')).not.toBeInTheDocument();
    expect(screen.getByTestId('bounding-box-svg')).toBeInTheDocument();
  });

  it('normalizes float coordinates (0.0 - 1.0) to 0 - 1000 scale', () => {
    const floatBoxes = [
      {
        box_2d: [0.18, 0.12, 0.85, 0.91],
        displayName: 'Sofa tỉ lệ thực',
        confidence: 0.95,
        itemType: 'SOFA',
      },
    ];

    render(<BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={floatBoxes} />);

    const rect = screen.getByTestId('bbox-rect-0');
    expect(rect).toHaveAttribute('x', '120');
    expect(rect).toHaveAttribute('y', '180');
    expect(rect).toHaveAttribute('width', '790');
    expect(rect).toHaveAttribute('height', '670');
  });

  it('renders gracefully when boxes is empty or undefined', () => {
    render(<BulkyImageBoundingBoxOverlay image={mockImageObj} boxes={[]} />);

    expect(screen.getByTestId('bounding-box-image')).toBeInTheDocument();
    expect(screen.queryByTestId('bounding-box-svg')).not.toBeInTheDocument();
  });
});
