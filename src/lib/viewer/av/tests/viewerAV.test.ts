import { afterEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { createViewerState } from '../../state/viewerState';
import { createViewerAV, toViewerMediaSource, type ViewerAV } from '../viewerAV';

const manifest = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://example.org/manifest',
  type: 'Manifest',
  label: { en: ['AV manifest'] },
  items: [
    {
      id: 'https://example.org/canvas/video',
      type: 'Canvas',
      duration: 120,
      items: [
        {
          id: 'https://example.org/page/video',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/annotation/video',
              type: 'Annotation',
              motivation: 'painting',
              target: 'https://example.org/canvas/video',
              body: {
                type: 'Choice',
                items: [
                  {
                    id: 'https://example.org/video/master.m3u8',
                    type: 'Video',
                    format: 'application/vnd.apple.mpegurl',
                  },
                  {
                    id: 'https://example.org/video/fallback.mp4',
                    type: 'Video',
                    format: 'video/mp4',
                  },
                ],
              },
            },
          ],
        },
      ],
      annotations: [
        {
          id: 'https://example.org/page/transcript',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/annotation/transcript',
              type: 'Annotation',
              motivation: 'supplementing',
              target: 'https://example.org/canvas/video',
              body: {
                id: 'https://example.org/transcript.vtt',
                type: 'Text',
                format: 'text/vtt',
                label: { en: ['Transcript'] },
              },
            },
          ],
        },
      ],
      rendering: [
        {
          id: 'https://example.org/transcript.txt',
          type: 'Text',
          format: 'text/plain',
          label: { en: ['Plain text transcript'] },
        },
      ],
    },
    {
      id: 'https://example.org/canvas/audio',
      type: 'Canvas',
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
  structures: [
    {
      id: 'https://example.org/range/opening',
      type: 'Range',
      label: { en: ['Opening'] },
      items: [
        {
          id: 'https://example.org/canvas/video#t=10,20',
          type: 'Canvas',
        },
      ],
    },
  ],
};

describe('viewer AV integration', () => {
  let integration: ViewerAV | undefined;

  afterEach(() => integration?.destroy());

  it('normalizes HLS, alternate sources, chapters, and transcripts with the AV package', async () => {
    const state = createViewerState();
    integration = createViewerAV(state);

    const normalized = await integration.load(manifest);

    expect(normalized?.canvases[0]?.sources).toHaveLength(2);
    expect(normalized?.canvases[0]?.sources[0]).toMatchObject({
      kind: 'video',
      isHls: true,
      src: 'https://example.org/video/master.m3u8',
    });
    expect(normalized?.canvases[0]?.transcripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: 'https://example.org/transcript.vtt',
          label: 'Transcript',
        }),
        expect.objectContaining({
          src: 'https://example.org/transcript.txt',
          label: 'Plain text transcript',
          format: 'text/plain',
        }),
      ]),
    );
    expect(normalized?.chapters[0]).toMatchObject({
      label: 'Opening',
      canvasId: 'https://example.org/canvas/video',
      time: { start: 10, end: 20 },
    });
    expect(get(integration.manifest)).toBe(normalized);

    const viewerSource = toViewerMediaSource(
      normalized!.canvases[0]!.sources[0]!,
      normalized!.canvases[0]!,
    );
    expect(viewerSource).toMatchObject({
      type: 'video',
      src: 'https://example.org/video/master.m3u8',
      format: 'application/vnd.apple.mpegurl',
    });
  });

  it('seeks between chapters on the active canvas without rebuilding the media player', async () => {
    const state = createViewerState();
    integration = createViewerAV(state);
    await integration.load(manifest);

    let canvasChanges = 0;
    const unsubscribe = integration.controller.on('av-canvaschange', () => {
      canvasChanges += 1;
    });

    const activeCanvas = integration.controller.canvas;
    integration.controller.selectCanvas(activeCanvas!.id, { time: 12 });

    expect(integration.controller.canvas).toBe(activeCanvas);
    expect(integration.controller.state.currentTime).toBe(12);
    expect(canvasChanges).toBe(0);
    unsubscribe();
  });

  it('keeps Mango canvas and source selection synchronized with the package controller', async () => {
    const state = createViewerState();
    integration = createViewerAV(state);
    await integration.load(manifest);

    integration.controller.selectSource(1);
    expect(get(state.selectedMediaIndex)).toBe(1);

    integration.controller.selectCanvas(1);
    expect(get(state.selectedCanvasIndex)).toBe(1);

    state.selectedCanvasIndex.set(0);
    expect(integration.controller.canvas?.id).toBe('https://example.org/canvas/video');

    state.selectedMediaIndex.set(0);
    expect(integration.controller.source?.src).toBe(
      'https://example.org/video/master.m3u8',
    );
  });

  it('configures default audioArt properties and allows overrides', () => {
    const state = createViewerState();
    integration = createViewerAV(state);
    expect(integration.controller.config.controls).toMatchObject({
      navigation: false,
      autoAdvance: false,
    });
    expect(integration.controller.config.audioArt).toEqual({
      transcript: true,
      visualizer: 'pulse',
    });

    state.config.set({
      av: {
        audioArt: {
          transcript: false,
          visualizer: 'waveform',
        },
      },
    });
    expect(integration.controller.config.audioArt).toEqual({
      transcript: false,
      visualizer: 'waveform',
    });
  });
});
