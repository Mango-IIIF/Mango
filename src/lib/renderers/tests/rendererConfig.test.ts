import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaSource } from '../../iiif/mediaResolver';

const mocks = vi.hoisted(() => ({
  osdFactory: vi.fn(),
  getPage: vi.fn(),
}));

vi.mock('@google/model-viewer', () => ({}));
vi.mock('openseadragon', () => ({ default: mocks.osdFactory }));
vi.mock('pdfjs-dist/legacy/build/pdf', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    destroy: vi.fn(),
    promise: Promise.resolve({
      numPages: 5,
      getPage: mocks.getPage,
    }),
  }),
}));

import ImageRenderer from '../ImageRenderer.svelte';
import ModelRenderer from '../ModelRenderer.svelte';
import PdfRenderer from '../PdfRenderer.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];

const imageSource: MediaSource = {
  id: 'image',
  src: 'https://example.org/info.json',
  type: 'image',
};

afterEach(() => {
  mounted.splice(0).forEach((component) => unmount(component));
  targets.splice(0).forEach((target) => target.remove());
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const createTarget = () => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  targets.push(element);
  return element;
};

const waitFor = async (predicate: () => boolean) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 1000) throw new Error('Timed out waiting for renderer');
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

describe('renderer pass-through config', () => {
  it('passes arbitrary OpenSeadragon options after defaults', async () => {
    const handlers = new Map<string, () => void>();
    const viewport = {
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1, height: 1 })),
      getZoom: vi.fn(() => 1),
      getRotation: vi.fn(() => 0),
      setRotation: vi.fn(),
      applyConstraints: vi.fn(),
      fitBounds: vi.fn(),
    };
    const tiledImage = {
      customLayerId: 'base',
      getContentSize: vi.fn(() => ({ x: 1000, y: 800 })),
      imageToViewportRectangle: vi.fn((x, y, width, height) => ({
        x,
        y,
        width,
        height,
      })),
      viewportToImageRectangle: vi.fn(() => ({ x: 0, y: 0, width: 1000, height: 800 })),
      setOpacity: vi.fn(),
      setPosition: vi.fn(),
      setWidth: vi.fn(),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1, height: 1 })),
    };
    Object.assign(mocks.osdFactory, {
      Point: class Point {
        constructor(public x: number, public y: number) {}
      },
    });
    mocks.osdFactory.mockReturnValue({
      viewport,
      world: {
        getItemAt: vi.fn(() => tiledImage),
        getItemCount: vi.fn(() => 1),
        removeItem: vi.fn(),
      },
      addHandler: vi.fn((name: string, handler: () => void) => handlers.set(name, handler)),
      addTiledImage: vi.fn(),
      open: vi.fn(() => handlers.get('open')?.()),
      close: vi.fn(),
      destroy: vi.fn(),
    });

    mounted.push(
      mount(ImageRenderer, {
        target: createTarget(),
        props: {
          source: imageSource,
          osdConfig: { zoomPerScroll: 1.5, visibilityRatio: 0.8 },
          rotation: 90,
          initialViewBox: { x: 10, y: 20, w: 300, h: 200 },
        },
      }),
    );
    await waitFor(() => mocks.osdFactory.mock.calls.length > 0);

    expect(mocks.osdFactory).toHaveBeenCalledWith(
      expect.objectContaining({ zoomPerScroll: 1.5, visibilityRatio: 0.8 }),
    );
    expect(viewport.setRotation).toHaveBeenCalledWith(90);
    await waitFor(() => viewport.fitBounds.mock.calls.length > 0);
    expect(viewport.fitBounds).toHaveBeenCalledWith(
      { x: 10, y: 20, width: 300, height: 200 },
      true,
    );

    handlers.get('open')?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(viewport.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('applies Model Viewer attributes', () => {
    mounted.push(
      mount(ModelRenderer, {
        target: createTarget(),
        props: {
          source: { id: 'model', src: 'model.glb', type: 'model' },
          modelConfig: { 'auto-rotate': true, exposure: 1.25 },
        },
      }),
    );

    const element = document.querySelector('model-viewer');
    expect(element?.hasAttribute('auto-rotate')).toBe(true);
    expect(element?.getAttribute('exposure')).toBe('1.25');
  });

  it('loads the configured initial PDF page', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D,
    );
    mocks.getPage.mockResolvedValue({
      getViewport: () => ({ width: 100, height: 100 }),
      render: () => ({ promise: Promise.resolve() }),
    });

    mounted.push(
      mount(PdfRenderer, {
        target: createTarget(),
        props: {
          source: { id: 'pdf', src: 'document.pdf', type: 'pdf' },
          initialPage: 3,
        },
      }),
    );
    await waitFor(() => mocks.getPage.mock.calls.length > 0);

    expect(mocks.getPage).toHaveBeenCalledWith(3);
  });
});
