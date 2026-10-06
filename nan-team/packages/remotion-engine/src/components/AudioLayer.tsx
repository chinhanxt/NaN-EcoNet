import React from 'react';
import {Audio, interpolate, staticFile, useVideoConfig} from 'remotion';
import type {VideoProps} from '../types/schema';
import {resolveMediaSource} from './media-source';

export const AudioLayer: React.FC<Pick<VideoProps, 'audioPath' | 'bgmPath' | 'bgmVolume' | 'captions'>> =
  ({audioPath, bgmPath, bgmVolume = 0.15, captions}) => {
    const {fps, durationInFrames} = useVideoConfig();
    const musicVolume = (frame: number) => {
      const nowMs = frame / fps * 1000;
      // A short attack/release around real speech boundaries prevents pumping.
      let speech = 0;
      for (const cue of captions) {
        if (nowMs >= cue.startMs - 120 && nowMs <= cue.endMs + 240) {
          const attack = interpolate(nowMs, [cue.startMs - 120, cue.startMs], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const release = interpolate(nowMs, [cue.endMs, cue.endMs + 240], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          speech = Math.max(speech, Math.min(attack, release));
        }
      }
      // With no timing data, keep music quiet throughout the narration.
      if (!captions.length) speech = 1;
      const fade = Math.min(1, frame / fps, (durationInFrames - 1 - frame) / (fps * 0.7));
      return bgmVolume * (1 - speech * 0.7) * Math.max(0, fade);
    };
    return <>
      <Audio src={resolveMediaSource(audioPath)} volume={1} />
      <Audio src={bgmPath ? resolveMediaSource(bgmPath) : staticFile('audio/morning-ambient.mp3')}
        loop volume={musicVolume} loopVolumeCurveBehavior="extend" />
    </>;
  };
