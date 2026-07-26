import type { ModelPose, ModelPoseOptions } from './model';
import type { ViewBox } from './viewer';

export type LanguageMap = Record<string, string>;

export type AnnotationPlacement = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type NarrationTrack = {
  src: string;
};

export type NarrationSegment = {
  start: number;
  end: number;
};

export type ChapterAnnotation = {
  text?: string;
  placement?: AnnotationPlacement;
};

export type ChapterAnnotationTool =
  'select' | 'rectangle' | 'polygon' | 'point' | 'freehand' | 'line';

export type ChapterDrawingAnnotation = {
  id: string;
  type: Exclude<ChapterAnnotationTool, 'select'>;
  text?: string;
  rect?: AnnotationPlacement;
  point?: { x: number; y: number };
  points?: Array<{ x: number; y: number }>;
};

export type ChapterAdvance = {
  mode: 'manual' | 'auto' | 'both';
  delayMs?: number;
};

export type ChapterEntryTransition = {
  type: 'cut' | 'tween' | 'crossfade';
  durationMs: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
};

export type ChapterCameraKeyframe = {
  /** Stable editor identity; it is not derived from ordering or timing. */
  id: string;
  /** Position on the chapter presentation clock. */
  timeMs: number;
  /** Dwell time in ms to hold on this keyframe before resuming motion. */
  dwellMs?: number;
  /** Canvas-coordinate focal point selected directly on the artwork. */
  focus?: { x: number; y: number };
  viewBox?: ViewBox;
  model?: ChapterModel;
  layerOpacities?: Record<string, number>;
};

export type ChapterCameraTrack = {
  durationMs: number;
  keyframes: ChapterCameraKeyframe[];
  preset?:
    | 'static'
    | 'zoom-in'
    | 'zoom-out'
    | 'pan'
    | 'drift-zoom'
    | 'custom'
    | 'ken-burns'
    | 'hero-reveal'
    | 'arc-sweep';
  pathType?: 'linear' | 'spline';
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
};

export type StoryPublication = {
  /** Base used for chapter Annotation identifiers. Defaults to `${story.id}/annotation/`. */
  annotationBase?: string;
  /** Host integrations can lock canonical identifiers once a story is published. */
  identifiersLocked?: boolean;
  status?: 'draft' | 'published';
};

export type ChapterModel = ModelPose;

export type ChapterMedia = {
  start: number;
  end: number;
};

export type Chapter = {
  id: string;
  title?: LanguageMap;
  description?: LanguageMap;
  manifest: string;
  canvasIndex: number;
  canvasId?: string;
  /** @deprecated Legacy combined timing input. Read during migration only. */
  transitionTimeMs?: number;
  /** Transition into this chapter. The destination chapter owns this value. */
  entryTransition?: ChapterEntryTransition;
  /** Time this chapter is presented, independently of entry and advance delay. */
  presentationDurationMs?: number;
  /** In-chapter camera movement, sampled independently from chapter entry. */
  cameraTrack?: ChapterCameraTrack;
  viewBox?: ViewBox;
  media?: ChapterMedia;
  model?: ChapterModel;
  modelOptions?: ModelPoseOptions;
  narrationSegment?: Record<string, NarrationSegment>;
  annotations?: Record<string, ChapterAnnotation>;
  drawingAnnotations?: ChapterDrawingAnnotation[];
  annotationPlacement?: AnnotationPlacement;
  advance?: ChapterAdvance;
  layerOpacities?: Record<string, number>;
};

export type StoryState = {
  /** Stable identifier used as the exported AnnotationPage ID when provided. */
  id?: string;
  publication?: StoryPublication;
  title?: LanguageMap;
  narration?: {
    tracks: Record<string, NarrationTrack>;
  };
  chapters: Chapter[];
};
