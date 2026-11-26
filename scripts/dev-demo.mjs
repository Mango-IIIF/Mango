import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDist = resolve(root, 'src/dist');
const viteArgs = process.argv.slice(2);

const runningChildren = new Set();

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

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

mkdirSync(srcDist, { recursive: true });

spawnCommand('build:element --watch', 'npm', ['run', 'build:element', '--', '--watch']);
spawnCommand('vite demo server', 'npx', ['vite', '--config', 'vite.config.demo.ts', ...viteArgs]);
