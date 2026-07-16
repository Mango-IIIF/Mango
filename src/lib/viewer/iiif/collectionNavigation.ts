import {
  findPath,
  parseIIIF,
  type JsonObject,
} from '@mango-iiif/collection-navigator/core';

export const findFirstManifestId = (input: unknown): string | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  try {
    const structure = parseIIIF(input as JsonObject);
    const path = findPath(structure.root, (node) => node.type === 'manifest');
    const manifest = path?.[path.length - 1];
    return manifest?.manifestId ?? manifest?.id ?? null;
  } catch {
    return null;
  }
};
