import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const root = resolve(__dirname, 'apps/demo');
const demoDist = resolve(root, 'dist');

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const serveDemoDistAsStatic = (): Plugin => ({
  name: 'serve-demo-dist-as-static',
  configureServer(server) {
    server.watcher.add(demoDist);
    server.watcher.on('change', (file) => {
      if (file.startsWith(demoDist)) {
        server.ws.send({
          type: 'full-reload',
          path: '*',
        });
      }
    });

    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (!pathname.startsWith('/dist/')) {
        next();
        return;
      }

      const relativePath = normalize(pathname.replace(/^\/dist\//, ''));
      const filePath = join(demoDist, relativePath);
      if (!filePath.startsWith(`${demoDist}${sep}`) || !existsSync(filePath)) {
        next();
        return;
      }

      response.setHeader(
        'Content-Type',
        contentTypes[extname(filePath)] ?? 'application/octet-stream',
      );
      createReadStream(filePath).pipe(response);
    });
  },
});

export default defineConfig({
  root,
  plugins: [serveDemoDistAsStatic()],
});
