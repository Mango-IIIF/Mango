import type {
  AnnotationPlacement,
  Chapter,
  ChapterAdvance,
  ChapterModel,
  ChapterDrawingAnnotation,
} from '../core/types/story';
import { resolveChapterTiming } from './timing';
import type { ViewBox } from '../core/types/viewer';
import type { ModelPoseOptions } from '../core/types/model';

export const IIIF_PRESENTATION_3_CONTEXT =
  'http://iiif.io/api/presentation/3/context.json' as const;
export const MANGO_STORY_NAMESPACE = 'https://mango-iiif.github.io/ns/story#' as const;
export const MANGO_STORY_VERSION = '1.0' as const;
export const MANGO_VIEWER_STATE_TYPE = 'mango:ViewerState' as const;
export const MANGO_VIEWER_STATE_FORMAT = 'application/vnd.mango.story-state+json' as const;

/**
 * Inline context for Mango's viewer-only story state. Keeping the extension
 * inline means exported stories remain self-describing while the namespace can
 * also be documented at a stable public URL.
 */
export const MANGO_STORY_CONTEXT = {
  mango: MANGO_STORY_NAMESPACE,
  mangoState: {
    '@id': 'mango:state',
    '@type': '@json',
  },
} as const;

export type MangoStoryPlayback = {
  advance?: ChapterAdvance['mode'];
  delayMs?: number;
  entryTransition?: Chapter['entryTransition'];
  presentationDurationMs?: number;
  /** @deprecated Mango story profile v1 compatibility. */
  transitionMs?: number;
};

export type MangoViewerState = {
  chapterId: string;
  canvasIndex: number;
  canvasId?: string;
  viewBox?: ViewBox;
  modelPose?: ChapterModel;
  modelOptions?: ModelPoseOptions;
  layerOpacities?: Record<string, number>;
  annotationPlacement?: AnnotationPlacement;
  playback?: MangoStoryPlayback;
  cameraTrack?: Chapter['cameraTrack'];
  drawingAnnotations?: ChapterDrawingAnnotation[];
};

export type MangoViewerStateBody = {
  type: typeof MANGO_VIEWER_STATE_TYPE;
  format: typeof MANGO_VIEWER_STATE_FORMAT;
  'mango:storyVersion': typeof MANGO_STORY_VERSION;
  mangoState: MangoViewerState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

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
  if (x === undefined || y === undefined || w === undefined || h === undefined) {
    return undefined;
  }
  if (w <= 0 || h <= 0) return undefined;
  return { x, y, w, h };
};

const parseModelPose = (value: unknown): ChapterModel | undefined => {
  if (!isRecord(value)) return undefined;
  const pose: ChapterModel = {};
  for (const key of ['cameraOrbit', 'cameraTarget', 'fieldOfView', 'orientation'] as const) {
    if (typeof value[key] === 'string' && value[key].length > 0) {
      pose[key] = value[key];
    }
  }
  return Object.keys(pose).length > 0 ? pose : undefined;
};

const parseModelOptions = (value: unknown): ModelPoseOptions | undefined => {
  if (!isRecord(value)) return undefined;
  const options: ModelPoseOptions = {};
  if (value.transition === 'interpolate' || value.transition === 'jump') {
    options.transition = value.transition;
  }
  const interpolationDecay = nonNegativeNumber(value.interpolationDecay);
  if (interpolationDecay !== undefined) {
    options.interpolationDecay = interpolationDecay;
  }
  return Object.keys(options).length > 0 ? options : undefined;
};

const parseDrawingAnnotations = (value: unknown): ChapterDrawingAnnotation[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const tools = new Set(['rectangle', 'polygon', 'point', 'freehand', 'line']);
  const entries = value.flatMap((entry): ChapterDrawingAnnotation[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !tools.has(String(entry.type)))
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
    if (!rect && (point?.x === undefined || point.y === undefined) && !points?.length) return [];
    return [
      {
        id: entry.id,
        type: entry.type as ChapterDrawingAnnotation['type'],
        ...(typeof entry.text === 'string' ? { text: entry.text } : {}),
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

const parseLayerOpacities = (value: unknown): Record<string, number> | undefined => {
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

const parseAnnotationPlacement = (value: unknown): AnnotationPlacement | undefined => {
  if (!isRecord(value)) return undefined;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const w = finiteNumber(value.w);
  const h = finiteNumber(value.h);
  if (x === undefined || y === undefined || w === undefined || h === undefined) {
    return undefined;
  }
  if (w <= 0 || h <= 0) return undefined;
  return { x, y, w, h };
};

const parsePlayback = (value: unknown): MangoStoryPlayback | undefined => {
  if (!isRecord(value)) return undefined;
  const playback: MangoStoryPlayback = {};
  if (value.advance === 'manual' || value.advance === 'auto' || value.advance === 'both') {
    playback.advance = value.advance;
  }
  const delayMs = nonNegativeNumber(value.delayMs);
  if (delayMs !== undefined) playback.delayMs = delayMs;
  const transitionMs = nonNegativeNumber(value.transitionMs);
  if (transitionMs !== undefined) playback.transitionMs = transitionMs;
  const presentationDurationMs = nonNegativeNumber(value.presentationDurationMs);
  if (presentationDurationMs !== undefined)
    playback.presentationDurationMs = presentationDurationMs;
  if (isRecord(value.entryTransition)) {
    const type = value.entryTransition.type;
    const durationMs = nonNegativeNumber(value.entryTransition.durationMs);
    const easing = value.entryTransition.easing;
    if ((type === 'cut' || type === 'tween' || type === 'crossfade') && durationMs !== undefined) {
      playback.entryTransition = {
        type,
        durationMs,
        ...(easing === 'linear' ||
        easing === 'ease-in' ||
        easing === 'ease-out' ||
        easing === 'ease-in-out'
          ? { easing }
          : {}),
      };
    }
  }
  return Object.keys(playback).length > 0 ? playback : undefined;
};

const parseCameraTrack = (value: unknown): Chapter['cameraTrack'] | undefined => {
  if (!isRecord(value) || !Array.isArray(value.keyframes)) return undefined;
  const durationMs = nonNegativeNumber(value.durationMs);
  if (durationMs === undefined) return undefined;
  const keyframes = value.keyframes.flatMap((raw) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return [];
    const timeMs = nonNegativeNumber(raw.timeMs);
    if (timeMs === undefined) return [];
    const dwellMs = nonNegativeNumber(raw.dwellMs);
    const viewBox = parseViewBox(raw.viewBox);
    const focus = isRecord(raw.focus)
      ? { x: finiteNumber(raw.focus.x), y: finiteNumber(raw.focus.y) }
      : undefined;
    const validFocus =
      focus?.x !== undefined && focus?.y !== undefined ? { x: focus.x, y: focus.y } : undefined;
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
    ...(preset === 'static' ||
    preset === 'zoom-in' ||
    preset === 'zoom-out' ||
    preset === 'pan' ||
    preset === 'drift-zoom' ||
    preset === 'custom' ||
    preset === 'ken-burns' ||
    preset === 'hero-reveal' ||
    preset === 'arc-sweep'
      ? { preset }
      : {}),
    ...(pathType === 'linear' || pathType === 'spline' ? { pathType } : {}),
    ...(easing === 'linear' ||
    easing === 'ease-in' ||
    easing === 'ease-out' ||
    easing === 'ease-in-out'
      ? { easing }
      : {}),
  };
};

export const createMangoViewerStateBody = (chapter: Chapter): MangoViewerStateBody => {
  const timing = resolveChapterTiming(chapter);
  const playback: MangoStoryPlayback = {
    ...(chapter.entryTransition ? { entryTransition: timing.entryTransition } : {}),
    ...(chapter.presentationDurationMs !== undefined
      ? { presentationDurationMs: timing.presentationDurationMs }
      : {}),
    ...(chapter.transitionTimeMs !== undefined ? { transitionMs: chapter.transitionTimeMs } : {}),
    ...(chapter.advance?.mode ? { advance: chapter.advance.mode } : {}),
    ...(chapter.advance?.delayMs !== undefined ? { delayMs: chapter.advance.delayMs } : {}),
  };

  return {
    type: MANGO_VIEWER_STATE_TYPE,
    format: MANGO_VIEWER_STATE_FORMAT,
    'mango:storyVersion': MANGO_STORY_VERSION,
    mangoState: {
      chapterId: chapter.id,
      canvasIndex: chapter.canvasIndex,
      ...(chapter.canvasId ? { canvasId: chapter.canvasId } : {}),
      ...(chapter.viewBox ? { viewBox: chapter.viewBox } : {}),
      ...(chapter.model ? { modelPose: chapter.model } : {}),
      ...(chapter.modelOptions ? { modelOptions: chapter.modelOptions } : {}),
      ...(chapter.layerOpacities ? { layerOpacities: chapter.layerOpacities } : {}),
      ...(chapter.annotationPlacement ? { annotationPlacement: chapter.annotationPlacement } : {}),
      ...(chapter.cameraTrack ? { cameraTrack: chapter.cameraTrack } : {}),
      ...(chapter.drawingAnnotations ? { drawingAnnotations: chapter.drawingAnnotations } : {}),
      playback,
    },
  };
};

export const parseMangoViewerStateBody = (value: unknown): MangoViewerState | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    (value.type !== MANGO_VIEWER_STATE_TYPE &&
      value.type !== `${MANGO_STORY_NAMESPACE}ViewerState`) ||
    value.format !== MANGO_VIEWER_STATE_FORMAT
  ) {
    return undefined;
  }

  if (value['mango:storyVersion'] !== MANGO_STORY_VERSION) {
    return undefined;
  }

  const rawState = value.mangoState ?? value['mango:state'];
  if (!isRecord(rawState)) return undefined;
  const chapterId = typeof rawState.chapterId === 'string' ? rawState.chapterId : '';
  const canvasIndex = nonNegativeInteger(rawState.canvasIndex) ?? 0;
  const canvasId =
    typeof rawState.canvasId === 'string' && rawState.canvasId.length > 0
      ? rawState.canvasId
      : undefined;
  const viewBox = parseViewBox(rawState.viewBox);
  const modelPose = parseModelPose(rawState.modelPose);
  const modelOptions = parseModelOptions(rawState.modelOptions);
  const layerOpacities = parseLayerOpacities(rawState.layerOpacities);
  const annotationPlacement = parseAnnotationPlacement(rawState.annotationPlacement);
  const playback = parsePlayback(rawState.playback);
  const cameraTrack = parseCameraTrack(rawState.cameraTrack);
  const drawingAnnotations = parseDrawingAnnotations(rawState.drawingAnnotations);

  return {
    chapterId,
    canvasIndex,
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
