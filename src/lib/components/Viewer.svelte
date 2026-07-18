<script lang="ts">
  import ViewerLayout from '../features/viewer/ViewerLayout.svelte';
  import WorkspaceLayout from '../features/workspace/WorkspaceLayout.svelte';
  import type { ViewerConfig } from '../core/types/config';
  import type { ViewerPlugin } from '../core/types/plugin';
  import type { ViewerEventMap } from '../core/types/events';
  import type { ViewBox } from '../core/types/viewer';
  import type { ModelPose, ModelPoseOptions } from '../core/types/model';
  import type { MediaSource } from '../iiif/mediaResolver';
  import type { ViewerApiTarget } from '../core/types/viewer-api';
  import { ViewerApiAdapter } from '../viewer/api/ViewerApiAdapter';

  interface Props {
    manifestId?: string;
    config?: ViewerConfig | undefined;
    plugins?: ViewerPlugin[];
    mode?: string | undefined;
    story?: string | Record<string, unknown> | undefined;
    storyUrl?: string | undefined;
  }

  let {
    manifestId = $bindable(''),
    config = undefined,
    plugins = [],
    mode = undefined,
    story = undefined,
    storyUrl = $bindable(undefined),
  }: Props = $props();

  let layoutRef: ViewerApiTarget | null = $state(null);
  const api = new ViewerApiAdapter(() => layoutRef);

  $effect(() => {
    if (typeof window !== 'undefined') {
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
  });

  export function on<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): () => void {
    return api.on(event, handler);
  }

  export function off<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): void {
    api.off(event, handler);
  }

  export function setEventTarget(target: EventTarget): void {
    api.setEventTarget(target);
  }

  export function getViewBox(): ViewBox | null {
    return api.getViewBox();
  }

  export function setViewBox(box: ViewBox): void {
    api.setViewBox(box);
  }

  export function getMediaType() {
    return api.getMediaType();
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

  export async function addAnnotation(annotation: unknown): Promise<void> {
    return api.addAnnotation(annotation);
  }

  export async function removeAnnotation(annotationId: string): Promise<void> {
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
</script>

{#if mode === 'workspace'}
  <WorkspaceLayout
    bind:this={layoutRef}
    bind:manifestId
    {config}
    {plugins}
  />
{:else}
  <ViewerLayout
    bind:this={layoutRef}
    bind:manifestId
    {config}
    {plugins}
    mode={mode}
    {story}
    {storyUrl}
  />
{/if}
