'use client';

import { EventEmitter } from 'events';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
const postUrlEmitter = new EventEmitter();

export const MediaSettingsLayout = () => {
  const [showPostSelector, setShowPostSelector] = useState(false);
  const [media, setMedia] = useState(undefined);
  const [callback, setCallback] = useState<{
    callback: (tag: {
      id: string;
      name: string;
      path: string;
      thumbnail: string;
      alt: string;
    }) => void;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  } | null>({
    callback: (params: {
      id: string;
      name: string;
      path: string;
      thumbnail: string;
      alt: string;
    }) => {},
  } as any);
  useEffect(() => {
    postUrlEmitter.on(
      'show',
      (params: {
        media: any;
        callback: (url: {
          id: string;
          name: string;
          path: string;
          thumbnail: string;
          alt: string;
        }) => void;
      }) => {
        setCallback(params);
        setMedia(params.media);
        setShowPostSelector(true);
      }
    );
    return () => {
      setShowPostSelector(false);
      setCallback(null);
      setMedia(undefined);
      postUrlEmitter.removeAllListeners();
    };
  }, []);
  const close = useCallback(() => {
    setShowPostSelector(false);
    setCallback(null);
    setMedia(undefined);
  }, []);
  if (!showPostSelector) {
    return <></>;
  }
  return (
    <MediaComponentInner
      media={media}
      onClose={close}
      onSelect={callback?.callback!}
    />
  );
};

export const useMediaSettings = () => {
  return useCallback((media: any) => {
    return new Promise((resolve) => {
      postUrlEmitter.emit('show', {
        media,
        callback: (value: any) => {
          resolve(value);
        },
      });
    });
  }, []);
};

export const CreateThumbnail: FC<{
  onSelect: (blob: Blob, timestampMs: number) => void;
  media:
    | {
        id: string;
        name: string;
        path: string;
        thumbnail?: string;
        alt?: string;
      }
    | undefined;
  altText?: string;
  onAltTextChange?: (altText: string) => void;
}> = (props) => {
  const { onSelect, media } = props;
  const { backendUrl } = useVariables();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(videoRef?.current?.duration);
    setIsLoaded(true);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(videoRef?.current?.currentTime);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const captureFrame = useCallback(async () => {
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setIsCapturing(false);
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get timestamp in milliseconds
      const timestampMs = Math.round(currentTime * 1000);

      // Convert canvas to blob
      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) {
            onSelect(blob, timestampMs);
          }
          setIsCapturing(false);
        },
        'image/jpeg',
        0.8
      );
    } catch (error) {
      console.error('Error capturing frame:', error);
      setIsCapturing(false);

      // Fallback: try to capture using a different approach
      try {
        const video = videoRef.current;
        if (video) {
          // Create a temporary canvas element
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');

          if (tempCtx) {
            tempCanvas.width = video.videoWidth;
            tempCanvas.height = video.videoHeight;
            tempCtx.drawImage(video, 0, 0);

            // Get timestamp in milliseconds
            const timestampMs = Math.round(currentTime * 1000);

            tempCanvas.toBlob(
              (blob: Blob | null) => {
                if (blob) {
                  onSelect(blob, timestampMs);
                }
                setIsCapturing(false);
              },
              'image/jpeg',
              0.8
            );
          }
        }
      } catch (fallbackError) {
        console.error('Fallback capture also failed:', fallbackError);
        alert(
          'Unable to capture frame. This might be due to CORS restrictions on the video source.'
        );
        setIsCapturing(false);
      }
    }
  }, [onSelect, currentTime]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  if (!media) return null;

  return (
    <div className="flex flex-col space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={
            backendUrl + '/public/stream?url=' + encodeURIComponent(media.path)
          }
          className="w-full h-[200px] object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          muted
          preload="metadata"
          crossOrigin="anonymous"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {isLoaded && (
        <>
          <div className="flex flex-col space-y-2">
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-fifth rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${
                  (currentTime / duration) * 100
                }%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`,
              }}
            />
            <div className="flex justify-between text-sm text-textColor">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={captureFrame}
              disabled={isCapturing}
              className="bg-forth text-white px-6 py-2 rounded-lg hover:bg-opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCapturing ? 'Đang trích xuất...' : 'Chọn khung hình này làm ảnh đại diện'}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export const MediaComponentInner: FC<{
  onClose: () => void;
  onSelect: (media: {
    id: string;
    name: string;
    path: string;
    thumbnail: string;
    alt: string;
  }) => void;
  media:
    | {
        id: string;
        name: string;
        path: string;
        thumbnail: string;
        alt: string;
        thumbnailTimestamp?: number;
      }
    | undefined;
}> = (props) => {
  const { onClose, onSelect, media } = props;
  const setActivateExitButton = useLaunchStore((e) => e.setActivateExitButton);
  const mediaDirectory = useMediaDirectory();
  const newFetch = useFetch();
  const [newThumbnail, setNewThumbnail] = useState<string | null>(null);
  const [isEditingThumbnail, setIsEditingThumbnail] = useState(false);
  const [altText, setAltText] = useState<string>(media?.alt || '');
  const [loading, setLoading] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(
    props.media?.thumbnail || null
  );
  const [thumbnailTimestamp, setThumbnailTimestamp] = useState<number | null>(
    props.media?.thumbnailTimestamp || null
  );

  const mediaUrl = media?.path ? mediaDirectory.set(media.path) : '';
  const isVideo = hasExtension(media?.path, 'mp4');

  useEffect(() => {
    setActivateExitButton(false);
    return () => {
      setActivateExitButton(true);
    };
  }, []);

  const save = useCallback(async () => {
    setLoading(true);
    let path = thumbnail || '';
    if (newThumbnail) {
      const blob = await (await fetch(newThumbnail)).blob();
      const formData = new FormData();
      formData.append('file', blob, 'media.jpg');
      formData.append('preventSave', 'true');
      const data = await (
        await newFetch('/media/upload-simple', {
          method: 'POST',
          body: formData,
        })
      ).json();
      path = data.path;
    }

    const updatedMedia = await (
      await newFetch('/media/information', {
        method: 'POST',
        body: JSON.stringify({
          id: props.media?.id,
          alt: altText,
          thumbnail: path,
          thumbnailTimestamp: thumbnailTimestamp,
        }),
      })
    ).json();

    onSelect(updatedMedia);
    onClose();
  }, [altText, newThumbnail, thumbnail, thumbnailTimestamp, props.media?.id, onSelect, onClose, newFetch]);

  if (isEditingThumbnail) {
    return (
      <div className="mt-[10px] flex flex-col gap-[16px]">
        <div className="flex justify-start">
          <button
            onClick={() => setIsEditingThumbnail(false)}
            className="text-textColor hover:text-white transition-colors flex items-center space-x-2 text-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 12H5M12 19L5 12L12 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Quay lại</span>
          </button>
        </div>

        <CreateThumbnail
          onSelect={(blob: Blob, timestampMs: number) => {
            const reader = new FileReader();
            reader.onload = () => {
              const url = URL.createObjectURL(blob);
              setNewThumbnail(url);
              setThumbnailTimestamp(timestampMs);
              setIsEditingThumbnail(false);
            };
            reader.readAsDataURL(blob);
          }}
          media={media}
          altText={altText}
          onAltTextChange={setAltText}
        />
      </div>
    );
  }

  return (
    <div className="mt-[6px] flex flex-col md:flex-row gap-[24px]">
      {/* CỘT TRÁI: MÀN HÌNH PREVIEW XEM ẢNH / VIDEO LỚN */}
      <div className="flex-1 flex flex-col gap-[10px]">
        <div className="flex items-center justify-between text-xs text-gray-400 font-medium px-1">
          <span className="flex items-center gap-1.5 text-gray-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {isVideo ? 'Xem trước Video' : 'Xem trước Hình ảnh'}
          </span>
          {mediaUrl && (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#10B981] hover:underline flex items-center gap-1 transition-colors"
            >
              <span>Xem ảnh gốc</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          )}
        </div>

        <div className="relative w-full h-[300px] md:h-[360px] bg-black/40 rounded-[12px] border border-tableBorder overflow-hidden flex items-center justify-center p-3 shadow-inner group">
          {isVideo ? (
            <video
              src={mediaUrl}
              controls
              className="max-w-full max-h-full rounded-[8px] object-contain shadow-md"
            />
          ) : (
            <img
              src={mediaUrl}
              alt={altText || 'Preview'}
              className="max-w-full max-h-full rounded-[8px] object-contain transition-transform duration-300 group-hover:scale-[1.01] shadow-md"
            />
          )}
        </div>

        {media?.name && (
          <div className="text-[12px] text-gray-400 truncate px-1 flex items-center gap-1.5" title={media.name}>
            <span className="text-gray-500">Tệp:</span>
            <span className="text-gray-300 font-mono truncate">{media.name}</span>
          </div>
        )}
      </div>

      {/* CỘT PHẢI: CÀI ĐẶT ALT TEXT & THUMBNAIL (TIẾNG VIỆT) */}
      <div className="w-full md:w-[320px] flex flex-col justify-between gap-[20px]">
        <div className="flex flex-col gap-[18px]">
          {/* Alt text field */}
          <div className="flex flex-col space-y-2">
            <label className="text-sm text-textColor font-medium flex items-center gap-1">
              <span>Văn bản thay thế (Alt Text)</span>
            </label>
            <p className="text-xs text-gray-400 leading-relaxed">
              Mô tả ngắn gọn nội dung hình ảnh giúp tối ưu hóa SEO và hỗ trợ người dùng khiếm thị nhận biết nội dung.
            </p>
            <textarea
              rows={4}
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Nhập mô tả chi tiết nội dung bức ảnh này..."
              className="w-full px-3 py-2.5 bg-fifth border border-tableBorder rounded-lg text-textColor placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent text-sm resize-none transition-all"
            />
          </div>

          {/* Phần Thumbnail nếu là video */}
          {isVideo && (
            <div className="flex flex-col gap-2 pt-2 border-t border-tableBorder/50">
              <span className="text-sm text-textColor font-medium">Ảnh đại diện video (Thumbnail):</span>
              {(newThumbnail || thumbnail) && (
                <div className="relative rounded-lg overflow-hidden border border-tableBorder max-h-[140px] flex items-center justify-center bg-black/40">
                  <img
                    src={newThumbnail || thumbnail!}
                    alt="Thumbnail hiện tại"
                    className="max-h-[140px] w-auto object-contain"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsEditingThumbnail(true)}
                  className="bg-third hover:bg-opacity-80 text-textColor px-3 py-2 rounded-lg text-xs font-medium flex-1 border border-tableBorder transition-all"
                >
                  {media?.thumbnail || newThumbnail ? 'Đổi ảnh đại diện' : 'Chọn ảnh đại diện'}
                </button>
                {(thumbnail || newThumbnail) && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setNewThumbnail(null);
                      setThumbnail(null);
                    }}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs font-medium border border-red-500/30 transition-all"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nút hành động Lưu & Hủy */}
        <div className="flex space-x-3 pt-4 border-t border-tableBorder/60">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 bg-gray-600/80 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg transition-all text-sm font-medium"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={save}
            className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2.5 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-1.5 shadow-md"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              'Lưu thay đổi'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
