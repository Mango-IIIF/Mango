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
  import { normaliseViewerConfig, parseViewerConfig } from '../core/config/normalise';
  import type { ViewerConfig } from '../core/types/config';
  import type { ViewerEventMap } from '../core/types/events';
  import type { ModelPose, ModelPoseOptions } from '../core/types/model';
  import type { ViewerApiTarget } from '../core/types/viewer-api';
  import { translate } from '../core/i18n';
  import type { ContentSize, ViewBox } from '../core/types/viewer';
  import type { ViewerMode } from '../core/types/viewer';
  import type { MediaType, MediaSource } from '../iiif/mediaResolver';
  import type { ViewerPlugin } from '../core/types/plugin';
  import { ViewerApiAdapter } from '../viewer/api/ViewerApiAdapter';
  import type { ResolvedAnnotation } from '../iiif/annotationResolver';
  import type { StagePoint } from '../core/types/renderer';

  export let manifestId = '';
  export let config: string | ViewerConfig | undefined = undefined;
  export let mode: ViewerMode | undefined = undefined;
  export let plugins: ViewerPlugin[] = [];
  let parsedConfig: ViewerConfig | undefined;
  let normalisedConfig: ViewerConfig = {};
  let viewerInstance: ViewerApiTarget | null = null;
  const api = new ViewerApiAdapter(() => viewerInstance);
  let hostElement: HTMLDivElement | null = null;
  let eventTargetOwner: unknown = null;

  $: parsedConfig = parseViewerConfig(config, (error) => {
    console.warn(translate('warnings.invalidConfig'), error);
  });
  $: normalisedConfig = normaliseViewerConfig(parsedConfig);

  $: if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const iiifContent = urlParams.get('iiif-content');
    if (iiifContent) {
      manifestId = iiifContent;
    }
  }

  export function getViewBox(): ViewBox | null {
    return api.getViewBox();
  }

  export function getContentSize(): ContentSize | null {
    return api.getContentSize?.() ?? null;
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

  export function zoomIn(): void {
    api.zoomIn();
  }

  export function zoomOut(): void {
    api.zoomOut();
  }

  export function panTo(x: number, y: number): void {
    api.panTo(x, y);
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

  export function removeAnnotation(annotationId: string): Promise<void> {
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

<div
  class="element-root"
  class:element-root--workspace={mode === 'workspace'}
  bind:this={hostElement}
>
  <Viewer
    bind:this={viewerInstance}
    {manifestId}
    config={normalisedConfig}
    {plugins}
    {mode}
  />
</div>

<style>
  :host {
    display: block;
    width: 100%;
    /*
     * The element owns one definite block size. Embedders can override this
     * with ordinary site CSS (`mango-viewer { height: 900px; }`) or with the
     * custom property. A definite host height keeps the shadow layout from
     * alternating between percentage and intrinsic sizing at breakpoints.
     */
    height: var(--mango-viewer-height, min(720px, 100vh));
    height: var(--mango-viewer-height, min(720px, 100svh));
    min-height: 0;
  }

  .element-root {
    width: 100%;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
  }

  :host([mode='workspace']) {
    height: var(--mango-viewer-height, 100vh);
    height: var(--mango-viewer-height, 100dvh);
  }

</style>
