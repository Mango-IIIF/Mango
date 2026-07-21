import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { AVPlayerController, type JsonObject } from '@mango-iiif/av/core';
import AVRenderer from '../AVRenderer.svelte';

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

const manifest: JsonObject = {
  id: 'https://example.org/manifest',
  type: 'Manifest',
  label: { en: ['Audio'] },
  items: [
    {
      id: 'https://example.org/canvas/audio',
      type: 'Canvas',
      duration: 10,
      items: [
        {
          id: 'https://example.org/page/audio',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/annotation/audio',
              type: 'Annotation',
              motivation: 'painting',
              target: 'https://example.org/canvas/audio',
              body: {
                id: 'https://example.org/audio.mp3',
                type: 'Sound',
                format: 'audio/mpeg',
              },
            },
          ],
        },
      ],
    },
  ],
};

const waitFor = async (predicate: () => boolean): Promise<void> => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 1000) throw new Error('Timed out waiting for media source');
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

describe('AVRenderer controller lifecycle', () => {
  let target: HTMLDivElement | undefined;
  let instance: ReturnType<typeof mount> | undefined;
  let controller: AVPlayerController | undefined;

  afterEach(() => {
    if (instance) unmount(instance);
    controller?.destroy();
    target?.remove();
  });

  it('resolves media when mounted with an already-loaded controller', async () => {
    controller = new AVPlayerController();
    await controller.load(manifest);

    target = document.createElement('div');
    document.body.appendChild(target);
    instance = mount(AVRenderer, {
      target,
      props: { controller },
    });

    const player = target.querySelector('mango-av-player');
    expect(player).toBeTruthy();

    await waitFor(() => {
      const media = player?.shadowRoot?.querySelector('audio');
      return media?.getAttribute('src') === 'https://example.org/audio.mp3';
    });
  });
});
