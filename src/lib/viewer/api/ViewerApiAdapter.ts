import type { ViewerEventMap } from "../../core/types/events";
import type { ModelPose, ModelPoseOptions } from "../../core/types/model";
import type { ViewerApiTarget } from "../../core/types/viewer-api";
import type { ContentSize, ViewBox, ViewerStateSnapshot } from "../../core/types/viewer";
import type { MediaSource, MediaType } from "../../iiif/mediaResolver";
import type { ResolvedAnnotation } from "../../iiif/annotationResolver";
import type {
  RendererExtension,
  StagePoint,
  StageSize,
} from "../../core/types/renderer";

/**
 * One forwarding contract for the Svelte component and custom-element entrypoints.
 * Keeping fallback behaviour here prevents their public APIs from drifting apart.
 */
export class ViewerApiAdapter {
  constructor(private readonly getTarget: () => ViewerApiTarget | null) {}

  on<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): () => void {
    return this.getTarget()?.on?.(event, handler) ?? (() => undefined);
  }

  off<K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ): void {
    this.getTarget()?.off?.(event, handler);
  }

  setEventTarget(target: EventTarget): void {
    this.getTarget()?.setEventTarget?.(target);
  }

  getViewBox(): ViewBox | null {
    return this.getTarget()?.getViewBox?.() ?? null;
  }
  getContentSize(): ContentSize | null {
    return this.getTarget()?.getContentSize?.() ?? null;
  }
  setViewBox(box: ViewBox): void {
    this.getTarget()?.setViewBox?.(box);
  }
  getZoom(): number {
    return this.getTarget()?.getZoom?.() ?? 100;
  }
  setZoom(percent: number): void {
    this.getTarget()?.setZoom?.(percent);
  }
  zoomIn(): void {
    this.getTarget()?.zoomIn?.();
  }
  zoomOut(): void {
    this.getTarget()?.zoomOut?.();
  }
  panTo(x: number, y: number): void {
    this.getTarget()?.panTo?.(x, y);
  }
  getMediaType(): MediaType | null {
    return this.getTarget()?.getMediaType?.() ?? null;
  }
  getState(): ViewerStateSnapshot | null {
    return this.getTarget()?.getState?.() ?? null;
  }
  getCanvasIndex(): number {
    return this.getTarget()?.getCanvasIndex?.() ?? -1;
  }
  getCanvasId(): string | null {
    return this.getTarget()?.getCanvasId?.() ?? null;
  }
  getCanvasCount(): number {
    return this.getTarget()?.getCanvasCount?.() ?? 0;
  }
  setCanvasByIndex(index: number): void {
    this.getTarget()?.setCanvasByIndex?.(index);
  }
  setCanvasById(canvasId: string): void {
    this.getTarget()?.setCanvasById?.(canvasId);
  }
  setManifest(id: string): void {
    this.getTarget()?.setManifest?.(id);
  }
  getManifestId(): string | null {
    return this.getTarget()?.getManifestId?.() ?? null;
  }
  start(): void {
    this.getTarget()?.start?.();
  }
  play(): void {
    this.getTarget()?.play?.();
  }
  pause(): void {
    this.getTarget()?.pause?.();
  }
  stop(): void {
    this.getTarget()?.stop?.();
  }
  seekBy(delta: number): void {
    this.getTarget()?.seekBy?.(delta);
  }
  seekTo(time: number): void {
    this.getTarget()?.seekTo?.(time);
  }
  setMediaSegment(start: number, end: number): void {
    this.getTarget()?.setMediaSegment?.(start, end);
  }
  setModelOrbit(orbit: string): void {
    this.getTarget()?.setModelOrbit?.(orbit);
  }
  setModelTarget(target: string): void {
    this.getTarget()?.setModelTarget?.(target);
  }
  setModelOrientation(orientation: string): void {
    this.getTarget()?.setModelOrientation?.(orientation);
  }
  setModelPose(pose: ModelPose, options?: ModelPoseOptions): void {
    this.getTarget()?.setModelPose?.(pose, options);
  }
  getModelOrbit(): string | null {
    return this.getTarget()?.getModelOrbit?.() ?? null;
  }
  getModelTarget(): string | null {
    return this.getTarget()?.getModelTarget?.() ?? null;
  }
  getModelOrientation(): string | null {
    return this.getTarget()?.getModelOrientation?.() ?? null;
  }
  getModelPose(): ModelPose | null {
    return this.getTarget()?.getModelPose?.() ?? null;
  }
  addAnnotation(annotation: unknown): Promise<void> {
    return this.getTarget()?.addAnnotation?.(annotation) ?? Promise.resolve();
  }
  getAnnotations(): ResolvedAnnotation[] {
    return this.getTarget()?.getAnnotations?.() ?? [];
  }
  setAnnotations(annotations: unknown[]): Promise<void> {
    return this.getTarget()?.setAnnotations?.(annotations) ?? Promise.resolve();
  }
  updateAnnotation(
    annotationId: string,
    patch: Partial<ResolvedAnnotation>,
  ): Promise<void> {
    return (
      this.getTarget()?.updateAnnotation?.(annotationId, patch) ??
      Promise.resolve()
    );
  }
  removeAnnotation(annotationId: string): Promise<void> {
    return (
      this.getTarget()?.removeAnnotation?.(annotationId) ?? Promise.resolve()
    );
  }
  selectAnnotation(annotationId: string, preventZoom?: boolean): void {
    this.getTarget()?.selectAnnotation?.(annotationId, preventZoom);
  }
  clearAnnotationSelection(): void {
    this.getTarget()?.clearAnnotationSelection?.();
  }
  getSelectedAnnotationId(): string | null {
    return this.getTarget()?.getSelectedAnnotationId?.() ?? null;
  }
  getRendererExtension(): RendererExtension | null {
    return this.getTarget()?.getRendererExtension?.() ?? null;
  }
  getStageSize(): StageSize {
    return this.getTarget()?.getStageSize?.() ?? { width: 0, height: 0 };
  }
  canvasToScreen(point: StagePoint): StagePoint | null {
    return this.getTarget()?.canvasToScreen?.(point) ?? null;
  }
  screenToCanvas(point: StagePoint): StagePoint | null {
    return this.getTarget()?.screenToCanvas?.(point) ?? null;
  }
  updateLayerOpacity(id: string, opacity: number): void {
    this.getTarget()?.updateLayerOpacity?.(id, opacity);
  }
  getLayerOpacities(): Record<string, number> {
    return this.getTarget()?.getLayerOpacities?.() ?? {};
  }
  getMediaSources(): MediaSource[] {
    return this.getTarget()?.getMediaSources?.() ?? [];
  }
}
