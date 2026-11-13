import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { getInstalledVersion } from './system/helpers/getInstalledVersion';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Public: says this server is a GamesTracker Vault, and which version. The Android app
   * uses it to confirm the address the user typed before saving it; monitoring tools can
   * use it to check the server is up.
   */
  @Get('health')
  async health() {
    const installed = await getInstalledVersion().catch(() => null);
    return {
      app: 'gametracker-vault',
      ok: true,
      version: installed?.version ?? installed?.baseVersion ?? null,
    };
  }
}
