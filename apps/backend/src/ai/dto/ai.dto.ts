import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const MODEL_ID = /^[a-z0-9][a-z0-9.\-_@]*$/i;

/** Save the key and/or the model. Without a key, only changes the model of the stored one. */
export class SaveAiSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(20, { message: 'A chave da API parece incompleta.' })
  @MaxLength(400)
  apiKey?: string;

  @IsString()
  @MaxLength(100)
  @Matches(MODEL_ID, { message: 'Nome de modelo inválido.' })
  model: string;
}

/** List the models with a not-yet-saved key (or with the stored one). */
export class ListModelsDto {
  @IsOptional()
  @IsString()
  @MinLength(20, { message: 'A chave da API parece incompleta.' })
  @MaxLength(400)
  apiKey?: string;
}

/** A question to the assistant: in an existing conversation, or starting a new one. */
export class ChatDto {
  @IsOptional()
  @IsUUID('all', { message: 'Conversa inválida.' })
  conversationId?: string;

  @IsString()
  @Matches(/\S/, { message: 'Escreve uma pergunta.' })
  @MaxLength(12_000)
  content: string;

  @IsOptional()
  @IsIn(['pt-PT', 'en', 'es'])
  language?: 'pt-PT' | 'en' | 'es';
}

/** The user's answer to a shelf change the assistant proposed. */
export class ShelfActionDecisionDto {
  @IsIn(['confirm', 'dismiss'], { message: 'Decisão inválida.' })
  decision: 'confirm' | 'dismiss';
}

/** The conversations to delete together. */
export class DeleteConversationsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Escolhe pelo menos uma conversa.' })
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true, message: 'Conversa inválida.' })
  ids: string[];
}
