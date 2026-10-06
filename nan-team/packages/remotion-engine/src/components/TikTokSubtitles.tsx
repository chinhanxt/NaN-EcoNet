import React, {useMemo} from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TimedCaption} from '../types/schema';
import {isKeywordToken} from './keyword';
import {buildCaptionPages} from './caption-pages';

export {buildCaptionPages} from './caption-pages';
export type {CaptionPage} from './caption-pages';

export interface TikTokSubtitlesProps {
  captions: TimedCaption[];
  keyword?: string;
  subtitleStyle?: 'clean_shadow' | 'dark_pill' | 'pop_karaoke';
  primaryColor?: string;
  accentColor?: string;
}

function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0;
  const digits = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(digits.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const TikTokSubtitles: React.FC<TikTokSubtitlesProps> = ({
  captions,
  keyword,
  subtitleStyle = 'clean_shadow',
  primaryColor,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const nowMs = frame / fps * 1000;
  const pages = useMemo(() => buildCaptionPages(captions), [captions]);
  const page = pages.find((item) => nowMs >= item.startMs && nowMs < item.endMs);
  if (!page) return null;
  const entrance = interpolate(nowMs - page.startMs, [0, 100], [12, 0], {extrapolateRight: 'clamp'});

  const isLandscape = width > height;
  const isSquare = width === height;
  const bottom = isLandscape ? 80 : isSquare ? 110 : 330;
  const fontSize = isLandscape ? 44 : isSquare ? 42 : 62;
  const maxWidth = isLandscape ? 1400 : isSquare ? 880 : 850;
  const padding = isLandscape ? '14px 28px' : isSquare ? '14px 24px' : '18px 26px';

  const isCleanShadow = subtitleStyle === 'clean_shadow';
  const isDarkPill = subtitleStyle === 'dark_pill';
  const isPopKaraoke = subtitleStyle === 'pop_karaoke';

  const activeColor = accentColor || '#FFE075';
  // primaryColor is a theme/brand colour and is often dark (e.g. navy); caption text must stay
  // readable over imagery, so only a light primary colour is used for resting words.
  const textColor = primaryColor && relativeLuminance(primaryColor) >= 0.6 ? primaryColor : '#fff';

  const containerStyle: React.CSSProperties = {
    color: textColor,
    fontSize,
    fontWeight: 700,
    lineHeight: 1.35,
    textAlign: 'center',
    textWrap: 'balance',
    maxWidth,
    padding,
    borderRadius: 28,
    backgroundColor: isCleanShadow ? 'transparent' : isDarkPill ? 'rgba(7,12,23,.68)' : 'rgba(7,12,23,.68)',
    boxShadow: isCleanShadow ? 'none' : '0 16px 60px rgba(0,0,0,.25)',
    textShadow: isCleanShadow
      ? '0 2px 14px rgba(0,0,0,0.95), 0 4px 28px rgba(0,0,0,0.9)'
      : '0 3px 8px rgba(0,0,0,.85)',
    WebkitTextStroke: isCleanShadow ? '1px rgba(0,0,0,0.85)' : undefined,
    paintOrder: isCleanShadow ? 'stroke fill' : undefined,
  };

  return <div style={{position: 'absolute', left: 40, right: 40, bottom,
    display: 'flex', justifyContent: 'center', transform: `translateY(${entrance}px)`}}>
    <div style={containerStyle}>
      {page.tokens.map((token, index) => {
        const active = nowMs >= token.startMs && nowMs < token.endMs;
        const accent = isKeywordToken(token.text, keyword);
        const tokenColor = active ? activeColor : accent ? '#abf5dd' : textColor;
        const tokenTransform = active
          ? (isPopKaraoke ? 'scale(1.14)' : 'scale(1.06)')
          : undefined;
        const tokenTextShadow = active
          ? (isCleanShadow
              ? '0 2px 14px rgba(0,0,0,0.95), 0 4px 28px rgba(0,0,0,0.9)'
              : '0 3px 14px rgba(0,0,0,.9)')
          : undefined;

        return <React.Fragment key={`${token.startMs}-${index}`}>
          {index > 0 ? ' ' : null}
          <span style={{
            display: 'inline-block',
            color: tokenColor,
            transform: tokenTransform,
            textShadow: tokenTextShadow,
          }}>{token.text}</span>
        </React.Fragment>;
      })}
    </div>
  </div>;
};
