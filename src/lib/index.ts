import { mount, unmount } from 'svelte';
import ViewerComponent from './components/Viewer.svelte';
import { normaliseViewerConfig, parseViewerConfig } from './config/normalise';
import type { ViewerConfig } from './core/types/config';
import type { ViewerEventMap } from './core/types/events';
import type { ViewerPlugin } from './core/types/plugin';
import type { ModelPose, ModelPoseOptions } from './core/types/model';
import type { ViewerApi } from './core/types/viewer-api';
import type { ViewBox, ViewerStateSnapshot } from './core/types/viewer';
import { registerPlugin } from './plugins/registry';
import type { MediaType, MediaSource } from './iiif/mediaResolver';

export type MangoOptions = {
  target: HTMLElement;
  manifestId?: string;
  config?: ViewerConfig | string;
  plugins?: ViewerPlugin[];
};

export class Mango implements ViewerApi {
  private instance: ReturnType<typeof mount>;
  private manifestId: string;

  constructor({ target, manifestId = '', config, plugins = [] }: MangoOptions) {
    this.manifestId = manifestId;
    const parsedConfig = parseViewerConfig(config, (error) => {
      console.warn('Invalid viewer config supplied to Mango()', error);
    });
    const normalisedConfig = normaliseViewerConfig(parsedConfig);
    this.instance = mount(ViewerComponent, {
      target,
      props: {
        manifestId,
        config: normalisedConfig,
        plugins,
      },
    });
    const api = this.instance as { setEventTarget?: (target: HTMLElement) => void };
    api?.setEventTarget?.(target);
  }

  getManifestId(): string | null {
    return this.manifestId || null;
  }

  getViewBox(): ViewBox | null {
    const instance = this.instance as { getViewBox?: () => ViewBox | null };
    return instance?.getViewBox?.() ?? null;
  }

  setViewBox(box: ViewBox): void {
    const instance = this.instance as { setViewBox?: (value: ViewBox) => void };
    instance?.setViewBox?.(box);
  }

  getMediaType(): MediaType | null {
    const instance = this.instance as { getMediaType?: () => MediaType | null };
    return instance?.getMediaType?.() ?? null;
  }

  getState(): ViewerStateSnapshot | null {
    const instance = this.instance as {
      getState?: () => ViewerStateSnapshot | null;
    };
    return instance?.getState?.() ?? null;
  }

  setManifest(manifestId: string): void {
    this.manifestId = manifestId;
    const instance = this.instance as { setManifest?: (id: string) => void };
    instance?.setManifest?.(manifestId);
  }

  setCanvasByIndex(index: number): void {
    const instance = this.instance as {
      setCanvasByIndex?: (value: number) => void;
    };
    instance?.setCanvasByIndex?.(index);
  }

  setCanvasById(canvasId: string): void {
    const instance = this.instance as {
      setCanvasById?: (value: string) => void;
    };
    instance?.setCanvasById?.(canvasId);
  }

  start(): void {
    const instance = this.instance as { start?: () => void };
    instance?.start?.();
  }

  play(): void {
    const instance = this.instance as { play?: () => void };
    instance?.play?.();
  }

  pause(): void {
    const instance = this.instance as { pause?: () => void };
    instance?.pause?.();
  }

  stop(): void {
    const instance = this.instance as { stop?: () => void };
    instance?.stop?.();
  }

  seekBy(delta: number): void {
    const instance = this.instance as { seekBy?: (value: number) => void };
    instance?.seekBy?.(delta);
  }

  seekTo(time: number): void {
    const instance = this.instance as { seekTo?: (value: number) => void };
    instance?.seekTo?.(time);
  }

  setModelOrbit(orbit: string): void {
    const instance = this.instance as { setModelOrbit?: (value: string) => void };
    instance?.setModelOrbit?.(orbit);
  }

  setModelTarget(target: string): void {
    const instance = this.instance as { setModelTarget?: (value: string) => void };
    instance?.setModelTarget?.(target);
  }

  setModelOrientation(orientation: string): void {
    const instance = this.instance as {
      setModelOrientation?: (value: string) => void;
    };
    instance?.setModelOrientation?.(orientation);
  }

  setModelPose(pose: ModelPose, options?: ModelPoseOptions): void {
    const instance = this.instance as {
      setModelPose?: (value: ModelPose, options?: ModelPoseOptions) => void;
    };
    instance?.setModelPose?.(pose, options);
  }

  getModelOrbit(): string | null {
    const instance = this.instance as { getModelOrbit?: () => string | null };
    return instance?.getModelOrbit?.() ?? null;
  }

  getModelTarget(): string | null {
    const instance = this.instance as { getModelTarget?: () => string | null };
    return instance?.getModelTarget?.() ?? null;
  }

  getModelOrientation(): string | null {
    const instance = this.instance as { getModelOrientation?: () => string | null };
    return instance?.getModelOrientation?.() ?? null;
  }

  getModelPose(): ModelPose | null {
    const instance = this.instance as { getModelPose?: () => ModelPose | null };
    return instance?.getModelPose?.() ?? null;
  }

  getCanvasIndex(): number {
    const instance = this.instance as { getCanvasIndex?: () => number };
    return instance?.getCanvasIndex?.() ?? -1;
  }

  getCanvasId(): string | null {
    const instance = this.instance as { getCanvasId?: () => string | null };
    return instance?.getCanvasId?.() ?? null;
  }

  addAnnotation(annotation: unknown): Promise<void> {
    const instance = this.instance as {
      addAnnotation?: (value: unknown) => Promise<void>;
    };
    return instance?.addAnnotation?.(annotation) ?? Promise.resolve();
  }

  removeAnnotation(annotationId: string): Promise<void> {
    const instance = this.instance as {
      removeAnnotation?: (value: string) => Promise<void>;
    };
    return instance?.removeAnnotation?.(annotationId) ?? Promise.resolve();
  }

  updateLayerOpacity(id: string, opacity: number): void {
    const instance = this.instance as { updateLayerOpacity?: (id: string, opacity: number) => void };
    instance?.updateLayerOpacity?.(id, opacity);
  }

  getLayerOpacities(): Record<string, number> {
    const instance = this.instance as { getLayerOpacities?: () => Record<string, number> };
    return instance?.getLayerOpacities?.() ?? {};
  }

  getMediaSources(): MediaSource[] {
    const instance = this.instance as { getMediaSources?: () => MediaSource[] };
    return instance?.getMediaSources?.() ?? [];
  }

  on<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): () => void {
    const instance = this.instance as {
      on?: (evt: K, cb: (payload: ViewerEventMap[K]) => void) => () => void;
    };
    return instance?.on?.(event, handler) ?? (() => undefined);
  }

  off<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): void {
    const instance = this.instance as {
      off?: (evt: K, cb: (payload: ViewerEventMap[K]) => void) => void;
    };
    instance?.off?.(event, handler);
  }

  destroy(): void {
    unmount(this.instance);
  }
}

export { ViewerComponent };
export type { ViewerConfig } from './core/types/config';
export type { ViewBox, ViewerStateSnapshot } from './core/types/viewer';
export type {
  PluginCapabilities,
  PluginContext,
  PluginLifecycle,
  PluginSlot,
  ViewerPlugin,
} from './core/types/plugin';
export type { MediaType, MediaSource } from './iiif/mediaResolver';
export { registerPlugin };
export { createHelloPanelPlugin } from './plugins/helloPanel';
export { createAddAnnotationPlugin } from './plugins/addAnnotation';
export type { ViewerEventBus, ViewerEventMap } from './core/types/events';
export type { ViewerApi } from './core/types/viewer-api';
export type { ModelPose, ModelPoseOptions, ModelPoseTransition } from './core/types/model';
export type {
  AnnotationPlacement,
  Chapter,
  ChapterAdvance,
  ChapterAnnotation,
  ChapterMedia,
  ChapterModel,
  LanguageMap,
  NarrationSegment,
  NarrationTrack,
  Story,
} from './core/types/story';
