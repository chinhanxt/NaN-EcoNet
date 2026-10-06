import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {AudioLayer} from '../components/AudioLayer';
import {KenBurnsImage} from '../components/KenBurnsImage';
import {ProgressBar} from '../components/ProgressBar';
import {TikTokSubtitles} from '../components/TikTokSubtitles';
import {videoSchema, type VideoProps} from '../types/schema';
import '../style.css';

export const TikTokVideo: React.FC<VideoProps> = (input) => {
  const props = videoSchema.parse(input);
  const theme = props.theme;
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  let cursor = 0;
  const sceneIndex = props.scenes.findIndex((scene) => {
    cursor += scene.durationInFrames;
    return frame < cursor;
  });
  const scene = props.scenes[Math.max(0, sceneIndex)];
  const sceneStarts = props.scenes.map((_, index) =>
    props.scenes.slice(0, index).reduce((sum, item) => sum + item.durationInFrames, 0));
  const shortestScene = Math.min(...props.scenes.map((item) => item.durationInFrames));
  const transitionFrames = Math.max(0, Math.min(Math.round(fps * 0.4), Math.floor(shortestScene / 3)));
  const openingOpacity = interpolate(frame, [0, 8, fps * 2.7, fps * 3.1], [0, 1, 1, 0], {extrapolateRight: 'clamp'});

  const isLandscape = width > height;
  const isSquare = width === height;
  const titleSize = isLandscape
    ? (props.title.length > 80 ? 44 : props.title.length > 45 ? 54 : 64)
    : isSquare
      ? (props.title.length > 80 ? 46 : props.title.length > 45 ? 56 : 68)
      : (props.title.length > 80 ? 65 : props.title.length > 45 ? 76 : 90);

  // Progress bar sits above the badge; both stay clear of each other at every ratio.
  const progressTop = isLandscape ? 28 : isSquare ? 30 : 76;
  const badgeTop = isLandscape ? 50 : isSquare ? 56 : 114;
  const badgeLeft = isLandscape ? 60 : isSquare ? 60 : 72;
  const badgeFontSize = isLandscape ? 18 : isSquare ? 20 : 25;

  const titleTop = isLandscape ? 110 : isSquare ? 130 : 245;
  const titleLeft = isLandscape ? 60 : isSquare ? 60 : 72;
  const titleRight = isLandscape ? 100 : isSquare ? 100 : 148;

  const showProgressBar = theme?.showProgressBar !== false;
  const showBadge = theme?.showBadge === true;
  const accentColor = theme?.accentColor || '#ffe075';
  // The title sits on arbitrary imagery (bright windows, sky): it is always white on a
  // dark scrim so a light theme colour can never wash it out; the accent bar keeps the theme.
  const titleColor = '#fff';

  return <AbsoluteFill style={{backgroundColor: '#080b13', fontFamily: 'VideoSans, sans-serif', overflow: 'hidden'}}>
    {sceneStarts.map((start, index) => {
      const item = props.scenes[index];
      // Each scene is held under the next one while it dissolves in, so cuts
      // cross-fade without shifting narration-aligned scene boundaries.
      const hold = index < props.scenes.length - 1 ? transitionFrames : 0;
      return <Sequence key={index} from={start} durationInFrames={item.durationInFrames + hold}>
        <KenBurnsImage src={item.imagePath} durationInFrames={item.durationInFrames + hold} sceneIndex={index}
          fadeInFrames={index === 0 ? 0 : transitionFrames} />
      </Sequence>;
    })}
    <AbsoluteFill style={{opacity: openingOpacity, pointerEvents: 'none',
      background: `linear-gradient(to bottom, rgba(4,6,12,.72) 0%, rgba(4,6,12,.5) ${isLandscape ? 45 : 30}%, rgba(4,6,12,0) ${isLandscape ? 70 : 48}%)`}} />
    {showProgressBar && (
      <ProgressBar sceneDurations={props.scenes.map((item) => item.durationInFrames)} top={progressTop} inset={badgeLeft} />
    )}
    {/* The scene counter is an intro cue only; the progress bar carries position afterwards. */}
    {showBadge && openingOpacity > 0 && (
      <div style={{position: 'absolute', top: badgeTop, opacity: openingOpacity, left: badgeLeft, right: titleRight, display: 'flex',
        alignItems: 'center', gap: 18, color: '#fff', fontSize: badgeFontSize, letterSpacing: 3, textTransform: 'uppercase'}}>
        <span style={{color: accentColor}}>{String(Math.max(0, sceneIndex) + 1).padStart(2, '0')}</span>
        <span style={{height: 1, width: 40, background: 'rgba(255,255,255,.5)'}} />
        <span>{props.scenes.length.toString().padStart(2, '0')} CẢNH</span>
      </div>
    )}
    <div style={{position: 'absolute', left: titleLeft, right: titleRight, top: titleTop, opacity: openingOpacity,
      transform: `translateY(${interpolate(frame, [0, 15], [24, 0], {extrapolateRight: 'clamp'})}px)`}}>
      <div style={{width: 70, height: 7, background: accentColor, marginBottom: isLandscape ? 16 : 30, borderRadius: 8}} />
      <div style={{fontSize: titleSize, lineHeight: 1.15, color: titleColor, letterSpacing: -2,
        fontWeight: 700, textWrap: 'balance',
        textShadow: '0 2px 4px rgba(0,0,0,.85), 0 0 2px rgba(0,0,0,.9), 0 6px 32px rgba(0,0,0,.7)'}}>{props.title}</div>
    </div>
    <TikTokSubtitles
      captions={props.captions}
      keyword={scene.keyword}
      subtitleStyle={theme?.subtitleStyle}
      primaryColor={theme?.primaryColor}
      accentColor={theme?.accentColor}
    />
    <AudioLayer audioPath={props.audioPath} captions={props.captions} bgmPath={props.bgmPath} bgmVolume={props.bgmVolume} />
  </AbsoluteFill>;
};
