import { cpSync, mkdirSync, rmSync, renameSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDist = resolve(root, 'src/dist');
const demoOutput = resolve(root, 'demo');
const demoSource = resolve(root, 'apps/demo');
const nestedDemoOutput = resolve(demoSource, 'demo');
const demoDist = resolve(root, 'apps/demo/dist');
const apiEntry = resolve(demoDist, 'index.js');
const elementEntry = resolve(demoDist, 'mango-viewer-element.iife.js');
const demoEntry = resolve(demoDist, 'index.js');

console.log(`[sync-demo] root: ${root}`);
console.log(`[sync-demo] source dist: ${srcDist}`);
console.log(`[sync-demo] demo source: ${demoSource}`);

rmSync(demoDist, { force: true, recursive: true });
mkdirSync(demoDist, { recursive: true });
cpSync(srcDist, demoDist, { recursive: true });

renameSync(apiEntry, resolve(demoDist, 'api.js'));
copyFileSync(elementEntry, demoEntry);

rmSync(demoOutput, { force: true, recursive: true });
rmSync(nestedDemoOutput, { force: true, recursive: true });
cpSync(demoSource, demoOutput, { recursive: true });
cpSync(demoOutput, nestedDemoOutput, { recursive: true });

console.log(`[sync-demo] wrote deploy output: ${demoOutput}`);
console.log(`[sync-demo] wrote nested deploy output: ${nestedDemoOutput}`);
