import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { manifestsStore } from '../../state/manifests';
import type { CollectionTreeElement } from '@mango-iiif/collection-navigator';
import Viewer from '../Viewer.svelte';

const waitFor = async (predicate: () => boolean): Promise<void> => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 1500) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

describe('Viewer collection navigation', () => {
  const targets: HTMLElement[] = [];
  const instances: Array<ReturnType<typeof mount>> = [];

  afterEach(() => {
    instances.splice(0).forEach((instance) => unmount(instance));
    targets.splice(0).forEach((target) => target.remove());
    manifestsStore.set({});
    vi.unstubAllGlobals();
  });

  it('opens the first Manifest and preserves the Collection panel', async () => {
    const collectionId = 'https://example.org/collection';
    const manifestId = 'https://example.org/manifest';
    const externalManifestId = 'https://example.org/external-manifest';
    const firstCanvasId = 'https://example.org/canvas/1';
    const secondCanvasId = 'https://example.org/canvas/2';
    const collection = {
      id: collectionId,
      type: 'Collection',
      label: { en: ['Example collection'] },
      items: [
        {
          id: manifestId,
          type: 'Manifest',
          label: { en: ['Example manifest'] },
        },
      ],
    };
    const manifest = {
      id: manifestId,
      type: 'Manifest',
      label: { en: ['Example manifest'] },
      items: [
        { id: firstCanvasId, type: 'Canvas', width: 1000, height: 1000, items: [] },
        { id: secondCanvasId, type: 'Canvas', width: 1000, height: 1000, items: [] },
      ],
    };
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url === collectionId
          ? collection
          : url === externalManifestId
            ? { ...manifest, id: externalManifestId }
            : manifest,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const target = document.createElement('div');
    document.body.appendChild(target);
    targets.push(target);
    const instance = mount(Viewer, {
      target,
      props: { manifestId: collectionId, config: { language: 'fr' } },
    });
    instances.push(instance);

    await waitFor(() => Boolean(target.querySelector('mango-collection-tree')));
    const tree = target.querySelector('mango-collection-tree') as CollectionTreeElement;
    expect(fetchMock).toHaveBeenCalledWith(collectionId);
    expect(tree.locale).toBe('fr');
    expect(tree.messages.hierarchy).toBe('Hiérarchie');

    await waitFor(() => fetchMock.mock.calls.some(([url]) => url === manifestId));
    expect((instance as { getManifestId: () => string | null }).getManifestId()).toBe(manifestId);
    expect(target.querySelector('mango-collection-tree')).toBe(tree);

    (instance as { setCanvasByIndex: (index: number) => void }).setCanvasByIndex(1);
    await tick();
    expect((instance as { getCanvasIndex: () => number }).getCanvasIndex()).toBe(1);

    const toggle = target.querySelector<HTMLButtonElement>('[data-tone="collection"]');
    toggle!.click();
    await tick();
    expect(tree.isConnected).toBe(true);

    toggle!.click();
    await tick();
    expect(target.querySelector('mango-collection-tree')).toBe(tree);

    // A manifest selected outside the Collection must clear its navigation
    // context, while member-to-member navigation above preserves it.
    (instance as { setManifest: (id: string) => void }).setManifest(externalManifestId);
    await waitFor(() => fetchMock.mock.calls.some(([url]) => url === externalManifestId));
    await tick();
    expect(target.querySelector('[data-tone="collection"]')).toBeNull();
    expect(tree.closest('[hidden]')).not.toBeNull();
  });
});
