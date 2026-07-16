import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { fetchManifest, isIIIFCollection, manifestsStore } from '../manifests';

describe('IIIF resource routing', () => {
  beforeEach(() => {
    manifestsStore.set({});
    vi.unstubAllGlobals();
  });

  it('recognises Presentation 2 and 3 Collections only', () => {
    expect(isIIIFCollection({ type: 'Collection' })).toBe(true);
    expect(isIIIFCollection({ '@type': 'sc:Collection' })).toBe(true);
    expect(isIIIFCollection({ type: 'Manifest', items: [] })).toBe(false);
    expect(isIIIFCollection({ '@type': 'sc:Manifest', sequences: [] })).toBe(false);
    expect(isIIIFCollection({ type: 'AnnotationCollection' })).toBe(false);
  });

  it('caches Collection JSON without sending it to the Manifest parser', async () => {
    const id = 'https://example.org/collection';
    const collection = {
      id,
      type: 'Collection',
      label: { en: ['Example collection'] },
      items: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => collection,
      }),
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await fetchManifest(id);

    const entry = get(manifestsStore)[id];
    expect(entry?.resourceType).toBe('collection');
    expect(entry?.json).toEqual(collection);
    expect(entry?.manifesto).toBeUndefined();
    expect(entry?.canvases).toEqual([]);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
