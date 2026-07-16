import { describe, expect, it } from 'vitest';
import { findFirstManifestId } from '../collectionNavigation';

describe('findFirstManifestId', () => {
  it('returns the first Manifest from a Presentation 3 Collection', () => {
    expect(findFirstManifestId({
      id: 'collection',
      type: 'Collection',
      items: [
        { id: 'manifest-1', type: 'Manifest' },
        { id: 'manifest-2', type: 'Manifest' },
      ],
    })).toBe('manifest-1');
  });

  it('returns the first Manifest from a Presentation 2 Collection', () => {
    expect(findFirstManifestId({
      '@id': 'collection',
      '@type': 'sc:Collection',
      manifests: [
        { '@id': 'manifest-1', '@type': 'sc:Manifest' },
        { '@id': 'manifest-2', '@type': 'sc:Manifest' },
      ],
    })).toBe('manifest-1');
  });

  it('follows embedded child Collections in source order', () => {
    expect(findFirstManifestId({
      id: 'collection',
      type: 'Collection',
      items: [
        {
          id: 'child-collection',
          type: 'Collection',
          items: [{ id: 'nested-manifest', type: 'Manifest' }],
        },
        { id: 'later-manifest', type: 'Manifest' },
      ],
    })).toBe('nested-manifest');
  });

  it('returns null when no Manifest is available without resolving references', () => {
    expect(findFirstManifestId({
      id: 'collection',
      type: 'Collection',
      items: [{ id: 'child-collection', type: 'Collection' }],
    })).toBeNull();
  });
});
