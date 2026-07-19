import type {
  AnnotationPlacement,
  Chapter,
  ChapterAdvance,
  ChapterModel,
} from '../core/types/story';
import type { ViewBox } from '../core/types/viewer';
import type { ModelPoseOptions } from '../core/types/model';

export const IIIF_PRESENTATION_3_CONTEXT =
  'http://iiif.io/api/presentation/3/context.json' as const;
export const MANGO_STORY_NAMESPACE =
  'https://mango-iiif.github.io/ns/story#' as const;
export const MANGO_STORY_VERSION = '1.0' as const;
export const MANGO_VIEWER_STATE_TYPE = 'mango:ViewerState' as const;
export const MANGO_VIEWER_STATE_FORMAT =
  'application/vnd.mango.story-state+json' as const;

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
    'cameraOrbit',
    'cameraTarget',
    'fieldOfView',
    'orientation',
  ] as const) {
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
    value.advance === 'manual' ||
    value.advance === 'auto' ||
    value.advance === 'both'
  ) {
    playback.advance = value.advance;
  }
  const delayMs = nonNegativeNumber(value.delayMs);
  if (delayMs !== undefined) playback.delayMs = delayMs;
  const transitionMs = nonNegativeNumber(value.transitionMs);
  if (transitionMs !== undefined) playback.transitionMs = transitionMs;
  return Object.keys(playback).length > 0 ? playback : undefined;
};

export const createMangoViewerStateBody = (
  chapter: Chapter,
): MangoViewerStateBody => {
  const transitionMs =
    chapter.transitionTimeMs ?? chapter.advance?.delayMs ?? 2000;
  const playback: MangoStoryPlayback = {
    transitionMs,
    ...(chapter.advance?.mode ? { advance: chapter.advance.mode } : {}),
    ...(chapter.advance?.delayMs !== undefined
      ? { delayMs: chapter.advance.delayMs }
      : {}),
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
      ...(chapter.layerOpacities
        ? { layerOpacities: chapter.layerOpacities }
        : {}),
      ...(chapter.annotationPlacement
        ? { annotationPlacement: chapter.annotationPlacement }
        : {}),
      playback,
    },
  };
};

export const parseMangoViewerStateBody = (
  value: unknown,
): MangoViewerState | undefined => {
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
  const chapterId =
    typeof rawState.chapterId === 'string' ? rawState.chapterId : '';
  const canvasIndex = nonNegativeInteger(rawState.canvasIndex) ?? 0;
  const canvasId =
    typeof rawState.canvasId === 'string' && rawState.canvasId.length > 0
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
  };
};
