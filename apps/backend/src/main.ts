import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { serveWebApp } from './web/serveWebApp';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Which proxies may say what protocol the browser used (X-Forwarded-Proto). That decides
  // whether the session cookie is "secure". In the Proxmox container the only proxy is the
  // local nginx (loopback); in Docker it is whatever sits in front on the private network.
  // Direct connections from other addresses still cannot fake the protocol.
  app.set('trust proxy', trustProxy(process.env.TRUST_PROXY));

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  // WEB_DIR set (Docker image): this process also serves the web app, and the API moves
  // under /api — the same addresses nginx gives the Proxmox install.
  const webDir = process.env.WEB_DIR;
  if (webDir) {
    app.setGlobalPrefix('api');
    serveWebApp(app, webDir);
  }

  // systemd and Docker stop the service with SIGTERM; without this Nest doesn't run
  // onModuleDestroy and the Postgres connections are left open.
  app.enableShutdownHooks();

  // In the Proxmox container the backend only needs to listen to nginx (HOST=127.0.0.1);
  // in Docker and in development it listens on all interfaces.
  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
}

/** "true"/"false", a hop count, or a list of addresses/names ("loopback, uniquelocal"). */
function trustProxy(value: string | undefined): boolean | number | string {
  if (!value) return 'loopback';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

void bootstrap();
