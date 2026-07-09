import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDist = resolve(root, 'src/dist');
const demoDist = resolve(root, 'apps/demo/dist');

console.log(`[sync-demo] root: ${root}`);
console.log(`[sync-demo] source dist: ${srcDist}`);
console.log(`[sync-demo] demo dist: ${demoDist}`);

function copyDirRecursive(src, dest) {
  const stats = statSync(src);
  if (stats.isDirectory()) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    for (const file of readdirSync(src)) {
      copyDirRecursive(join(src, file), join(dest, file));
    }
  } else {
    copyFileSync(src, dest);
  }
}

rmSync(demoDist, { force: true, recursive: true });
mkdirSync(demoDist, { recursive: true });
copyDirRecursive(srcDist, demoDist);

console.log(`[sync-demo] updated demo assets: ${demoDist}`);
