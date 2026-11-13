import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateApiTokenDto {
  // What the token is for ("MyHomeLab backups"), to recognise it in the list
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Dá um nome ao token.' })
  @MaxLength(60, { message: 'O nome tem no máximo 60 caracteres.' })
  name: string;

  // true = only GET requests
  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;

  // Days until it expires; absent or null = never
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number | null;
}
