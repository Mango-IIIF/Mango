import type { ResolvedAnnotation } from "../../iiif/annotationResolver";
import type { MediaType } from "../../iiif/mediaResolver";
import type { ModelPose } from "./model";
import type { ViewBox, ViewerStateSnapshot } from "./viewer";

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
  annotationCreate: { annotation: unknown };
  annotationUpdate: {
    annotationId: string;
    patch: Partial<ResolvedAnnotation>;
  };
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
  exportAnnotations: { annotations: ResolvedAnnotation[] };
  panelToggle: {
    panel:
      "thumbnails" | "search" | "metadata" | "annotations" | "tools" | string;
    open: boolean;
  };
  stateChange: { snapshot: ViewerStateSnapshot };
  storyViewerError: { message: string; cause?: unknown };
  pluginError: {
    pluginId: string;
    pluginLabel: string;
    phase: "init" | "destroy";
    message: string;
    cause?: unknown;
  };
  error: {
    scope: "manifest" | "media" | "search" | "annotations";
    message: string;
    cause?: unknown;
  };
};

export type EventBus<EventMap extends Record<string, unknown>> = {
  on<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void,
  ): () => void;
  off<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void,
  ): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
};

export type ViewerEventBus = EventBus<ViewerEventMap>;

export type ViewerEventEmitter = <K extends keyof ViewerEventMap>(
  event: K,
  payload: ViewerEventMap[K],
) => void;
