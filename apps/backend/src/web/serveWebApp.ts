import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'fs';
import { basename, join } from 'path';

/**
 * Serves the built web app (apps/frontend/dist) from this process, with the same cache
 * rules as the nginx site of the Proxmox install:
 *   /assets/*        hashed names, cached for a year
 *   /downloads/*     the Android APK and its manifest, never cached
 *   index.html, env-config.js   never cached, so a new version shows straight away
 *   any other page   index.html (the app's own routes)
 * The API lives under /api (global prefix set in main.ts).
 */
export function serveWebApp(app: NestExpressApplication, webDir: string) {
  const index = join(webDir, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`WEB_DIR is set but ${index} does not exist.`);
  }

  app.useStaticAssets(webDir, {
    index: false,
    setHeaders: (res: Response, path: string) => {
      const name = basename(path);
      if (path.includes(`${join('assets', '')}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (name.endsWith('.apk')) {
        res.setHeader(
          'Content-Type',
          'application/vnd.android.package-archive',
        );
        res.setHeader('Cache-Control', 'no-cache');
      } else if (path.includes(`${join('downloads', '')}`)) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (name === 'env-config.js') {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  });

  // Pages of the app: anything that is not the API, not a file and asks for HTML.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    if (/\.[a-z0-9]+$/i.test(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
