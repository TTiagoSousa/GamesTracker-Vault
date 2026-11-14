import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

// Hours between automatic checks that Admin can choose
export const CHECK_INTERVALS = [1, 3, 6, 12, 24];

export class UpdatePriceSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  // ISO 3166-1 alpha-2 ("PT", "BR", "US")
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, {
    message: 'O país tem de ser um código de 2 letras (ex.: PT).',
  })
  country?: string;

  @IsOptional()
  @IsIn(CHECK_INTERVALS, { message: 'Intervalo inválido.' })
  everyHours?: number;
}

export class WatchGameDto {
  // Alert when the best price is at or below this; null = whenever it goes on sale
  @ValidateIf((_, value) => value !== null)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'O preço alvo tem de ser um número.' },
  )
  @Min(0)
  @Max(100000)
  targetPrice: number | null;
}

export class NotificationsQueryDto {
  // Only the ones after this id (the Android app asks for what's new)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MarkReadDto {
  // Absent = all of them
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  ids?: number[];
}
