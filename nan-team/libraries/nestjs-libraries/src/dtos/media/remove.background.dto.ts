import { IsString, MaxLength, MinLength } from 'class-validator';

export class RemoveBackgroundDto {
  /** Image in the system upload storage: /uploads/... or its full URL. */
  @IsString() @MinLength(1) @MaxLength(2048)
  path: string;
}
