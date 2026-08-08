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

/**
 * Deletes anything in `dest` that no longer exists in `src`, and reports how
 * many files went.
 *
 * Vite emits content-hashed filenames, so a copy that only ever adds leaves
 * every previous build's chunks behind for ever — this directory had
 * accumulated 1259 `storyBuilder-*.js` bundles and 1.7GB of them.
 *
 * Pruning rather than emptying the directory is deliberate. `dev-demo` re-runs
 * this sync on every rebuild while the demo server is serving out of it, and
 * removing the whole tree first leaves a window where a page reload 404s.
 */
function pruneRemoved(src, dest) {
  if (!existsSync(dest)) return 0;
  let removed = 0;
  for (const entry of readdirSync(dest)) {
    const destPath = join(dest, entry);
    const srcPath = join(src, entry);
    if (!existsSync(srcPath)) {
      rmSync(destPath, { recursive: true, force: true });
      removed += 1;
      continue;
    }
    if (statSync(destPath).isDirectory() && statSync(srcPath).isDirectory()) {
      removed += pruneRemoved(srcPath, destPath);
    }
  }
  return removed;
}

mkdirSync(demoDist, { recursive: true });
const removed = pruneRemoved(srcDist, demoDist);
copyDirRecursive(srcDist, demoDist);

if (removed > 0) {
  console.log(`[sync-demo] pruned ${removed} stale entries`);
}
console.log(`[sync-demo] updated demo assets: ${demoDist}`);
