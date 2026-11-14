import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionOnlyGuard } from 'src/auth/guards/session-only.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { Role } from 'src/generated/prisma/client/client';
import { PricesService } from './prices.service';
import { NotificationsService } from './notifications.service';
import {
  MarkReadDto,
  NotificationsQueryDto,
  UpdatePriceSettingsDto,
  WatchGameDto,
} from './dto/prices.dto';

type AuthRequest = Request & { user: JwtPayload };

// Game prices and the games each user follows.
@Controller('prices')
@UseGuards(JwtAuthGuard)
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Get('status')
  status() {
    return this.prices.status();
  }

  @Put('settings')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateSettings(@Body() dto: UpdatePriceSettingsDto) {
    return this.prices.updateSettings(dto);
  }

  @Post('check')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  checkNow() {
    return this.prices.checkNow();
  }

  @Get('games/:gameId')
  game(@Req() req: AuthRequest, @Param('gameId', ParseIntPipe) gameId: number) {
    return this.prices.game(req.user.id, gameId);
  }

  @Get('watchlist')
  watchlist(@Req() req: AuthRequest) {
    return this.prices.watchlist(req.user.id);
  }

  @Put('watchlist/:gameId')
  watch(
    @Req() req: AuthRequest,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: WatchGameDto,
  ) {
    return this.prices.watch(req.user.id, gameId, dto.targetPrice);
  }

  @Delete('watchlist/:gameId')
  unwatch(
    @Req() req: AuthRequest,
    @Param('gameId', ParseIntPipe) gameId: number,
  ) {
    return this.prices.unwatch(req.user.id, gameId);
  }

  @Get('backlog')
  backlog(@Req() req: AuthRequest) {
    return this.prices.backlog(req.user.id);
  }

  @Get('featured')
  featured() {
    return this.prices.featured();
  }
}

// Notifications: the site's list and what the Android app fetches in the background.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: AuthRequest, @Query() query: NotificationsQueryDto) {
    return this.notifications.list(req.user.id, query.after, query.limit);
  }

  @Get('unread')
  unread(@Req() req: AuthRequest) {
    return this.notifications.unread(req.user.id);
  }

  @Post('read')
  @HttpCode(200)
  markRead(@Req() req: AuthRequest, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(req.user.id, dto.ids);
  }

  @Delete()
  clear(@Req() req: AuthRequest) {
    return this.notifications.clear(req.user.id);
  }

  // Creates a token: only from the signed-in browser (or the app's WebView)
  @Post('devices')
  @UseGuards(SessionOnlyGuard)
  addDevice(@Req() req: AuthRequest) {
    return this.notifications.addDevice(req.user.id);
  }
}
