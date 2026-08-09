/**
 * Rebuilds a Mango story AnnotationPage to the interoperable shape.
 *
 * Four changes, and each one exists because the old shape said something
 * twice or said it in a way only Mango could read:
 *
 * - The version moves into the context URL. `mango:storyVersion` was
 *   restated on the page and again inside every chapter's state body, which
 *   is as many chances to disagree as there are chapters.
 * - The vocabulary moves to mangoviewer.dev, where the context is actually
 *   served. The old namespace never resolved.
 * - The state body gains `Dataset` alongside `mango:ViewerState`. `Dataset`
 *   is a W3C body class, so a viewer that knows nothing about Mango still
 *   knows this is data rather than prose to render at a reader.
 * - `canvasId` and `chapterId` come out of the state. The target's `source`
 *   and the annotation's own `id` already carry them, and a duplicate is
 *   only useful until the two copies differ.
 *
 * Usage: node scripts/migrate-story.mjs <file.json> [...]  (--dry to preview)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CONTEXT_URL = 'https://mangoviewer.dev/schema/story/1/context.json';
const W3C_CONTEXT = 'http://www.w3.org/ns/anno.jsonld';
const IIIF_CONTEXT = 'http://iiif.io/api/presentation/3/context.json';
const STATE_FORMAT = 'application/vnd.mango.story-state+json';
// `canvasIndex` is deliberately not here. The trailing segment of a canvas
// URI is an index only by convention and plenty are not — `…/canvas/model`,
// the cookbook's `…/canvas/p1` — so dropping it loses the only copy.
const REDUNDANT_STATE_KEYS = ['canvasId', 'chapterId'];

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Reads the state out of either shape Mango has written it in. */
const readState = (body) => {
  if (!isRecord(body) || body.format !== STATE_FORMAT) return undefined;
  if (isRecord(body.mangoState)) return body.mangoState;
  if (isRecord(body['mango:state'])) return body['mango:state'];
  if (typeof body.value === 'string') {
    try {
      const decoded = JSON.parse(body.value);
      return isRecord(decoded?.state) ? decoded.state : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const migrateBody = (body) => {
  const state = readState(body);
  if (!state) return body;
  const next = { ...state };
  for (const key of REDUNDANT_STATE_KEYS) delete next[key];
  return {
    type: ['Dataset', 'mango:ViewerState'],
    format: STATE_FORMAT,
    mangoState: next,
  };
};

export const migrateStory = (page) => {
  if (!isRecord(page) || page.type !== 'AnnotationPage') {
    throw new Error('not an AnnotationPage');
  }
  // `@context` is pulled out rather than left in the rest: spreading the
  // original after it would put the old inline context straight back.
  const { 'mango:storyVersion': _dropped, '@context': _oldContext, ...rest } = page;
  return {
    // IIIF last, as Presentation 3 requires. The extension sits between the
    // two so its terms are defined before IIIF's own are layered on.
    '@context': [W3C_CONTEXT, CONTEXT_URL, IIIF_CONTEXT],
    ...rest,
    items: asArray(page.items).map((item) => {
      const { 'mango:storyVersion': _v, ...keep } = item;
      const bodies = asArray(item.body).map(migrateBody);
      return {
        ...keep,
        ...(bodies.length === 0
          ? {}
          : { body: Array.isArray(item.body) ? bodies : bodies[0] }),
      };
    }),
  };
};

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
if (files.length === 0) {
  console.error('usage: node scripts/migrate-story.mjs <file.json> [...] [--dry]');
  process.exit(1);
}
for (const file of files) {
  const before = JSON.parse(readFileSync(file, 'utf8'));
  const after = migrateStory(before);
  const chapters = asArray(after.items).length;
  if (dry) {
    console.log(`${file}: ${chapters} items (dry run, not written)`);
  } else {
    writeFileSync(file, `${JSON.stringify(after, null, 2)}\n`);
    console.log(`${file}: migrated ${chapters} items`);
  }
}
