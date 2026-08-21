import type { MediaSource, MediaType } from '../../iiif/mediaResolver';
import type { ModelPose, ModelPoseOptions } from './model';
import type { ViewerEventMap } from './events';
import type { ContentSize, ViewBox, ViewerStateSnapshot } from './viewer';
import type { ChapterAnnotationTool, StoryFrame } from './story';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';

export type ViewerApi = {
  getViewBox: () => ViewBox | null;
  setViewBox: (box: ViewBox) => void;
  /**
   * Intrinsic dimensions of the open image, independent of the viewport. Lets
   * callers reason about the source itself rather than the shape of whatever
   * container it currently happens to be displayed in.
   */
  getContentSize?: () => ContentSize | null;
  /** Current zoom as a percentage of the fit-to-view baseline (100 = fit). */
  getZoom?: () => number;
  /** Zoom to a percentage of the fit-to-view baseline. Clamped to 10–2000. */
  setZoom?: (percent: number) => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  /** Recentre on an image-space point, keeping the current zoom. */
  panTo?: (x: number, y: number) => void;
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
  setAnnotationTool?: (tool: ChapterAnnotationTool) => void;
  setStoryAnnotations?: (annotations: ResolvedAnnotation[]) => void;
  setStoryAnnotationEditing?: (enabled: boolean) => void;
  setStoryAnnotationSelection?: (annotationId: string | null) => void;
  /** Fixed width/height contract for the builder's authored output surface. */
  setStoryPresentationAspect?: (aspect: number) => void;
  /**
   * Camera-keyframe objects the story builder wants drawn on the stage.
   * Chapter framing itself is the fixed stage camera, not a second rectangle.
   */
  setStoryFrames?: (frames: StoryFrame[]) => void;
  /** Which of the frames carries the handles. */
  setStoryFrameSelection?: (frameId: string | null) => void;
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
