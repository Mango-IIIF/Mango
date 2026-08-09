import type {
  AnnotationPlacement,
  Chapter,
  ChapterAdvance,
  ChapterModel,
  ChapterDrawingAnnotation,
} from "../core/types/story";
import { resolveChapterTiming } from "./timing";
import type { ViewBox } from "../core/types/viewer";
import type { ModelPoseOptions } from "../core/types/model";

export const IIIF_PRESENTATION_3_CONTEXT =
  "http://iiif.io/api/presentation/3/context.json" as const;
export const W3C_WEB_ANNOTATION_CONTEXT =
  "http://www.w3.org/ns/anno.jsonld" as const;
export const MANGO_STORY_NAMESPACE =
  "https://mangoviewer.dev/schema/story#" as const;
/**
 * The context that defines Mango's terms, and the only place the profile
 * version is stated.
 *
 * Major version in the path, following IIIF's own `/3/`: this URL changes on
 * a breaking change, while additive terms go into the same document because
 * a reader that does not know a term ignores it. Carrying the version here
 * rather than in a property means it is declared once instead of restated on
 * the page and again inside every chapter's state.
 */
export const MANGO_STORY_CONTEXT_URL =
  "https://mangoviewer.dev/schema/story/1/context.json" as const;
/** @deprecated Superseded by the context URL. Read for migration only. */
export const MANGO_STORY_VERSION = "1.0" as const;
export const MANGO_VIEWER_STATE_TYPE = "mango:ViewerState" as const;
export const MANGO_VIEWER_STATE_FORMAT =
  "application/vnd.mango.story-state+json" as const;

export type MangoStoryPlayback = {
  advance?: ChapterAdvance["mode"];
  delayMs?: number;
  entryTransition?: Chapter["entryTransition"];
  presentationDurationMs?: number;
  /** @deprecated Mango story profile v1 compatibility. */
  transitionMs?: number;
};

export type MangoViewerState = {
  /*
   * Optional because the current profile does not write them: the
   * annotation's own `id`, its place in an ordered `items` list, and the
   * target's `source` and `partOf` say the same thing. They are still read,
   * so stories written before the move keep loading.
   */
  chapterId?: string;
  canvasIndex?: number;
  presentationAspect?: number;
  canvasId?: string;
  viewBox?: ViewBox;
  modelPose?: ChapterModel;
  modelOptions?: ModelPoseOptions;
  layerOpacities?: Record<string, number>;
  annotationPlacement?: AnnotationPlacement;
  playback?: MangoStoryPlayback;
  cameraTrack?: Chapter["cameraTrack"];
  drawingAnnotations?: ChapterDrawingAnnotation[];
};

export type MangoViewerStateBody = {
  type: ["Dataset", typeof MANGO_VIEWER_STATE_TYPE];
  format: typeof MANGO_VIEWER_STATE_FORMAT;
  mangoState: MangoViewerState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const nonNegativeNumber = (value: unknown): number | undefined => {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
};

const nonNegativeInteger = (value: unknown): number | undefined => {
  const parsed = nonNegativeNumber(value);
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
};

const parseViewBox = (value: unknown): ViewBox | undefined => {
  if (!isRecord(value)) return undefined;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const w = finiteNumber(value.w);
  const h = finiteNumber(value.h);
  if (
    x === undefined ||
    y === undefined ||
    w === undefined ||
    h === undefined
  ) {
    return undefined;
  }
  if (w <= 0 || h <= 0) return undefined;
  return { x, y, w, h };
};

const parseModelPose = (value: unknown): ChapterModel | undefined => {
  if (!isRecord(value)) return undefined;
  const pose: ChapterModel = {};
  for (const key of [
    "cameraOrbit",
    "cameraTarget",
    "fieldOfView",
    "orientation",
  ] as const) {
    if (typeof value[key] === "string" && value[key].length > 0) {
      pose[key] = value[key];
    }
  }
  return Object.keys(pose).length > 0 ? pose : undefined;
};

const parseModelOptions = (value: unknown): ModelPoseOptions | undefined => {
  if (!isRecord(value)) return undefined;
  const options: ModelPoseOptions = {};
  if (value.transition === "interpolate" || value.transition === "jump") {
    options.transition = value.transition;
  }
  const interpolationDecay = nonNegativeNumber(value.interpolationDecay);
  if (interpolationDecay !== undefined) {
    options.interpolationDecay = interpolationDecay;
  }
  return Object.keys(options).length > 0 ? options : undefined;
};

const parseDrawingAnnotations = (
  value: unknown,
): ChapterDrawingAnnotation[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const tools = new Set(["rectangle", "polygon", "point", "freehand", "line"]);
  const entries = value.flatMap((entry): ChapterDrawingAnnotation[] => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      !tools.has(String(entry.type))
    )
      return [];
    const rect = parseViewBox(entry.rect);
    const point = isRecord(entry.point)
      ? { x: finiteNumber(entry.point.x), y: finiteNumber(entry.point.y) }
      : null;
    const points = Array.isArray(entry.points)
      ? entry.points.flatMap((candidate) => {
          if (!isRecord(candidate)) return [];
          const x = finiteNumber(candidate.x);
          const y = finiteNumber(candidate.y);
          return x === undefined || y === undefined ? [] : [{ x, y }];
        })
      : undefined;
    if (
      !rect &&
      (point?.x === undefined || point.y === undefined) &&
      !points?.length
    )
      return [];
    const label: Record<string, string> = {};
    if (isRecord(entry.label)) {
      for (const [lang, labelValue] of Object.entries(entry.label)) {
        if (typeof labelValue === "string") label[lang] = labelValue;
      }
    }
    const hasLabel = Object.keys(label).length > 0;
    const color =
      typeof entry.color === "string" && entry.color.trim()
        ? entry.color.trim()
        : undefined;
    const strokeWidth =
      entry.strokeWidth === "thin" ||
      entry.strokeWidth === "medium" ||
      entry.strokeWidth === "thick"
        ? entry.strokeWidth
        : undefined;
    const fillMode =
      entry.fillMode === "solid" || entry.fillMode === "transparent"
        ? entry.fillMode
        : undefined;
    return [
      {
        id: entry.id,
        type: entry.type as ChapterDrawingAnnotation["type"],
        ...(typeof entry.text === "string" ? { text: entry.text } : {}),
        ...(hasLabel ? { label } : {}),
        ...(color ? { color } : {}),
        ...(strokeWidth ? { strokeWidth } : {}),
        ...(fillMode ? { fillMode } : {}),
        ...(rect ? { rect } : {}),
        ...(point?.x !== undefined && point.y !== undefined
          ? { point: { x: point.x, y: point.y } }
          : {}),
        ...(points?.length ? { points } : {}),
      },
    ];
  });
  return entries.length ? entries : undefined;
};

const parseLayerOpacities = (
  value: unknown,
): Record<string, number> | undefined => {
  if (!isRecord(value)) return undefined;
  const layers: Record<string, number> = {};
  for (const [id, rawOpacity] of Object.entries(value)) {
    const opacity = finiteNumber(rawOpacity);
    if (id && opacity !== undefined && opacity >= 0 && opacity <= 1) {
      layers[id] = opacity;
    }
  }
  return Object.keys(layers).length > 0 ? layers : undefined;
};

const parseAnnotationPlacement = (
  value: unknown,
): AnnotationPlacement | undefined => {
  if (!isRecord(value)) return undefined;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const w = finiteNumber(value.w);
  const h = finiteNumber(value.h);
  if (
    x === undefined ||
    y === undefined ||
    w === undefined ||
    h === undefined
  ) {
    return undefined;
  }
  if (w <= 0 || h <= 0) return undefined;
  return { x, y, w, h };
};

const parsePlayback = (value: unknown): MangoStoryPlayback | undefined => {
  if (!isRecord(value)) return undefined;
  const playback: MangoStoryPlayback = {};
  if (
    value.advance === "manual" ||
    value.advance === "auto" ||
    value.advance === "both"
  ) {
    playback.advance = value.advance;
  }
  const delayMs = nonNegativeNumber(value.delayMs);
  if (delayMs !== undefined) playback.delayMs = delayMs;
  const transitionMs = nonNegativeNumber(value.transitionMs);
  if (transitionMs !== undefined) playback.transitionMs = transitionMs;
  const presentationDurationMs = nonNegativeNumber(
    value.presentationDurationMs,
  );
  if (presentationDurationMs !== undefined)
    playback.presentationDurationMs = presentationDurationMs;
  if (isRecord(value.entryTransition)) {
    const type = value.entryTransition.type;
    const durationMs = nonNegativeNumber(value.entryTransition.durationMs);
    const easing = value.entryTransition.easing;
    if (
      (type === "cut" || type === "tween" || type === "crossfade") &&
      durationMs !== undefined
    ) {
      playback.entryTransition = {
        type,
        durationMs,
        ...(easing === "linear" ||
        easing === "ease-in" ||
        easing === "ease-out" ||
        easing === "ease-in-out"
          ? { easing }
          : {}),
      };
    }
  }
  return Object.keys(playback).length > 0 ? playback : undefined;
};

const parseCameraTrack = (
  value: unknown,
): Chapter["cameraTrack"] | undefined => {
  if (!isRecord(value) || !Array.isArray(value.keyframes)) return undefined;
  const durationMs = nonNegativeNumber(value.durationMs);
  if (durationMs === undefined) return undefined;
  const keyframes = value.keyframes.flatMap((raw) => {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return [];
    const timeMs = nonNegativeNumber(raw.timeMs);
    if (timeMs === undefined) return [];
    const dwellMs = nonNegativeNumber(raw.dwellMs);
    const viewBox = parseViewBox(raw.viewBox);
    const focus = isRecord(raw.focus)
      ? { x: finiteNumber(raw.focus.x), y: finiteNumber(raw.focus.y) }
      : undefined;
    const validFocus =
      focus?.x !== undefined && focus?.y !== undefined
        ? { x: focus.x, y: focus.y }
        : undefined;
    const model = parseModelPose(raw.model);
    const layerOpacities = parseLayerOpacities(raw.layerOpacities);
    if (!validFocus && !viewBox && !model && !layerOpacities) return [];
    return [
      {
        id: raw.id,
        timeMs,
        ...(dwellMs !== undefined ? { dwellMs } : {}),
        ...(validFocus ? { focus: validFocus } : {}),
        ...(viewBox ? { viewBox } : {}),
        ...(model ? { model } : {}),
        ...(layerOpacities ? { layerOpacities } : {}),
      },
    ];
  });
  const preset = value.preset;
  const pathType = value.pathType;
  const easing = value.easing;
  return {
    durationMs,
    keyframes: keyframes.sort((a, b) => a.timeMs - b.timeMs),
    ...(preset === "static" ||
    preset === "zoom-in" ||
    preset === "zoom-out" ||
    preset === "pan" ||
    preset === "drift-zoom" ||
    preset === "custom" ||
    preset === "ken-burns" ||
    preset === "hero-reveal" ||
    preset === "arc-sweep"
      ? { preset }
      : {}),
    ...(pathType === "linear" || pathType === "spline" ? { pathType } : {}),
    ...(easing === "linear" ||
    easing === "ease-in" ||
    easing === "ease-out" ||
    easing === "ease-in-out"
      ? { easing }
      : {}),
  };
};

export const createMangoViewerStateBody = (
  chapter: Chapter,
  presentationAspect?: number,
): MangoViewerStateBody => {
  const timing = resolveChapterTiming(chapter);
  const playback: MangoStoryPlayback = {
    ...(chapter.entryTransition
      ? { entryTransition: timing.entryTransition }
      : {}),
    ...(chapter.presentationDurationMs !== undefined
      ? { presentationDurationMs: timing.presentationDurationMs }
      : {}),
    ...(chapter.transitionTimeMs !== undefined
      ? { transitionMs: chapter.transitionTimeMs }
      : {}),
    ...(chapter.advance?.mode ? { advance: chapter.advance.mode } : {}),
    ...(chapter.advance?.delayMs !== undefined
      ? { delayMs: chapter.advance.delayMs }
      : {}),
  };

  /*
   * `chapterId` and `canvasId` are deliberately absent: the annotation's own
   * `id` ends in the chapter id, and the target's `source` is the canvas. A
   * second copy is only useful until the two disagree.
   *
   * `canvasIndex` stays, despite looking like the same kind of duplicate.
   * The trailing segment of a canvas URI is an index only by convention, and
   * plenty are not — `…/canvas/model`, or the cookbook's `…/canvas/p1` — so
   * for those the index is nowhere else at all.
   *
   * `viewBox` stays despite the target fragment holding the same framing,
   * because the fragment is whole pixels and this is not. Its job here is
   * restoring precision, not storing the framing.
   */
  const state: MangoViewerState = {
      canvasIndex: chapter.canvasIndex,
      ...(presentationAspect !== undefined ? { presentationAspect } : {}),
      ...(chapter.viewBox ? { viewBox: chapter.viewBox } : {}),
      ...(chapter.model ? { modelPose: chapter.model } : {}),
      ...(chapter.modelOptions ? { modelOptions: chapter.modelOptions } : {}),
      ...(chapter.layerOpacities
        ? { layerOpacities: chapter.layerOpacities }
        : {}),
      ...(chapter.annotationPlacement
        ? { annotationPlacement: chapter.annotationPlacement }
        : {}),
      ...(chapter.cameraTrack ? { cameraTrack: chapter.cameraTrack } : {}),
      ...(chapter.drawingAnnotations
        ? { drawingAnnotations: chapter.drawingAnnotations }
        : {}),
      playback,
  };
  /*
   * Two types on purpose. `Dataset` is a W3C body class, so a viewer that
   * knows nothing about Mango still knows this is data and not prose to put
   * in front of a reader — which is exactly what a `TextualBody` holding a
   * JSON string invites it to do. `mango:ViewerState` then names what the
   * data is, for anything that does know.
   */
  return {
    type: ["Dataset", MANGO_VIEWER_STATE_TYPE],
    format: MANGO_VIEWER_STATE_FORMAT,
    mangoState: state,
  };
};

const viewerStateEnvelope = (
  value: unknown,
): { version?: string; state?: Record<string, unknown> } | undefined => {
  if (!isRecord(value) || value.format !== MANGO_VIEWER_STATE_FORMAT) return undefined;
  if (value.type === "TextualBody" && typeof value.value === "string") {
    try {
      const decoded = JSON.parse(value.value) as unknown;
      if (!isRecord(decoded)) return undefined;
      return {
        version:
          typeof decoded.storyVersion === "string" ? decoded.storyVersion : undefined,
        state: isRecord(decoded.state) ? decoded.state : undefined,
      };
    } catch {
      return undefined;
    }
  }
  /*
   * The type may be a single term or the pair `["Dataset", …]`, since the
   * state body now carries a standard body class alongside Mango's own.
   */
  const types = Array.isArray(value.type) ? value.type : [value.type];
  if (
    !types.includes(MANGO_VIEWER_STATE_TYPE) &&
    !types.includes(`${MANGO_STORY_NAMESPACE}ViewerState`) &&
    !types.includes("https://mango-iiif.github.io/ns/story#ViewerState")
  ) return undefined;
  const state = isRecord(value.mangoState ?? value["mango:state"])
    ? ((value.mangoState ?? value["mango:state"]) as Record<string, unknown>)
    : undefined;
  return {
    /*
     * A body written to the current profile carries no version, because the
     * context URL states it once for the document. Reporting the current
     * version when state is present keeps "is this a Mango chapter" separate
     * from "which profile is it" — the first is what callers actually ask.
     */
    version:
      typeof value["mango:storyVersion"] === "string"
        ? value["mango:storyVersion"]
        : state
          ? MANGO_STORY_VERSION
          : undefined,
    state,
  };
};

export const mangoViewerStateVersion = (value: unknown): string | undefined =>
  viewerStateEnvelope(value)?.version;

export const parseMangoViewerStateBody = (
  value: unknown,
): MangoViewerState | undefined => {
  const envelope = viewerStateEnvelope(value);
  if (envelope?.version !== MANGO_STORY_VERSION || !envelope.state) return undefined;
  const rawState = envelope.state;
  /*
   * Omitted rather than defaulted to "". The current profile does not write
   * a chapter id — the annotation's own id ends in it — so an empty string
   * here would be a value the document never claimed, and callers cannot
   * tell it apart from one that was genuinely blank.
   */
  const chapterId =
    typeof rawState.chapterId === "string" && rawState.chapterId.length > 0
      ? rawState.chapterId
      : undefined;
  const canvasIndex = nonNegativeInteger(rawState.canvasIndex) ?? 0;
  const presentationAspect = finiteNumber(rawState.presentationAspect);
  const canvasId =
    typeof rawState.canvasId === "string" && rawState.canvasId.length > 0
      ? rawState.canvasId
      : undefined;
  const viewBox = parseViewBox(rawState.viewBox);
  const modelPose = parseModelPose(rawState.modelPose);
  const modelOptions = parseModelOptions(rawState.modelOptions);
  const layerOpacities = parseLayerOpacities(rawState.layerOpacities);
  const annotationPlacement = parseAnnotationPlacement(
    rawState.annotationPlacement,
  );
  const playback = parsePlayback(rawState.playback);
  const cameraTrack = parseCameraTrack(rawState.cameraTrack);
  const drawingAnnotations = parseDrawingAnnotations(
    rawState.drawingAnnotations,
  );

  return {
    ...(chapterId ? { chapterId } : {}),
    canvasIndex,
    ...(presentationAspect !== undefined && presentationAspect > 0
      ? { presentationAspect }
      : {}),
    ...(canvasId ? { canvasId } : {}),
    ...(viewBox ? { viewBox } : {}),
    ...(modelPose ? { modelPose } : {}),
    ...(modelOptions ? { modelOptions } : {}),
    ...(layerOpacities ? { layerOpacities } : {}),
    ...(annotationPlacement ? { annotationPlacement } : {}),
    ...(playback ? { playback } : {}),
    ...(cameraTrack ? { cameraTrack } : {}),
    ...(drawingAnnotations ? { drawingAnnotations } : {}),
  };
};
