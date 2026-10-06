import React from 'react';
import {AbsoluteFill, interpolate, OffthreadVideo, useCurrentFrame, useVideoConfig} from 'remotion';
import {SourceCaptions} from '../components/SourceCaptions';
import type {SourceVideoProps} from '../types/source-video';

/** Source audio/video stays intact; timed motion and overlays use clip-local time. */
export const SourceVideo: React.FC<SourceVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const seconds = frame / fps;
  const {design} = props;
  const zoom = design.zooms.find((item) => seconds >= item.startSeconds && seconds < item.endSeconds);
  const scale = zoom ? 1 + zoom.strength * interpolate(seconds,
    [zoom.startSeconds, (zoom.startSeconds + zoom.endSeconds) / 2, zoom.endSeconds], [0, 1, 0]) : 1;
  const opacity = design.transitions === 'fade' ? interpolate(frame,
    [0, Math.min(9, durationInFrames / 3), Math.max(durationInFrames - 9, durationInFrames * 2 / 3), durationInFrames - 1],
    [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  const compact = width >= height;
  const titleEntrance = interpolate(frame, [0, 12], [40, 0], {extrapolateRight: 'clamp'});

  return <AbsoluteFill style={{background: '#000', fontFamily: 'Arial, sans-serif'}}>
    <AbsoluteFill style={{overflow: 'hidden', opacity}}>
      <OffthreadVideo src={props.videoUrl} style={{width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${scale})`}} />
    </AbsoluteFill>
    {props.hook && seconds < Math.min(props.hookDurationSeconds, props.durationSeconds) &&
      <div style={{position: 'absolute', top: compact ? 48 : 180, left: 56, right: 56,
        display: 'flex', justifyContent: 'center'}}>
        <div style={{maxWidth: compact ? '75%' : '100%', padding: '18px 28px', borderRadius: 20,
          color: '#fff', background: design.theme === 'minimal' ? 'rgba(0,0,0,.6)' : design.accentColor,
          fontSize: compact ? 38 : 54, fontWeight: 800, textAlign: 'center', textShadow: '0 2px 6px #0008'}}>{props.hook}</div>
      </div>}
    {design.lowerThird && seconds < Math.min(6, props.durationSeconds) &&
      <div style={{position: 'absolute', left: 56, bottom: compact ? 190 : 470,
        maxWidth: '85%', padding: '16px 24px', color: '#fff', background: 'rgba(8,15,20,.85)',
        borderLeft: `6px solid ${design.accentColor}`, borderRadius: 10, fontSize: compact ? 30 : 40,
        transform: design.transitions === 'slide' ? `translateX(${titleEntrance}px)` : undefined}}>{design.lowerThird}</div>}
    <AbsoluteFill>
      <SourceCaptions captions={props.captions} captionStyle={props.captionStyle}
        captionAppearance={props.captionAppearance} />
    </AbsoluteFill>
  </AbsoluteFill>;
};
