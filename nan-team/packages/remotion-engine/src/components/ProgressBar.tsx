import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

export const ProgressBar: React.FC<{sceneDurations: number[]; top?: number; inset?: number}> =
  ({sceneDurations, top = 76, inset = 72}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  let start = 0;
  return <div style={{position: 'absolute', top, left: inset, right: inset, display: 'flex', gap: 9}}>
    {sceneDurations.map((duration, index) => {
      const progress = Math.max(0, Math.min(1, (frame - start) / duration));
      start += duration;
      return <div key={index} style={{flex: duration / durationInFrames, height: 5,
        borderRadius: 8, background: 'rgba(255,255,255,.25)', overflow: 'hidden'}}>
        <div style={{height: '100%', width: `${progress * 100}%`, backgroundColor: '#ffe075'}} />
      </div>;
    })}
  </div>;
};
