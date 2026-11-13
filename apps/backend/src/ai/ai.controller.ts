import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { AiService } from './ai.service';
import {
  ChatDto,
  DeleteConversationsDto,
  ListModelsDto,
  SaveAiSettingsDto,
} from './dto/ai.dto';
import { RunEvent } from './helpers/chatRuns';

type AuthRequest = Request & { user: JwtPayload };

// A line every 20 s while an answer is quiet (long IGDB searches), so proxies
// don't close the connection
const KEEPALIVE_MS = 20_000;

// Each user's assistant: their key, their model, their conversations.
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('settings')
  getSettings(@Req() req: AuthRequest) {
    return this.ai.getSettings(req.user.id);
  }

  @Put('settings')
  saveSettings(@Req() req: AuthRequest, @Body() dto: SaveAiSettingsDto) {
    return this.ai.saveSettings(req.user.id, dto);
  }

  @Delete('settings')
  removeSettings(@Req() req: AuthRequest) {
    return this.ai.removeSettings(req.user.id);
  }

  // POST so the (not yet saved) key doesn't end up in a URL
  @Post('models')
  @HttpCode(200)
  models(@Req() req: AuthRequest, @Body() dto: ListModelsDto) {
    return this.ai.models(req.user.id, dto.apiKey);
  }

  /**
   * A question. Saves it, starts the answer on the server and returns right away
   * with the conversation; the answer is followed with GET …/stream.
   */
  @Post('chat')
  @HttpCode(201)
  chat(@Req() req: AuthRequest, @Body() dto: ChatDto) {
    return this.ai.ask(req.user, dto);
  }

  @Get('conversations')
  conversations(@Req() req: AuthRequest) {
    return this.ai.conversations(req.user.id);
  }

  @Get('conversations/:id')
  conversation(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ai.conversation(req.user.id, id);
  }

  // POST because a DELETE with a body is often dropped by proxies
  @Post('conversations/delete')
  @HttpCode(200)
  removeConversations(
    @Req() req: AuthRequest,
    @Body() dto: DeleteConversationsDto,
  ) {
    return this.ai.removeConversations(req.user.id, dto.ids);
  }

  @Delete('conversations/:id')
  removeConversation(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ai.removeConversation(req.user.id, id);
  }

  @Post('conversations/:id/stop')
  @HttpCode(200)
  stop(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.ai.stop(req.user.id, id);
  }

  /**
   * The answer being written, one JSON line per event (application/x-ndjson):
   * `snapshot` (what's written so far), `text`, `tool`, `error`, `done`.
   * Closing the connection only stops following — the answer keeps going.
   */
  @Get('conversations/:id/stream')
  async stream(
    @Req() req: AuthRequest,
    @Res() res: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const timer: { keepalive?: NodeJS.Timeout } = {};
    let off: (() => void) | null = null;
    const close = () => {
      clearInterval(timer.keepalive);
      off?.();
      if (!res.writableEnded) res.end();
    };

    const emit = (event: RunEvent) => {
      if (res.writableEnded) return;
      if (!res.headersSent) {
        res.status(200);
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        // nginx must not buffer the response before sending it
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
      }
      res.write(`${JSON.stringify(event)}\n`);
      if (event.type === 'done') close();
    };

    res.on('close', close);
    try {
      off = await this.ai.follow(req.user.id, id, emit);
    } catch (error) {
      clearInterval(timer.keepalive);
      if (res.headersSent) return close();
      if (error instanceof HttpException) {
        res.status(error.getStatus()).json(error.getResponse());
      } else {
        res.status(500).json({ statusCode: 500, message: 'Erro interno' });
      }
      return;
    }
    if (res.writableEnded) {
      off?.();
      return;
    }
    timer.keepalive = setInterval(
      () => res.write(`${JSON.stringify({ type: 'ping' })}\n`),
      KEEPALIVE_MS,
    );
  }
}
