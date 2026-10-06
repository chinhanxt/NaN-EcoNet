import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional,
  IsString, IsBoolean, IsHexColor, IsUUID, Max, MaxLength, Min, MinLength, Validate, ValidateNested,
  ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface,
} from 'class-validator';
import { assertAiVideoAssetUrl } from '../../video.asset';

export const CLONED_VOICES = ['Thuyết Minh', 'Chị gái', 'Giọng dạy', 'HTH', 'Adam'] as const;
export const AI_VIDEO_VOICES = ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural', ...CLONED_VOICES] as const;
export const AI_VIDEO_BUDGETS = {
  // Vietnamese voices speak ~4.5–5 syllables/s. More scenes keep each image on
  // screen ~3.5–5.5s; totals keep speech filling the timeline after the tempo floor.
  // sceneWords is the per-scene aim, sceneMinWords rejects one-line filler scenes.
  // legacyScenes accepts checkpoints/renders created under the previous scene count.
  15: { scenes: 4, legacyScenes: 3, minWords: 52, maxWords: 60, sceneWords: 14, sceneMinWords: 10 },
  30: { scenes: 6, legacyScenes: 5, minWords: 105, maxWords: 117, sceneWords: 18, sceneMinWords: 13 },
  60: { scenes: 11, legacyScenes: 8, minWords: 215, maxWords: 240, sceneWords: 20, sceneMinWords: 14 },
} as const;

@ValidatorConstraint({ name: 'AiVideoAssetUrl', async: false })
export class AiVideoAssetUrl implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    try { assertAiVideoAssetUrl(value as string); return true; } catch { return false; }
  }
  defaultMessage(): string { return 'Asset URL must belong to configured upload storage'; }
}

export class GenerateStoryboardDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(4000)
  topic: string;

  @IsIn([15, 30, 60])
  targetDuration: 15 | 30 | 60;

  @IsIn(AI_VIDEO_VOICES)
  voice: string;

  @IsOptional() @IsIn(['9:16', '16:9', '1:1'])
  aspectRatio?: '9:16' | '16:9' | '1:1';

  @IsOptional() @IsString() @Validate(AiVideoAssetUrl)
  seedImageUrl?: string;
}

export class GenerateAiVideoDto extends GenerateStoryboardDto {
  @IsOptional() @IsUUID('4')
  resumeJobId?: string;
}

export class AiVideoSceneDto {
  @IsInt() @Min(0) @Max(11)
  sceneIndex: number;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(1500)
  voiceText: string;

  @IsString() @MinLength(1) @MaxLength(12000)
  imagePrompt: string;

  @IsString() @MinLength(1) @MaxLength(80)
  keywordHighlight: string;

  @IsString() @Validate(AiVideoAssetUrl)
  imageUrl: string;
}

@ValidatorConstraint({ name: 'AiVideoSceneSequence', async: false })
export class AiVideoSceneSequence implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const duration = (args.object as RenderVideoDto).targetDuration;
    const budget = AI_VIDEO_BUDGETS[duration];
    return !!budget && Array.isArray(value) && [budget.scenes, budget.legacyScenes].includes(value.length as never) &&
      value.every((scene: AiVideoSceneDto, index) => scene?.sceneIndex === index &&
        typeof scene.voiceText === 'string' && scene.voiceText.trim().length > 0);
  }
  defaultMessage(): string { return 'Scenes must match the target duration and use consecutive indices starting at zero'; }
}

export class AiVideoThemeDto {
  @IsOptional() @IsIn(['cinematic','tech_modern','minimalist','ugc_viral']) style?: 'cinematic'|'tech_modern'|'minimalist'|'ugc_viral';
  @IsOptional() @IsIn(['clean_shadow','dark_pill','pop_karaoke']) subtitleStyle?: 'clean_shadow'|'dark_pill'|'pop_karaoke';
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() accentColor?: string;
  @IsOptional() @IsBoolean() showBadge?: boolean;
  @IsOptional() @IsBoolean() showProgressBar?: boolean;
}

export class RenderVideoDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(200)
  title: string;

  @IsIn([15, 30, 60])
  targetDuration: 15 | 30 | 60;

  @IsIn(AI_VIDEO_VOICES)
  voice: string;

  @IsOptional() @IsIn(['9:16', '16:9', '1:1'])
  aspectRatio?: '9:16' | '16:9' | '1:1';

  @IsArray() @ArrayMinSize(3) @ArrayMaxSize(12) @Validate(AiVideoSceneSequence)
  @ValidateNested({ each: true }) @Type(() => AiVideoSceneDto)
  scenes: AiVideoSceneDto[];

  @IsOptional() @IsString() @Validate(AiVideoAssetUrl)
  bgm?: string;

  @IsOptional() @ValidateNested() @Type(() => AiVideoThemeDto)
  theme?: AiVideoThemeDto;
}

export class PreviewVoiceDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(1500)
  text: string;

  @IsIn(AI_VIDEO_VOICES)
  voice: string;
}

export class RegenerateImageDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(12000)
  imagePrompt: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(4000)
  visualDna: string;

  @IsOptional() @IsIn(['9:16', '16:9', '1:1'])
  aspectRatio?: '9:16' | '16:9' | '1:1';
}
