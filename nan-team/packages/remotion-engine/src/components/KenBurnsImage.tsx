import React from 'react';
import {AbsoluteFill, Img, interpolate, useCurrentFrame} from 'remotion';
import {resolveMediaSource} from './media-source';

export interface KenBurnsImageProps {
  src: string;
  durationInFrames: number;
  sceneIndex: number;
  fadeInFrames?: number;
}

export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({src, durationInFrames, sceneIndex, fadeInFrames = 0}) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const reverse = sceneIndex % 2 === 1;
  const scale = interpolate(progress, [0, 1], reverse ? [1.2, 1.08] : [1.08, 1.2]);
  const pan = interpolate(progress, [0, 1], reverse ? [22, -22] : [-22, 22]);
  // Later scenes dissolve over the previous scene, which is held underneath.
  const reveal = fadeInFrames > 0
    ? interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: fadeInFrames > 0 ? 'transparent' : '#080b13', opacity: reveal}}>
    <Img src={resolveMediaSource(src)} style={{width: '100%', height: '100%', objectFit: 'cover',
      transform: `translate(${pan}px, ${-pan * 0.5}px) scale(${scale})`}} />
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(3,7,18,.5) 0%, transparent 35%, rgba(3,7,18,.12) 55%, rgba(3,7,18,.86) 100%)'}} />
    <AbsoluteFill style={{boxShadow: 'inset 0 0 190px rgba(0,0,0,.3)'}} />
  </AbsoluteFill>;
};
