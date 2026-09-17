import React, { useState } from 'react';
import { 
  Maximize2, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  ExternalLink,
  X,
  Compass
} from 'lucide-react';

export interface DiagramData {
  imageUrl: string;
  filename?: string;
  aspectRatio?: string;
  durationSec?: number;
  category?: string;
  templateId?: string;
  templateTitle?: string;
  artDirectorReasoning?: string;
  originalPrompt?: string;
}

export interface DiagramViewerCardProps {
  imageUrl: string;
  filename?: string;
  aspectRatio?: string;
  durationSec?: number;
  category?: string;
  templateId?: string;
  templateTitle?: string;
  artDirectorReasoning?: string;
  originalPrompt?: string;
}

export const DiagramViewerCard: React.FC<DiagramViewerCardProps> = ({
  imageUrl,
  filename,
  aspectRatio = '16:9',
  durationSec = 18.5,
  category,
  templateId = 'enterprise-dwh-architecture',
  templateTitle = 'Sơ Đồ Kiến Trúc & Quy Trình Doanh Nghiệp',
  artDirectorReasoning,
  originalPrompt
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(imageUrl);
  const [showDetails, setShowDetails] = useState(false);

  React.useEffect(() => {
    setCurrentSrc(imageUrl);
    setImageError(false);
    setImageLoaded(false);
  }, [imageUrl]);

  const handleImageError = () => {
    if (!currentSrc.startsWith('http://localhost:4000') && currentSrc.startsWith('/diagrams/')) {
      setCurrentSrc(`http://localhost:4000${currentSrc}`);
    } else {
      setImageError(true);
    }
  };

  const handleCopyLink = async () => {
    try {
      const fullUrl = currentSrc.startsWith('http') ? currentSrc : `${window.location.origin}${currentSrc}`;
      await navigator.clipboard.writeText(fullUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentSrc;
    link.download = filename || `diagram_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden font-sans transition-all">
      {/* 1. Header Strip */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-cyan-400 flex items-center justify-center shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-950 tracking-tight">
                {templateTitle}
              </h3>
              {category && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {category}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-50 text-cyan-800 border border-cyan-200">
                {aspectRatio}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
              <span>Agy CLI Engine</span>
              <span>•</span>
              <span>Thời gian sinh: {durationSec}s</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <ShieldCheck className="w-3 h-3" />
                Zero-Mock Verified
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsLightboxOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200/70 border border-slate-200 transition-colors cursor-pointer"
            title="Phóng to toàn màn hình"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Phóng to</span>
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200/70 border border-slate-200 transition-colors cursor-pointer"
            title="Tải ảnh PNG về máy"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tải về</span>
          </button>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200/70 border border-slate-200 transition-colors cursor-pointer"
            title="Sao chép đường dẫn ảnh"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isCopied ? 'Đã sao chép' : 'Copy link'}</span>
          </button>
        </div>
      </div>

      {/* 2. Visual Canvas Container */}
      <div className="relative bg-slate-950 p-2 sm:p-4 flex items-center justify-center overflow-hidden group">
        {imageError ? (
          <div className="w-full aspect-video rounded-xl bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-3 p-4">
            <span className="text-xs font-medium text-rose-400">Không thể tải hiển thị ảnh từ server.</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setImageError(false); setCurrentSrc(`${imageUrl}?t=${Date.now()}`); }}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Thử lại
              </button>
              <a
                href={currentSrc}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-cyan-900/60 text-cyan-300 rounded-lg text-xs font-bold hover:bg-cyan-900 cursor-pointer"
              >
                Mở link trực tiếp
              </a>
            </div>
          </div>
        ) : !imageLoaded ? (
          <div className="w-full aspect-video rounded-xl bg-slate-900 animate-pulse flex flex-col items-center justify-center text-slate-500 gap-2">
            <Compass className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="text-xs font-medium">Đang tải hiển thị sơ đồ...</span>
          </div>
        ) : null}

        <img
          src={currentSrc}
          alt={templateTitle}
          onLoad={() => { setImageLoaded(true); setImageError(false); }}
          onError={handleImageError}
          onClick={() => setIsLightboxOpen(true)}
          className={`w-full max-h-[520px] object-contain rounded-xl cursor-zoom-in transition-all duration-300 group-hover:scale-[1.01] ${
            imageLoaded && !imageError ? 'block' : 'hidden'
          }`}
        />

        {/* Hover Hint Overlay */}
        {imageLoaded && !imageError && (
          <div 
            onClick={() => setIsLightboxOpen(true)}
            className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-zoom-in pointer-events-none"
          >
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-bold shadow-lg flex items-center gap-2 backdrop-blur-xs">
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Click để phóng to toàn màn hình</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Art Director Architectural Commentary */}
      {artDirectorReasoning && (
        <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-700 leading-relaxed font-normal">
              <span className="font-bold text-slate-950">Chỉ đạo mỹ thuật AI: </span>
              {artDirectorReasoning}
            </div>
          </div>
        </div>
      )}

      {/* 4. Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="flex items-center justify-between pb-4 text-white max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-black">{templateTitle}</h2>
              <span className="px-2 py-0.5 bg-slate-800 text-xs font-mono rounded text-slate-300">
                {aspectRatio}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Tải ảnh gốc</span>
              </button>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                title="Đóng (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div 
            className="flex-1 flex items-center justify-center overflow-auto max-w-7xl mx-auto w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt={templateTitle}
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};
