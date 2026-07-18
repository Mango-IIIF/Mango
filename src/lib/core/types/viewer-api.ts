import type { MediaSource, MediaType } from "../../iiif/mediaResolver";
import type { ModelPose, ModelPoseOptions } from "./model";
import type { ViewerEventMap } from "./events";
import type { ViewBox, ViewerStateSnapshot } from "./viewer";

export type ViewerApi = {
  getViewBox: () => ViewBox | null;
  setViewBox: (box: ViewBox) => void;
  getMediaType: () => MediaType | null;
  getState: () => ViewerStateSnapshot | null;
  getCanvasIndex: () => number;
  getCanvasId: () => string | null;
  getCanvasCount?: () => number;
  setCanvasByIndex: (index: number) => void;
  setCanvasById: (canvasId: string) => void;
  setManifest: (id: string) => void;
  getManifestId: () => string | null;
  start?: () => void;
  play?: () => void;
  pause?: () => void;
  stop?: () => void;
  seekBy?: (delta: number) => void;
  seekTo?: (time: number) => void;
  setMediaSegment?: (start: number, end: number) => void;
  setModelPose?: (pose: ModelPose, options?: ModelPoseOptions) => void;
  setModelOrbit: (orbit: string) => void;
  setModelTarget: (target: string) => void;
  setModelOrientation: (orientation: string) => void;
  getModelPose?: () => ModelPose | null;
  getModelOrbit?: () => string | null;
  getModelTarget?: () => string | null;
  getModelOrientation?: () => string | null;
  addAnnotation: (annotation: unknown) => Promise<void>;
  removeAnnotation: (annotationId: string) => Promise<void>;
  updateLayerOpacity?: (id: string, opacity: number) => void;
  getLayerOpacities?: () => Record<string, number>;
  getMediaSources?: () => MediaSource[];
  on: <K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ) => () => void;
  off: <K extends keyof ViewerEventMap>(
    event: K,
    handler: (payload: ViewerEventMap[K]) => void,
  ) => void;
};

export type ViewerApiTarget = Partial<ViewerApi> & {
  setEventTarget?: (target: EventTarget) => void;
};
