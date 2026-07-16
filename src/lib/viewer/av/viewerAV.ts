import {
  AVPlayerController,
  type AVCanvas,
  type AVManifest,
  type AVPlayerConfig,
  type JsonObject,
  type MediaSource as AVMediaSource,
} from '@mango-iiif/av/core';
import { get, writable, type Readable } from 'svelte/store';
import type { ViewerConfig } from '../../core/types/config';
import type { MediaSource } from '../../iiif/mediaResolver';
import type { ViewerStateStores } from '../state/viewerState';

export type ViewerAV = {
  controller: AVPlayerController;
  manifest: Readable<AVManifest | undefined>;
  error: Readable<Error | undefined>;
  load: (input: JsonObject | string) => Promise<AVManifest | undefined>;
  destroy: () => void;
};

const preferredLanguages = (config?: ViewerConfig): string[] => {
  if (config?.av?.preferredLanguages?.length) {
    return config.av.preferredLanguages;
  }
  const configured = config?.language?.trim();
  const browserLanguage =
    typeof navigator !== 'undefined' ? navigator.language?.trim() : undefined;
  return Array.from(
    new Set([configured, browserLanguage, 'en', 'none'].filter(Boolean) as string[]),
  );
};

const avConfig = (config?: ViewerConfig): AVPlayerConfig => ({
  ...(config?.av ?? {}),
  preferredLanguages: preferredLanguages(config),
});

const isTranscriptRendering = (id: string, format?: string): boolean => {
  const normalizedFormat = format?.toLowerCase() ?? '';
  const pathname = id.toLowerCase().split(/[?#]/)[0] ?? '';
  return (
    normalizedFormat.startsWith('text/') ||
    normalizedFormat === 'application/json' ||
    /\.(?:vtt|srt|txt|json)$/.test(pathname)
  );
};

/**
 * The AV model exposes Canvas renderings as downloads. Text renderings are also
 * valid IIIF transcript resources, so make them available to the package's
 * standalone transcript component without reparsing the source manifest.
 */
const includeRenderingTranscripts = (manifest: AVManifest): void => {
  for (const canvas of manifest.canvases) {
    const knownIds = new Set(canvas.transcripts.map((transcript) => transcript.id));
    for (const rendering of canvas.rendering) {
      if (
        knownIds.has(rendering.id) ||
        !isTranscriptRendering(rendering.id, rendering.format)
      ) {
        continue;
      }
      canvas.transcripts.push({
        id: rendering.id,
        src: rendering.id,
        label: rendering.label,
        ...(rendering.format ? { format: rendering.format } : {}),
        machineGenerated: false,
      });
      knownIds.add(rendering.id);
    }
  }
};

export const toViewerMediaSource = (
  source: AVMediaSource,
  canvas: AVCanvas,
): MediaSource => ({
  type: source.kind,
  id: source.id,
  src: source.src,
  ...(source.format ? { format: source.format } : {}),
  ...(source.width != null ? { width: source.width } : {}),
  ...(source.height != null ? { height: source.height } : {}),
  ...(source.duration != null ? { duration: source.duration } : {}),
  ...(canvas.poster ? { poster: canvas.poster } : {}),
  ...(source.label ? { label: source.label } : {}),
});

export const createViewerAV = (state: ViewerStateStores): ViewerAV => {
  const controller = new AVPlayerController(avConfig(get(state.config)));
  const manifestStore = writable<AVManifest | undefined>(undefined);
  const errorStore = writable<Error | undefined>(undefined);
  const unsubscribers: Array<() => void> = [];
  let loadToken = 0;
  let destroyed = false;

  unsubscribers.push(
    state.config.subscribe((config) => controller.configure(avConfig(config))),
  );

  unsubscribers.push(
    state.selectedCanvasIndex.subscribe((index) => {
      const manifest = controller.manifest;
      if (!manifest || index < 0 || index >= manifest.canvases.length) return;
      if (controller.state.canvasIndex !== index) {
        controller.selectCanvas(index);
      }
    }),
  );

  unsubscribers.push(
    state.selectedMediaIndex.subscribe((index) => {
      const canvas = controller.canvas;
      if (!canvas || index < 0 || index >= canvas.sources.length) return;
      if (controller.state.sourceIndex !== index) {
        controller.selectSource(index);
      }
    }),
  );

  unsubscribers.push(
    controller.on('av-ready', ({ detail }) => {
      manifestStore.set(detail.manifest);
      errorStore.set(undefined);
    }),
    controller.on('av-error', ({ detail }) => errorStore.set(detail.error)),
    controller.on('av-canvaschange', ({ detail }) => {
      if (get(state.selectedCanvasIndex) !== detail.canvasIndex) {
        state.selectedCanvasIndex.set(detail.canvasIndex);
      }
    }),
    controller.on('av-sourcechange', ({ detail }) => {
      if (get(state.selectedMediaIndex) !== detail.sourceIndex) {
        state.selectedMediaIndex.set(detail.sourceIndex);
      }
    }),
  );

  const load = async (input: JsonObject | string): Promise<AVManifest | undefined> => {
    const token = ++loadToken;
    errorStore.set(undefined);
    try {
      const manifest = await controller.load(input);
      includeRenderingTranscripts(manifest);
      if (destroyed || token !== loadToken) return undefined;
      manifestStore.set(manifest);

      const selectedCanvasIndex = get(state.selectedCanvasIndex);
      if (
        selectedCanvasIndex > 0 &&
        selectedCanvasIndex < manifest.canvases.length &&
        controller.state.canvasIndex !== selectedCanvasIndex
      ) {
        controller.selectCanvas(selectedCanvasIndex);
      }
      return manifest;
    } catch (error) {
      if (destroyed || token !== loadToken) return undefined;
      const resolved = error instanceof Error ? error : new Error(String(error));
      errorStore.set(resolved);
      return undefined;
    }
  };

  const destroy = () => {
    destroyed = true;
    loadToken += 1;
    for (const unsubscribe of unsubscribers) unsubscribe();
    controller.destroy();
  };

  return {
    controller,
    manifest: manifestStore,
    error: errorStore,
    load,
    destroy,
  };
};
