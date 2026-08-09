import type { ModelPose, ModelPoseOptions } from "./model";
import type { ViewBox } from "./viewer";

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
  "select" | "rectangle" | "polygon" | "point" | "freehand" | "line";

/** Stroke-width bucket for a drawing annotation. */
export type ChapterAnnotationStrokeWidth = "thin" | "medium" | "thick";
export type ChapterAnnotationFillMode = "transparent" | "solid";

/**
 * W3C motivations offered for a story drawing.
 *
 * A subset, not the full list: these are the ones that mean something for a
 * region of an image in a story. Mango reads any motivation a document
 * carries — this only constrains what the builder writes.
 */
export const CHAPTER_ANNOTATION_MOTIVATIONS = [
  "describing",
  "commenting",
  "highlighting",
  "tagging",
  "identifying",
  "classifying",
  "questioning",
] as const;

export type ChapterAnnotationMotivation =
  (typeof CHAPTER_ANNOTATION_MOTIVATIONS)[number];

export type ChapterDrawingAnnotation = {
  id: string;
  type: Exclude<ChapterAnnotationTool, "select">;
  /**
   * @deprecated Legacy single-language label. Read as a migration fallback and
   * folded into `label` on load; new code should write `label` instead.
   */
  text?: string;
  /** Per-language display label rendered to the viewer during playback. */
  label?: LanguageMap;
  /** Stroke/emphasis colour (any CSS colour). Defaults to the theme accent. */
  color?: string;
  /** Stroke width bucket. Defaults to `medium`. */
  strokeWidth?: ChapterAnnotationStrokeWidth;
  /** Whether a closed shape uses a subtle transparent fill or its solid colour. */
  fillMode?: ChapterAnnotationFillMode;
  /**
   * Why this annotation exists, as a W3C motivation.
   *
   * Optional, and absent means "let the export decide" — which is what every
   * story written so far relies on. Setting it says something the geometry
   * cannot: the same rectangle can be a comment, a transcription or a
   * question, and only the author knows which.
   */
  motivation?: ChapterAnnotationMotivation;
  rect?: AnnotationPlacement;
  point?: { x: number; y: number };
  points?: Array<{ x: number; y: number }>;
};

/** Pixel stroke widths (non-scaling) for each {@link ChapterAnnotationStrokeWidth}. */
export const ANNOTATION_STROKE_WIDTH_PX: Record<
  ChapterAnnotationStrokeWidth,
  number
> = {
  thin: 1.5,
  medium: 2.5,
  thick: 4,
};

export type ChapterAdvance = {
  mode: "manual" | "auto" | "both";
  delayMs?: number;
};

export type ChapterEntryTransition = {
  type: "cut" | "tween" | "crossfade";
  durationMs: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
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
    | "static"
    | "zoom-in"
    | "zoom-out"
    | "pan"
    | "drift-zoom"
    | "custom"
    | "ken-burns"
    | "hero-reveal"
    | "arc-sweep";
  pathType?: "linear" | "spline";
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
};

export type StoryPublication = {
  /** Base used for chapter Annotation identifiers. Defaults to `${story.id}/annotation/`. */
  annotationBase?: string;
  /** Host integrations can lock canonical identifiers once a story is published. */
  identifiersLocked?: boolean;
  status?: "draft" | "published";
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
  /**
   * Width/height every stored framing in this story is normalised to. Captures
   * come from the viewer's viewport, so without a single canonical aspect each
   * chapter inherits the shape of the stage it was authored on and they
   * disagree with each other during playback.
   */
  presentationAspect?: number;
  title?: LanguageMap;
  narration?: {
    tracks: Record<string, NarrationTrack>;
  };
  chapters: Chapter[];
};
