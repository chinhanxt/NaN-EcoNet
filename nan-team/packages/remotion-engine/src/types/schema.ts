import {z} from 'zod';

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

const mediaSource = z.string().min(1).refine((source) => {
  if (/^(https?:\/\/|data:)/i.test(source)) return true;
  // Assets are browser URLs or public-directory paths, never filesystem paths.
  return !source.includes('..') && !source.includes('\\') &&
    !/^[a-z]+:/i.test(source) && !source.startsWith('/home/') && !source.startsWith('/tmp/');
}, 'Use an HTTP URL, data URL or public asset path');

export const sceneSchema = z.object({
  imagePath: mediaSource,
  durationInFrames: z.number().int().min(1).max(30 * 600),
  text: z.string().max(2000),
  keyword: z.string().max(100).optional(),
});
export const ASPECT_RATIOS = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
} as const;

export type AspectRatioType = keyof typeof ASPECT_RATIOS;

export const captionSchema = z.object({
  text: z.string().min(1).max(300),
  startMs: z.number().finite().min(0),
  endMs: z.number().finite().positive(),
}).refine((caption) => caption.endMs > caption.startMs, 'Caption end must follow start');

export const themeSchema = z.object({
  style: z.enum(['cinematic', 'tech_modern', 'minimalist', 'ugc_viral']).default('cinematic').optional(),
  subtitleStyle: z.enum(['clean_shadow', 'dark_pill', 'pop_karaoke']).default('clean_shadow').optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  showBadge: z.boolean().default(false).optional(),
  showProgressBar: z.boolean().default(true).optional(),
}).optional();

export const videoSchema = z.object({
  title: z.string().min(1).max(200),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16').optional(),
  width: z.number().int().min(480).max(3840).optional(),
  height: z.number().int().min(480).max(3840).optional(),
  scenes: z.array(sceneSchema).min(1).max(60),
  audioPath: mediaSource,
  captions: z.array(captionSchema).max(10000),
  bgmPath: mediaSource.optional(),
  bgmVolume: z.number().min(0).max(1).optional(),
  theme: themeSchema,
}).superRefine((props, ctx) => {
  const durationMs = props.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) / VIDEO_FPS * 1000;
  for (let i = 0; i < props.captions.length; i++) {
    const caption = props.captions[i];
    if (caption.endMs > durationMs + 1000 / VIDEO_FPS) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ['captions', i], message: 'Caption extends past the video'});
    }
    if (i > 0 && caption.startMs < props.captions[i - 1].endMs) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ['captions', i], message: 'Captions must be ordered without overlap'});
    }
  }
});

export type ThemeProps = z.infer<typeof themeSchema>;
export type VideoProps = z.infer<typeof videoSchema>;
export type VideoScene = z.infer<typeof sceneSchema>;
export type TimedCaption = z.infer<typeof captionSchema>;
export const getDurationInFrames = (props: VideoProps): number =>
  props.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);

