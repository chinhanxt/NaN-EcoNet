import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, Matches, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Colors the editor extracted from the picture. */
export class AiDesignPaletteDto {
  @IsArray() @ArrayMaxSize(8) @Matches(HEX_COLOR, { each: true })
  colors: string[];

  @Matches(HEX_COLOR)
  dark: string;

  @Matches(HEX_COLOR)
  light: string;

  /** null when the picture has no usable accent. */
  @IsOptional() @Matches(HEX_COLOR)
  accent: string | null;
}

export class AiDesignZoneDto {
  @IsIn(['text', 'subject', 'cta'])
  name: 'text' | 'subject' | 'cta';

  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() @Min(1) width: number;
  @IsNumber() @Min(1) height: number;
}

export class AiDesignChatTurnDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString() @MaxLength(2000)
  text: string;

  /** The user reverted this AI edit. */
  @IsOptional() @IsBoolean()
  undone?: boolean;
}

export class AiDesignPageDto {
  @IsNumber() @Min(1) @Max(20000)
  width: number;

  @IsNumber() @Min(1) @Max(20000)
  height: number;

  @IsOptional() @IsString() @MaxLength(64)
  background?: string;
}

export class AiDesignElementDto {
  @IsString() @MinLength(1) @MaxLength(128)
  id: string;

  @IsString() @MaxLength(32)
  type: string;

  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() width: number;
  @IsNumber() height: number;
  @IsNumber() zIndex: number;

  @IsOptional() @IsNumber() rotation?: number;
  @IsOptional() @IsNumber() opacity?: number;
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional() @IsString() @MaxLength(128) fontFamily?: string;
  @IsOptional() @IsNumber() fontSize?: number;
  @IsOptional() @IsString() @MaxLength(32) fontWeight?: string;
  @IsOptional() @IsString() @MaxLength(64) fill?: string;
  @IsOptional() @IsString() @MaxLength(16) align?: string;
  /** Short URLs only: data URLs of embedded images are never sent to the model. */
  @IsOptional() @IsString() @MaxLength(2048) src?: string;
}

export class AiDesignEditDto {
  /** Latest chat message; empty or "__undo__" (after an undo) makes the AI ask instead of editing. */
  @IsString() @MaxLength(2000)
  instruction: string;

  /**
   * Upload path (/uploads/... or a storage URL) or a PNG/JPEG data URL of at most 4 MB.
   * Required when the page has elements; an empty page needs none (the AI designs from the instruction).
   */
  @ValidateIf((dto: AiDesignEditDto) => dto.phase !== 'layout-zones' && Array.isArray(dto.elements) && dto.elements.length > 0)
  @IsString() @MinLength(1) @MaxLength(6_000_000)
  screenshot: string;

  @ValidateNested() @Type(() => AiDesignPageDto)
  page: AiDesignPageDto;

  @IsArray() @ArrayMaxSize(80) @ValidateNested({ each: true }) @Type(() => AiDesignElementDto)
  elements: AiDesignElementDto[];

  @IsOptional() @IsInt() @Min(1) @Max(3)
  variants?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => AiDesignChatTurnDto)
  history?: AiDesignChatTurnDto[];

  /** Images the user pasted into the design chat: /uploads/... paths or upload-storage URLs. */
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsString({ each: true }) @MaxLength(2048, { each: true })
  referenceImages?: string[];

  /** Ids of the elements selected on the canvas. */
  @IsOptional() @IsArray() @ArrayMaxSize(80) @IsString({ each: true }) @MaxLength(128, { each: true })
  selectedIds?: string[];

  /**
   * 'layout-over-image': the background picture is on the page; lay text/shapes over it (needs screenshot).
   * 'layout-zones': runs in parallel with the picture; text/shapes go by `zones` (no screenshot).
   */
  @IsOptional() @IsIn(['layout-over-image', 'layout-zones'])
  phase?: 'layout-over-image' | 'layout-zones';

  /** Planned areas of the picture being generated (page pixels); required for 'layout-zones'. */
  @ValidateIf((dto: AiDesignEditDto) => dto.phase === 'layout-zones')
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => AiDesignZoneDto)
  zones?: AiDesignZoneDto[];

  /** Picture palette: dark for overlays, light for text, accent for CTA/kicker. */
  @IsOptional() @ValidateNested() @Type(() => AiDesignPaletteDto)
  palette?: AiDesignPaletteDto;
}
