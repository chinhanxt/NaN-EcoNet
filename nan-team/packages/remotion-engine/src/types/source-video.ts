import {z} from 'zod';
import {captionSchema, ASPECT_RATIOS, VIDEO_FPS} from './schema';

export const captionAppearanceSchema = z.object({
  position: z.enum(['top','middle','bottom']).optional(),
  fontName: z.string().regex(/^(?=.*\S)[A-Za-z0-9 _-]{1,80}$/).optional(),
  fontSize: z.number().finite().min(10).max(200).optional(),
  fontColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),
  borderColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),
  borderWidth: z.number().finite().min(0).max(10).optional(),
  highlightColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),
  bgColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),
  bgOpacity: z.number().finite().min(0).max(1).optional(),
  effect: z.enum(['none','glow','pop','box']).optional(),
  baseOpacity: z.number().finite().min(0).max(1).optional(),
  uppercase: z.boolean().optional(),
});
export type CaptionAppearance = z.infer<typeof captionAppearanceSchema>;

export const sourceVideoSchema = z.object({
  // The backend stages an exact private artifact on its ephemeral asset server.
  videoUrl: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password;
  }, 'Source video must use the private render asset server'),
  durationSeconds: z.number().finite().positive().max(21600),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']),
  title: z.string().max(200),
  design: z.object({
    theme: z.enum(['clean', 'bold', 'minimal']),
    transitions: z.enum(['none', 'fade', 'slide']),
    lowerThird: z.string().max(160).optional(),
    accentColor: z.string().regex(/^#[\da-fA-F]{6}$/).default('#10b981'),
    zooms: z.array(z.object({
      startSeconds: z.number().finite().min(0),
      endSeconds: z.number().finite().positive(),
      strength: z.number().finite().min(0).max(0.12),
    })).max(12).default([]),
  }),
  captions: z.array(captionSchema).max(50000),
  captionStyle: z.enum(['karaoke', 'classic', 'neon', 'pop', 'box']).default('karaoke'),
  captionAppearance: captionAppearanceSchema.optional(),
  hook: z.string().max(300).optional(),
  hookDurationSeconds: z.number().finite().min(.1).max(14400).default(5),
}).superRefine((props, context) => {
  for (const [index, caption] of props.captions.entries()) {
    if (caption.endMs > props.durationSeconds * 1000 + 1000 / VIDEO_FPS ||
      (index && caption.startMs < props.captions[index - 1].endMs)) {
      context.addIssue({code: 'custom', path: ['captions', index], message: 'Caption timing is outside the clip or overlaps'});
    }
  }
  for (const [index, zoom] of props.design.zooms.entries()) {
    if (zoom.endSeconds <= zoom.startSeconds || zoom.endSeconds > props.durationSeconds ||
      (index && zoom.startSeconds < props.design.zooms[index - 1].endSeconds)) {
      context.addIssue({code: 'custom', path: ['design', 'zooms', index], message: 'Zooms must be ordered, bounded and nonoverlapping'});
    }
  }
});

export type SourceVideoProps = z.infer<typeof sourceVideoSchema>;
export function sourceVideoMetadata(props: SourceVideoProps) {
  const validated = sourceVideoSchema.parse(props);
  return {props: validated, durationInFrames: Math.ceil(validated.durationSeconds * VIDEO_FPS),
    fps: VIDEO_FPS, ...ASPECT_RATIOS[validated.aspectRatio]};
}
