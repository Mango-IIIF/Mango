import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, watch } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDist = resolve(root, 'src/dist');
const demoDist = resolve(root, 'apps/demo/dist');
const viteArgs = process.argv.slice(2);

let syncTimer = null;
let syncInFlight = false;

const runningChildren = new Set();

function log(message) {
  console.log(`[dev-demo] ${message}`);
}

function syncDemo() {
  if (syncInFlight) return;
  if (!existsSync(srcDist)) return;

  syncInFlight = true;
  try {
    rmSync(demoDist, { force: true, recursive: true });
    mkdirSync(demoDist, { recursive: true });
    cpSync(srcDist, demoDist, { recursive: true });
    log(`synced demo assets from ${srcDist} to ${demoDist}`);
  } catch (error) {
    log(`failed to sync assets: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    syncInFlight = false;
  }
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncDemo();
  }, 150);
}

function spawnCommand(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  runningChildren.add(child);

  child.on('exit', (code, signal) => {
    runningChildren.delete(child);
    if (signal === 'SIGINT' || signal === 'SIGTERM') return;
    if (code && code !== 0) {
      console.error(`[dev-demo] ${label} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
}

function shutdown(code = 0) {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  for (const child of runningChildren) {
    child.kill('SIGTERM');
  }

  setTimeout(() => {
    for (const child of runningChildren) {
      child.kill('SIGKILL');
    }
    process.exit(code);
  }, 300);
}

async function runInitialBuild() {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npm', ['run', 'build:demo'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`Initial build terminated by ${signal}`));
        return;
      }
      if (code && code !== 0) {
        rejectPromise(new Error(`Initial build failed with code ${code}`));
        return;
      }
      resolvePromise();
    });
  });
}

async function main() {
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  log('running initial demo build');
  await runInitialBuild();

  log('watching src/dist for demo sync');
  watch(srcDist, { recursive: true }, () => {
    scheduleSync();
  });

  spawnCommand('build:lib --watch', 'npm', ['run', 'build:lib', '--', '--watch']);
  spawnCommand('build:element --watch', 'npm', ['run', 'build:element', '--', '--watch']);
  spawnCommand('build:types --watch', 'npm', ['run', 'build:types', '--', '--watch', '--preserveWatchOutput']);
  spawnCommand('vite demo server', 'npx', ['vite', '--config', 'vite.config.demo.ts', ...viteArgs]);
}

main().catch((error) => {
  console.error(`[dev-demo] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});
