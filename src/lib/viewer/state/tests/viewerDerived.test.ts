import { describe, it, expect } from 'vitest';
import { manifestsStore } from '../../../state/manifests';
import { createViewerDerived } from '../viewerDerived';
import { createViewerState } from '../viewerState';

describe('viewerDerived - activeLayoutImages', () => {
  const mockCanvases = [
    {
      id: 'c0',
      index: 0,
      width: 800,
      height: 1200,
      getImages: () => [
        {
          getResource: () => ({
            id: 'img-c0',
            type: 'dctypes:Image',
            format: 'image/jpeg',
            service: {
              id: 'service-c0'
            }
          })
        }
      ]
    },
    {
      id: 'c1',
      index: 1,
      width: 800,
      height: 1200,
      getImages: () => [
        {
          getResource: () => ({
            id: 'img-c1',
            type: 'dctypes:Image',
            format: 'image/jpeg',
            service: {
              id: 'service-c1'
            }
          })
        }
      ]
    },
    {
      id: 'c2',
      index: 2,
      width: 800,
      height: 1200,
      getImages: () => [
        {
          getResource: () => ({
            id: 'img-c2',
            type: 'dctypes:Image',
            format: 'image/jpeg',
            service: {
              id: 'service-c2'
            }
          })
        }
      ]
    },
    {
      id: 'c3',
      index: 3,
      width: 800,
      height: 1200,
      getImages: () => [
        {
          getResource: () => ({
            id: 'img-c3',
            type: 'dctypes:Image',
            format: 'image/jpeg',
            service: {
              id: 'service-c3'
            }
          })
        }
      ]
    },
    {
      id: 'c4',
      index: 4,
      width: 800,
      height: 1200,
      getImages: () => [
        {
          getResource: () => ({
            id: 'img-c4',
            type: 'dctypes:Image',
            format: 'image/jpeg',
            service: {
              id: 'service-c4'
            }
          })
        }
      ]
    }
  ];

  const mockManifesto = {
    getSequences: () => [
      {
        getCanvases: () => mockCanvases
      }
    ]
  };

  it('should return single canvas in single layout mode', () => {
    // Populate the global manifestsStore with pre-parsed canvases array
    manifestsStore.set({
      'test-manifest': {
        id: 'test-manifest',
        manifesto: mockManifesto as any,
        canvases: mockCanvases as any,
        isFetching: false,
        error: ''
      }
    });

    const state = createViewerState({ manifestId: 'test-manifest' });
    const derivedStore = createViewerDerived(state);

    state.selectedCanvasIndex.set(2);
    state.layoutMode.set('single');

    let value: any[] = [];
    derivedStore.activeLayoutImages.subscribe(val => {
      value = val;
    })();

    expect(value.length).toBe(1);
    expect(value[0].id).toBe('c2');
    expect(value[0].index).toBe(2);
  });

  it('should return cover page at index 0 in two-page mode', () => {
    manifestsStore.set({
      'test-manifest': {
        id: 'test-manifest',
        manifesto: mockManifesto as any,
        canvases: mockCanvases as any,
        isFetching: false,
        error: ''
      }
    });

    const state = createViewerState({ manifestId: 'test-manifest' });
    const derivedStore = createViewerDerived(state);

    state.selectedCanvasIndex.set(0);
    state.layoutMode.set('two-page');

    let value: any[] = [];
    derivedStore.activeLayoutImages.subscribe(val => {
      value = val;
    })();

    expect(value.length).toBe(1);
    expect(value[0].id).toBe('c0');
    expect(value[0].index).toBe(0);
  });

  it('should return paired canvases for pages 1 and 2 in two-page mode', () => {
    manifestsStore.set({
      'test-manifest': {
        id: 'test-manifest',
        manifesto: mockManifesto as any,
        canvases: mockCanvases as any,
        isFetching: false,
        error: ''
      }
    });

    const state = createViewerState({ manifestId: 'test-manifest' });
    const derivedStore = createViewerDerived(state);

    state.selectedCanvasIndex.set(1);
    state.layoutMode.set('two-page');

    let value: any[] = [];
    derivedStore.activeLayoutImages.subscribe(val => {
      value = val;
    })();

    expect(value.length).toBe(2);
    expect(value[0].id).toBe('c1');
    expect(value[1].id).toBe('c2');
  });

  it('should return all canvases in continuous scroll mode', () => {
    manifestsStore.set({
      'test-manifest': {
        id: 'test-manifest',
        manifesto: mockManifesto as any,
        canvases: mockCanvases as any,
        isFetching: false,
        error: ''
      }
    });

    const state = createViewerState({ manifestId: 'test-manifest' });
    const derivedStore = createViewerDerived(state);

    state.selectedCanvasIndex.set(0);
    state.layoutMode.set('continuous');

    let value: any[] = [];
    derivedStore.activeLayoutImages.subscribe(val => {
      value = val;
    })();

    expect(value.length).toBe(5);
    expect(value.map(v => v.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
  });

  it('keeps thumbnail navigation available on a missing image canvas', () => {
    const canvasesWithMissing = mockCanvases.map((canvas, index) =>
      index === 1 ? { ...canvas, getImages: () => [] } : canvas,
    );
    const manifestoWithMissing = {
      getSequences: () => [
        {
          getCanvases: () => canvasesWithMissing,
        },
      ],
    };

    manifestsStore.set({
      'missing-image-manifest': {
        id: 'missing-image-manifest',
        manifesto: manifestoWithMissing as any,
        canvases: canvasesWithMissing as any,
        isFetching: false,
        error: '',
      },
    });

    const state = createViewerState({ manifestId: 'missing-image-manifest' });
    const derivedStore = createViewerDerived(state);
    state.selectedCanvasIndex.set(1);

    let mediaType: string | null = 'image';
    let allowThumbnails = false;
    const unsubscribeMedia = derivedStore.mediaType.subscribe((value) => {
      mediaType = value;
    });
    const unsubscribeThumbnails = derivedStore.allowThumbnails.subscribe((value) => {
      allowThumbnails = value;
    });

    expect(mediaType).toBeNull();
    expect(allowThumbnails).toBe(true);

    unsubscribeMedia();
    unsubscribeThumbnails();
  });
});
