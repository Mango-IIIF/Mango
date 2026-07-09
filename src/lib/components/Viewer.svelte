<script lang="ts">
  import ViewerLayout from '../features/viewer/ViewerLayout.svelte';
  import StoryViewerLayout from '../features/storytelling/StoryViewerLayout.svelte';
  import StoryBuilderLayout from '../features/storytelling/StoryBuilderLayout.svelte';
  import WorkspaceLayout from '../features/workspace/WorkspaceLayout.svelte';
  import type { ViewerConfig } from '../core/types/config';
  import type { ViewerPlugin } from '../core/types/plugin';
  import type { ViewerEventMap } from '../core/types/events';
  import type { ViewBox } from '../core/types/viewer';
  import type { ModelPose, ModelPoseOptions } from '../core/types/model';
  import type { MediaSource } from '../iiif/mediaResolver';

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

  let layoutRef: any = $state(null);

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
    return layoutRef?.on?.(event, handler) ?? (() => undefined);
  }

  export function off<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): void {
    layoutRef?.off?.(event, handler);
  }

  export function setEventTarget(target: EventTarget): void {
    layoutRef?.setEventTarget?.(target);
  }

  export function getViewBox(): ViewBox | null {
    return layoutRef?.getViewBox?.() ?? null;
  }

  export function setViewBox(box: ViewBox): void {
    layoutRef?.setViewBox?.(box);
  }

  export function getMediaType() {
    return layoutRef?.getMediaType?.() ?? null;
  }

  export function setModelOrbit(orbit: string): void {
    layoutRef?.setModelOrbit?.(orbit);
  }

  export function setModelTarget(target: string): void {
    layoutRef?.setModelTarget?.(target);
  }

  export function setModelOrientation(orientation: string): void {
    layoutRef?.setModelOrientation?.(orientation);
  }

  export function setModelPose(pose: ModelPose, options?: ModelPoseOptions): void {
    layoutRef?.setModelPose?.(pose, options);
  }

  export function getModelOrbit(): string | null {
    return layoutRef?.getModelOrbit?.() ?? null;
  }

  export function getModelTarget(): string | null {
    return layoutRef?.getModelTarget?.() ?? null;
  }

  export function getModelOrientation(): string | null {
    return layoutRef?.getModelOrientation?.() ?? null;
  }

  export function getModelPose(): ModelPose | null {
    return layoutRef?.getModelPose?.() ?? null;
  }

  export function getState() {
    return layoutRef?.getState?.() ?? null;
  }

  export function getCanvasIndex(): number {
    return layoutRef?.getCanvasIndex?.() ?? 0;
  }

  export function getCanvasId(): string | null {
    return layoutRef?.getCanvasId?.() ?? null;
  }

  export function getCanvasCount(): number {
    return layoutRef?.getCanvasCount?.() ?? 0;
  }

  export function setCanvasByIndex(index: number): void {
    layoutRef?.setCanvasByIndex?.(index);
  }

  export function setCanvasById(canvasId: string): void {
    layoutRef?.setCanvasById?.(canvasId);
  }

  export function setManifest(id: string): void {
    layoutRef?.setManifest?.(id);
  }

  export function getManifestId(): string | null {
    return layoutRef?.getManifestId?.() ?? null;
  }

  export function start(): void {
    layoutRef?.start?.();
  }

  export function play(): void {
    layoutRef?.play?.();
  }

  export function pause(): void {
    layoutRef?.pause?.();
  }

  export function stop(): void {
    layoutRef?.stop?.();
  }

  export function seekBy(delta: number): void {
    layoutRef?.seekBy?.(delta);
  }

  export function seekTo(time: number): void {
    layoutRef?.seekTo?.(time);
  }

  export function setMediaSegment(start: number, end: number): void {
    layoutRef?.setMediaSegment?.(start, end);
  }

  export async function addAnnotation(annotation: unknown): Promise<void> {
    return layoutRef?.addAnnotation?.(annotation);
  }

  export async function removeAnnotation(annotationId: string): Promise<void> {
    return layoutRef?.removeAnnotation?.(annotationId);
  }

  export function updateLayerOpacity(id: string, opacity: number): void {
    layoutRef?.updateLayerOpacity?.(id, opacity);
  }

  export function getLayerOpacities(): Record<string, number> {
    return layoutRef?.getLayerOpacities?.() ?? {};
  }

  export function getMediaSources(): MediaSource[] {
    return layoutRef?.getMediaSources?.() ?? [];
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
