import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class SaveItadDto {
  // The "API key" of an app registered at isthereanydeal.com/apps/my
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,128}$/, {
    message: 'A chave não tem o formato de uma API key da IsThereAnyDeal',
  })
  key: string;
}
