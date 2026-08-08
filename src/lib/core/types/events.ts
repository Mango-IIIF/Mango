import type { JsonObject } from '@mango-iiif/w3c-parser';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import type { ChapterAnnotationTool } from './story';
import type { MediaType } from '../../iiif/mediaResolver';
import type { ModelPose } from './model';
import type { ViewBox, ViewerStateSnapshot } from './viewer';

export type ModelViewChange = {
  source?: string;
} & ModelPose;

export type ViewerEventMap = {
  manifestChange: { manifestId: string };
  pageChange: { canvasId: string; index: number; label?: string };
  mediaChange: { canvasId: string; mediaType: MediaType };
  zoomChange: { zoom: number; viewBox: ViewBox };
  viewBoxChange: { viewBox: ViewBox };
  mediaPlay: { canvasId: string; time: number };
  mediaPause: { canvasId: string; time: number };
  mediaTimeUpdate: { canvasId: string; time: number; duration?: number };
  mediaSeek: { canvasId: string; from: number; to: number };
  mediaSegmentEnd: { canvasId: string };
  modelChange: { canvasId: string } & ModelViewChange;
  addAnnotation: { annotation: unknown };
  updateAnnotation: { annotation: unknown };
  removeAnnotation: { annotationId: string };
  annotationCreate: { annotation: unknown; tool?: ChapterAnnotationTool };
  annotationUpdate: {
    annotationId: string;
    patch: Partial<ResolvedAnnotation>;
  };
  /** Edits on an annotation were committed as one save. */
  annotationSave: { annotationId: string; annotation: ResolvedAnnotation };
  annotationDelete: { annotationId: string };
  annotationHover: {
    id: string | null;
    annotation?: ResolvedAnnotation | null;
  };
  annotationSelect: {
    id: string;
    annotation?: ResolvedAnnotation | null;
    preventZoom?: boolean;
  };
  annotationClear: void;
  rotationChange: { rotation: number };
  /**
   * @deprecated Internal projections, kept for one cycle. Use
   * `exportAnnotationPage`, which carries portable JSON-LD instead.
   */
  exportAnnotations: { annotations: ResolvedAnnotation[] };
  /** Standards-shaped export: an AnnotationPage plus what the host must decide. */
  exportAnnotationPage: {
    page: JsonObject;
    valid: boolean;
    /** Private fields withheld from this export. */
    excludedPrivateFields: Array<{ annotationId: string; keys: string[] }>;
    /** Annotations that still need a server-assigned identifier. */
    unresolvedIdentities: string[];
  };
  panelToggle: {
    panel: 'thumbnails' | 'search' | 'metadata' | 'annotations' | 'tools' | string;
    open: boolean;
  };
  stateChange: { snapshot: ViewerStateSnapshot };
  /**
   * Requests a stage opacity, so a mode driving chapter changes can hide the
   * swap between two unrelated sources. Emitted by the story builder; the story
   * viewer reaches its stage through its own runtime.
   */
  stageFade: { opacity: number; durationMs: number };
  storyViewerError: { message: string; cause?: unknown };
  pluginError: {
    pluginId: string;
    pluginLabel: string;
    phase: 'init' | 'destroy';
    message: string;
    cause?: unknown;
  };
  error: {
    scope: 'manifest' | 'media' | 'search' | 'annotations';
    message: string;
    cause?: unknown;
  };
};

export type EventBus<EventMap extends Record<string, unknown>> = {
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): () => void;
  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
};

export type ViewerEventBus = EventBus<ViewerEventMap>;

export type ViewerEventEmitter = <K extends keyof ViewerEventMap>(
  event: K,
  payload: ViewerEventMap[K],
) => void;
