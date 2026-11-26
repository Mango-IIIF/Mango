import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const root = resolve(import.meta.dirname, 'apps/demo');
const srcDist = resolve(import.meta.dirname, 'src/dist');

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const serveDemoDistAsStatic = (): Plugin => ({
  name: 'serve-demo-dist-as-static',
  configureServer(server) {
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = (file: string) => {
      if (!file.startsWith(srcDist)) return;
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        server.ws.send({
          type: 'full-reload',
          path: '*',
        });
      }, 150);
    };

    server.watcher.add(srcDist);
    server.watcher.on('change', scheduleReload);
    server.watcher.on('add', scheduleReload);

    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (!pathname.startsWith('/dist/')) {
        next();
        return;
      }

      const relativePath = normalize(pathname.replace(/^\/dist\//, ''));
      const filePath = join(srcDist, relativePath);
      if (!filePath.startsWith(`${srcDist}${sep}`) || !existsSync(filePath)) {
        next();
        return;
      }

      response.setHeader(
        'Content-Type',
        contentTypes[extname(filePath)] ?? 'application/octet-stream',
      );
      response.setHeader('Cache-Control', 'no-store');
      createReadStream(filePath).pipe(response);
    });
  },
});

export default defineConfig({
  root,
  plugins: [serveDemoDistAsStatic()],
});
