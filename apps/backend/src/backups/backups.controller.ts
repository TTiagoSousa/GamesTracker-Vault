import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/generated/prisma/client/client';
import { BackupsService } from './backups.service';
import { UpdateBackupSettingsDto } from './dto/update-backup-settings.dto';

// Database backups — admins only.
@Controller('backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  overview() {
    return this.backupsService.overview();
  }

  @Post()
  create() {
    return this.backupsService.create();
  }

  // Before ':name', otherwise "settings" would be read as a backup's name
  @Get('settings')
  settings() {
    return this.backupsService.settings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateBackupSettingsDto) {
    return this.backupsService.updateSettings(dto);
  }

  // :name is a backup's file name or "latest"
  @Get(':name/download')
  async download(@Param('name') name: string) {
    const file = await this.backupsService.file(name);
    return new StreamableFile(createReadStream(file.path), {
      type: 'application/gzip',
      disposition: `attachment; filename="${file.name}"`,
      length: file.size,
    });
  }

  @Delete(':name')
  remove(@Param('name') name: string) {
    return this.backupsService.remove(name);
  }
}
