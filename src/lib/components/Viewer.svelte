<script lang="ts">
  import ViewerLayout from '../features/viewer/ViewerLayout.svelte';
  import WorkspaceLayout from '../features/workspace/WorkspaceLayout.svelte';
  import type { ViewerConfig } from '../core/types/config';
  import type { ViewerPlugin } from '../core/types/plugin';
  import type { ViewerEventMap } from '../core/types/events';
  import type { ContentSize, ViewBox } from '../core/types/viewer';
  import type { ViewerMode } from '../core/types/viewer';
  import type { ModelPose, ModelPoseOptions } from '../core/types/model';
  import type { MediaSource } from '../iiif/mediaResolver';
  import type { ViewerApiTarget } from '../core/types/viewer-api';
  import { ViewerApiAdapter } from '../viewer/api/ViewerApiAdapter';
  import type { ResolvedAnnotation } from '../iiif/annotationResolver';
  import type { StagePoint } from '../core/types/renderer';

  interface Props {
    manifestId?: string;
    config?: ViewerConfig | undefined;
    plugins?: ViewerPlugin[];
    mode?: ViewerMode | undefined;
  }

  let {
    manifestId = $bindable(''),
    config = undefined,
    plugins = [],
    mode = undefined,
  }: Props = $props();

  let layoutRef: ViewerApiTarget | null = $state(null);
  const api = new ViewerApiAdapter(() => layoutRef);

  $effect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const iiifContent = urlParams.get('iiif-content');
      if (iiifContent) {
        manifestId = iiifContent;
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

  export function getContentSize(): ContentSize | null {
    return api.getContentSize?.() ?? null;
  }

  export function getViewBox(): ViewBox | null {
    return api.getViewBox();
  }

  export function setViewBox(box: ViewBox): void {
    api.setViewBox(box);
  }

  export function getZoom(): number {
    return api.getZoom();
  }

  export function setZoom(percent: number): void {
    api.setZoom(percent);
  }

  export function goHome(): void {
    api.goHome();
  }

  export function zoomIn(): void {
    api.zoomIn();
  }

  export function zoomOut(): void {
    api.zoomOut();
  }

  export function panTo(x: number, y: number): void {
    api.panTo(x, y);
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

  export function getAnnotations(): ResolvedAnnotation[] {
    return api.getAnnotations();
  }

  export function setAnnotations(annotations: unknown[]): Promise<void> {
    return api.setAnnotations(annotations);
  }

  export function updateAnnotation(
    annotationId: string,
    patch: Partial<ResolvedAnnotation>,
  ): Promise<void> {
    return api.updateAnnotation(annotationId, patch);
  }

  export async function removeAnnotation(annotationId: string): Promise<void> {
    return api.removeAnnotation(annotationId);
  }

  export function selectAnnotation(annotationId: string, preventZoom?: boolean): void {
    api.selectAnnotation(annotationId, preventZoom);
  }

  export function clearAnnotationSelection(): void {
    api.clearAnnotationSelection();
  }

  export function getSelectedAnnotationId(): string | null {
    return api.getSelectedAnnotationId();
  }

  export function getRendererExtension() {
    return api.getRendererExtension();
  }

  export function getStageSize() {
    return api.getStageSize();
  }

  export function canvasToScreen(point: StagePoint) {
    return api.canvasToScreen(point);
  }

  export function screenToCanvas(point: StagePoint) {
    return api.screenToCanvas(point);
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
    chrome={true}
  />
{/if}
