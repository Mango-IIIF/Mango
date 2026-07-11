<svelte:options
  customElement={{
    tag: 'mango-viewer',
    shadow: 'open',
    props: {
      manifestId: {
        attribute: 'manifest-id',
        type: 'String',
        reflect: true,
      },
      config: {
        attribute: 'config',
        type: 'String',
        reflect: false,
      },
      mode: {
        attribute: 'mode',
        type: 'String',
        reflect: true,
      },
      story: {
        attribute: 'story',
        type: 'String',
        reflect: true,
      },
      storyUrl: {
        attribute: 'story-url',
        type: 'String',
        reflect: true,
      },
      plugins: {
        attribute: 'plugins',
        type: 'Object',
        reflect: false,
      },
    },
  }}
/>

<script lang="ts">
  import Viewer from './Viewer.svelte';
  import { normaliseViewerConfig, parseViewerConfig } from '../config/normalise';
  import type { ViewerConfig } from '../core/types/config';
  import type { ViewerEventMap } from '../core/types/events';
  import type { ModelPose, ModelPoseOptions } from '../core/types/model';
  import type { ViewerApi } from '../core/types/viewer-api';
  import { translate } from '../i18n';
  import type { ViewBox } from '../core/types/viewer';
  import type { MediaType, MediaSource } from '../iiif/mediaResolver';
  import type { ViewerPlugin } from '../core/types/plugin';
  import type { Story } from '../core/types/story';
  import { normaliseStoryInput } from '../story/viewer/storyLoader';

  export let manifestId = '';
  export let config: string | ViewerConfig | undefined = undefined;
  export let mode: string | undefined = undefined;
  export let story: string | Record<string, unknown> | undefined = undefined;
  export let storyUrl: string | undefined = undefined;
  export let plugins: ViewerPlugin[] = [];
  let parsedConfig: ViewerConfig | undefined;
  let normalisedConfig: ViewerConfig = {};
  let modePlugins: ViewerPlugin[] = [];
  let lastMode: string | undefined = undefined;
  let lastStoryForBuilder: typeof story | typeof storyUrl = undefined;
  let builderStoryData: Record<string, unknown> | null = null;
  let resolvedPlugins: ViewerPlugin[] = [];
  let viewerInstance: (ViewerApi & { setEventTarget?: (target: EventTarget) => void }) | null = null;
  let hostElement: HTMLDivElement | null = null;
  let eventTargetOwner: unknown = null;
  let storyBuilderPluginRequest = 0;

  $: parsedConfig = parseViewerConfig(config, (error) => {
    console.warn(translate('warnings.invalidConfig'), error);
  });
  $: normalisedConfig = normaliseViewerConfig(parsedConfig);

  $: if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const iiifContent = urlParams.get('iiif-content');
    if (iiifContent) {
      if (mode === 'story-viewer' || mode === 'story-builder') {
        storyUrl = iiifContent;
      } else {
        manifestId = iiifContent;
      }
    }
  }
  $: if (mode !== lastMode || (mode === 'story-builder' && (story !== lastStoryForBuilder || storyUrl !== lastStoryForBuilder))) {
    lastMode = mode;
    if (mode === 'story-builder') {
      lastStoryForBuilder = story || storyUrl;
      const requestId = ++storyBuilderPluginRequest;
      void loadStoryForBuilder().then((loadedStory) => {
        if (requestId !== storyBuilderPluginRequest) return;
        builderStoryData = loadedStory;
        void import('../plugins/storyBuilder').then(({ createStoryBuilderPlugins }) => {
          if (requestId !== storyBuilderPluginRequest) return;
          modePlugins = createStoryBuilderPlugins({
            initialStory: loadedStory as Story | undefined,
            languages: normalisedConfig.story?.languages
          });
        });
      });
    } else {
      storyBuilderPluginRequest++;
      builderStoryData = null;
      modePlugins = [];
    }
  }
  $: resolvedPlugins = [...modePlugins, ...plugins];

  async function loadStoryForBuilder(): Promise<Record<string, unknown> | null> {
    let source: unknown = undefined;
    if (story !== undefined && story !== null && `${story}` !== '') {
      source = story;
    } else if (storyUrl) {
      try {
        const response = await fetch(storyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        source = await response.json();
      } catch (error) {
        console.error('Failed to load story for builder:', error);
        return null;
      }
    } else {
      return null;
    }

    let parsed: unknown = source;
    if (typeof source === 'string') {
      try {
        parsed = JSON.parse(source);
      } catch (error) {
        console.error('Invalid story JSON:', error);
        return null;
      }
    }

    // Parse and normalise the story input to support standard IIIF Presentation API v3 AnnotationPages
    const normalised = normaliseStoryInput(parsed);
    if (normalised.ok && normalised.story) {
      return normalised.story as any;
    }

    // Extract story data from envelope if needed
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return parsed.data as Record<string, unknown>;
    }

    return parsed as Record<string, unknown>;
  }

  export function getViewBox(): ViewBox | null {
    return viewerInstance?.getViewBox?.() ?? null;
  }

  export function setViewBox(box: ViewBox): void {
    viewerInstance?.setViewBox?.(box);
  }

  export function getMediaType(): MediaType | null {
    return viewerInstance?.getMediaType?.() ?? null;
  }

  export function getState() {
    return viewerInstance?.getState?.() ?? null;
  }

  export function getCanvasIndex(): number {
    return viewerInstance?.getCanvasIndex?.() ?? -1;
  }

  export function getCanvasId(): string | null {
    return viewerInstance?.getCanvasId?.() ?? null;
  }

  export function setCanvasByIndex(index: number): void {
    viewerInstance?.setCanvasByIndex?.(index);
  }

  export function setCanvasById(canvasId: string): void {
    viewerInstance?.setCanvasById?.(canvasId);
  }

  export function setManifest(id: string): void {
    viewerInstance?.setManifest?.(id);
  }

  export function getManifestId(): string | null {
    return viewerInstance?.getManifestId?.() ?? null;
  }

  export function start(): void {
    viewerInstance?.start?.();
  }

  export function play(): void {
    viewerInstance?.play?.();
  }

  export function pause(): void {
    viewerInstance?.pause?.();
  }

  export function stop(): void {
    viewerInstance?.stop?.();
  }

  export function seekBy(delta: number): void {
    viewerInstance?.seekBy?.(delta);
  }

  export function seekTo(time: number): void {
    viewerInstance?.seekTo?.(time);
  }

  export function setModelOrbit(orbit: string): void {
    viewerInstance?.setModelOrbit?.(orbit);
  }

  export function setModelTarget(target: string): void {
    viewerInstance?.setModelTarget?.(target);
  }

  export function setModelOrientation(orientation: string): void {
    viewerInstance?.setModelOrientation?.(orientation);
  }

  export function setModelPose(pose: ModelPose, options?: ModelPoseOptions): void {
    viewerInstance?.setModelPose?.(pose, options);
  }

  export function getModelOrbit(): string | null {
    return viewerInstance?.getModelOrbit?.() ?? null;
  }

  export function getModelTarget(): string | null {
    return viewerInstance?.getModelTarget?.() ?? null;
  }

  export function getModelOrientation(): string | null {
    return viewerInstance?.getModelOrientation?.() ?? null;
  }

  export function getModelPose(): ModelPose | null {
    return viewerInstance?.getModelPose?.() ?? null;
  }

  export function addAnnotation(annotation: unknown): Promise<void> {
    return viewerInstance?.addAnnotation?.(annotation) ?? Promise.resolve();
  }

  export function updateLayerOpacity(id: string, opacity: number): void {
    viewerInstance?.updateLayerOpacity?.(id, opacity);
  }

  export function getLayerOpacities(): Record<string, number> {
    return viewerInstance?.getLayerOpacities?.() ?? {};
  }

  export function getMediaSources(): MediaSource[] {
    return viewerInstance?.getMediaSources?.() ?? [];
  }

  export function on<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ) {
    return viewerInstance?.on?.(event, handler) ?? (() => undefined);
  }

  export function off<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ) {
    viewerInstance?.off?.(event, handler);
  }

  $: if (viewerInstance && hostElement && eventTargetOwner !== viewerInstance) {
    viewerInstance?.setEventTarget?.(hostElement);
    eventTargetOwner = viewerInstance;
  }
</script>

<div class="element-root" bind:this={hostElement}>
  <Viewer
    bind:this={viewerInstance}
    {manifestId}
    config={normalisedConfig}
    {story}
    storyUrl={storyUrl}
    plugins={resolvedPlugins}
    {mode}
  />
</div>

<style>
  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  .element-root {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
</style>
