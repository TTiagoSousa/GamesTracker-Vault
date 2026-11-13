import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SessionOnlyGuard } from 'src/auth/guards/session-only.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { ApiTokensService } from './api-tokens.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';

type AuthRequest = Request & { user: JwtPayload };

// The signed-in user's API tokens (Settings → API). Managed only from the browser.
@Controller('tokens')
@UseGuards(JwtAuthGuard, SessionOnlyGuard)
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.apiTokensService.list(req.user.id);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateApiTokenDto) {
    return this.apiTokensService.create(req.user.id, dto);
  }

  @Delete(':id')
  revoke(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.apiTokensService.revoke(req.user.id, id);
  }
}
