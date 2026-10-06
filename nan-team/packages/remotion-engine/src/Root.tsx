import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';
import {TikTokVideo} from './compositions/TikTokVideo';
import {SourceVideo} from './compositions/SourceVideo';
import {sourceVideoMetadata, type SourceVideoProps} from './types/source-video';
import {ASPECT_RATIOS, getDurationInFrames, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, videoSchema, type VideoProps} from './types/schema';

export const calculateVideoMetadata: CalculateMetadataFunction<VideoProps> = ({props}) => {
  const validated = videoSchema.parse(props);
  const ratio = validated.aspectRatio || '9:16';
  const defaultDim = ASPECT_RATIOS[ratio] || ASPECT_RATIOS['9:16'];
  const width = validated.width || defaultDim.width;
  const height = validated.height || defaultDim.height;
  return {durationInFrames: getDurationInFrames(validated), fps: VIDEO_FPS,
    width, height, props: validated};
};

const defaultProps: VideoProps = {
  title: 'Mỗi khoảnh khắc, một câu chuyện',
  scenes: [{imagePath: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#193449"/><stop offset="1" stop-color="#090c18"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><circle cx="650" cy="800" r="340" fill="#37616b" opacity=".3"/></svg>'), durationInFrames: 900, text: ''}],
  // Silent WAV keeps Studio usable before narration assets are supplied.
  audioPath: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==',
  captions: [],
};

const sourceDefaults: SourceVideoProps = {videoUrl: 'http://127.0.0.1:9/source.mp4',
  durationSeconds: 2, aspectRatio: '9:16', title: '', captions: [], captionStyle: 'karaoke', hookDurationSeconds: 5,
  design: {theme: 'clean', transitions: 'none', accentColor: '#10b981', zooms: []}};

export const RemotionRoot: React.FC = () => <>
<Composition
  id="TikTokVideo" component={TikTokVideo} fps={VIDEO_FPS} width={VIDEO_WIDTH}
  height={VIDEO_HEIGHT} durationInFrames={900} defaultProps={defaultProps}
  calculateMetadata={calculateVideoMetadata}
/>
<Composition id="SourceVideo" component={SourceVideo} fps={VIDEO_FPS} width={VIDEO_WIDTH}
  height={VIDEO_HEIGHT} durationInFrames={60} defaultProps={sourceDefaults}
  calculateMetadata={({props}) => sourceVideoMetadata(props)} />
</>;
