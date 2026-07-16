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
  import type { ViewerApiTarget } from '../core/types/viewer-api';
  import { translate } from '../i18n';
  import type { ViewBox } from '../core/types/viewer';
  import type { MediaType, MediaSource } from '../iiif/mediaResolver';
  import type { ViewerPlugin } from '../core/types/plugin';
  import type { StoryState } from '../core/types/story';
  import { normaliseStoryInput } from '../story/viewer/storyLoader';
  import { ViewerApiAdapter } from '../viewer/api/ViewerApiAdapter';

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
  let resolvedPlugins: ViewerPlugin[] = [];
  let viewerInstance: ViewerApiTarget | null = null;
  const api = new ViewerApiAdapter(() => viewerInstance);
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
        void import('../plugins/storyBuilder').then(({ createStoryBuilderPlugins }) => {
          if (requestId !== storyBuilderPluginRequest) return;
          modePlugins = createStoryBuilderPlugins({
            initialStory: loadedStory ?? undefined,
            languages: normalisedConfig.story?.languages,
            annotationPageId: normalisedConfig.story?.annotationPageId
          });
        });
      });
    } else {
      storyBuilderPluginRequest++;
      modePlugins = [];
    }
  }
  $: resolvedPlugins = [...modePlugins, ...plugins];

  async function loadStoryForBuilder(): Promise<StoryState | null> {
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
      return normalised.story;
    }
    console.error(normalised.error ?? 'Invalid Mango story AnnotationPage');
    return null;
  }

  export function getViewBox(): ViewBox | null {
    return api.getViewBox();
  }

  export function setViewBox(box: ViewBox): void {
    api.setViewBox(box);
  }

  export function getMediaType(): MediaType | null {
    return api.getMediaType();
  }

  export function getState() {
    return api.getState();
  }

  export function getCanvasIndex(): number {
    return api.getCanvasIndex();
  }

  export function getCanvasId(): string | null {
    return api.getCanvasId();

  }

  export function getCanvasCount(): number {
    return api.getCanvasCount();
  }

  export function getCanvasCount(): number {
    return viewerInstance?.getCanvasCount?.() ?? 0;
  }

  export function setCanvasByIndex(index: number): void {
    api.setCanvasByIndex(index);
  }

  export function setCanvasById(canvasId: string): void {
    api.setCanvasById(canvasId);
  }

  export function setManifest(id: string): void {
    api.setManifest(id);
  }

  export function getManifestId(): string | null {
    return api.getManifestId();
  }

  export function start(): void {
    api.start();
  }

  export function play(): void {
    api.play();
  }

  export function pause(): void {
    api.pause();
  }

  export function stop(): void {
    api.stop();
  }

  export function seekBy(delta: number): void {
    api.seekBy(delta);
  }

  export function seekTo(time: number): void {
    api.seekTo(time);

  }

  export function setMediaSegment(start: number, end: number): void {
    api.setMediaSegment(start, end);
  }

  export function setModelOrbit(orbit: string): void {
    api.setModelOrbit(orbit);
  }

  export function setModelTarget(target: string): void {
    api.setModelTarget(target);
  }

  export function setModelOrientation(orientation: string): void {
    api.setModelOrientation(orientation);
  }

  export function setModelPose(pose: ModelPose, options?: ModelPoseOptions): void {
    api.setModelPose(pose, options);
  }

  export function getModelOrbit(): string | null {
    return api.getModelOrbit();
  }

  export function getModelTarget(): string | null {
    return api.getModelTarget();
  }

  export function getModelOrientation(): string | null {
    return api.getModelOrientation();
  }

  export function getModelPose(): ModelPose | null {
    return api.getModelPose();
  }

  export function addAnnotation(annotation: unknown): Promise<void> {
    return api.addAnnotation(annotation);

  }

  export function removeAnnotation(annotationId: string): Promise<void> {
    return api.removeAnnotation(annotationId);
  }

  export function updateLayerOpacity(id: string, opacity: number): void {
    api.updateLayerOpacity(id, opacity);
  }

  export function getLayerOpacities(): Record<string, number> {
    return api.getLayerOpacities();
  }

  export function getMediaSources(): MediaSource[] {
    return api.getMediaSources();
  }

  export function on<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ) {
    return api.on(event, handler);
  }

  export function off<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ) {
    api.off(event, handler);
  }

  $: if (viewerInstance && hostElement && eventTargetOwner !== viewerInstance) {
    api.setEventTarget(hostElement);
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
