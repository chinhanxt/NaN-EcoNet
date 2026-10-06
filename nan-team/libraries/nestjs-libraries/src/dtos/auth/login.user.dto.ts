import {
  IsDefined,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Provider } from '@prisma/client';

export class LoginUserDto {
  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.providerToken)
  @MinLength(3)
  password: string;

  @IsString()
  @IsDefined()
  provider: Provider;

  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.password)
  providerToken: string;

  // Accepts either an email address or a plain username (e.g. `admin`)
  @IsString()
  @IsDefined()
  @Matches(/^(?:[^\s@]+@[^\s@]+\.[^\s@]+|[a-zA-Z0-9._-]{3,64})$/, {
    message: 'email must be a valid email address or username',
  })
  email: string;

  datafast_visitor_id: string;
}
