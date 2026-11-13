import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Every field is optional: only what is sent changes. */
export class UpdateBackupSettingsDto {
  @IsOptional()
  @IsBoolean()
  automatic?: boolean;

  // Time of day, in the server's time zone
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'A hora tem de estar no formato HH:MM (por exemplo 03:30).',
  })
  time?: string;

  // 0 = keeps them forever
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  keepDays?: number;

  // Absolute path; null or "" goes back to the default folder
  @IsOptional()
  @IsString()
  @MaxLength(500)
  directory?: string | null;
}
