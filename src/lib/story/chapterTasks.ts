import type { Chapter, StoryState } from '../core/types/story';
import type { ViewBox } from '../core/types/viewer';
import type { MediaSource, MediaType } from '../iiif/mediaResolver';
import { translate } from '../core/i18n';

export type ChapterTaskId =
  | 'details'
  | 'position'
  | 'focus'
  | 'motion'
  | 'audio-timing'
  | 'transition-timing'
  | 'media-timing'
  | 'layers'
  | 'comparison'
  | 'source';

export type ChapterInspectorView = { mode: 'dashboard' } | { mode: 'task'; task: ChapterTaskId };

export type TaskAvailability =
  | { state: 'available' }
  | { state: 'disabled'; reason: string; action?: string }
  | { state: 'hidden' };

export type CompletionState = 'empty' | 'partial' | 'complete' | 'attention';

export type TaskStatus = {
  completion: CompletionState;
  /**
   * Overrides the generic completion wording where a task can say something
   * more useful than "Needs attention" about why it needs attention.
   */
  labelKey?: string;
  translated?: number;
  languageTotal?: number;
  messages: string[];
};

export type ChapterTaskContext = {
  story: StoryState;
  chapter: Chapter;
  chapterIndex: number;
  mediaType: MediaType | null;
  layers?: MediaSource[];
  loadedSources?: MediaSource[];
  validationErrors?: string[];
  languages: string[];
  /**
   * Where the viewer is actually pointing, once it has settled. Only the
   * chapter the author currently has open has a live view to be compared
   * against, so this is absent for any other evaluation — and while a story
   * preview is driving the viewer, when the framing on screen is the story's
   * doing rather than the author's.
   */
  currentViewBox?: ViewBox | null;
};

export type ChapterTaskEvaluation = {
  id: ChapterTaskId;
  availability: TaskAvailability;
  status: TaskStatus;
};

const hasText = (value: string | undefined): boolean => Boolean(value?.trim());

/*
 * Compared by centre and zoom rather than by raw edges. A chapter's framing is
 * stored at the story's presentation aspect while the live viewer carries the
 * editor stage's shape, so the same view is described by two different boxes —
 * and `normaliseViewBox` is defined to preserve exactly the centre and the
 * area, which is why those are the parts that carry the author's intent.
 * Comparing edges instead reported drift on a chapter nobody had touched yet.
 *
 * Both tolerances are relative: half a pixel means nothing on a 15000px canvas
 * and everything inside a 300px crop. They sit below anything an author would
 * call a different view, and above the wobble of the animation that flies the
 * viewer to a chapter.
 */
const CENTRE_DRIFT_TOLERANCE = 0.02;
const SCALE_DRIFT_TOLERANCE = 0.05;

/**
 * Deliberately not `framingsWithin` from `framing.ts`: that one answers
 * whether the viewer has arrived somewhere, in absolute image pixels, and
 * cannot answer this question across canvas sizes.
 */
export const framingsDiffer = (saved: ViewBox, current: ViewBox): boolean => {
  if (!(saved.w > 0) || !(saved.h > 0) || !(current.w > 0) || !(current.h > 0)) {
    return false;
  }
  const centreDrift = Math.max(
    Math.abs(current.x + current.w / 2 - (saved.x + saved.w / 2)) / saved.w,
    Math.abs(current.y + current.h / 2 - (saved.y + saved.h / 2)) / saved.h,
  );
  if (centreDrift > CENTRE_DRIFT_TOLERANCE) return true;
  const scale = Math.sqrt((current.w * current.h) / (saved.w * saved.h));
  return Math.abs(scale - 1) > SCALE_DRIFT_TOLERANCE;
};

const validationForTask = (task: ChapterTaskId, messages: string[]): string[] => {
  const patterns: Record<ChapterTaskId, RegExp> = {
    details: /title|description|language|translation/i,
    position: /viewBox|capture/i,
    focus: /model pose|placement|annotation/i,
    motion: /motion|camera track|camera point|keyframe/i,
    'audio-timing': /narration|voiceover/i,
    'transition-timing': /advance|delay|chapter transition/i,
    'media-timing': /media|segment|mark in|mark out|audio|video/i,
    layers: /layer|opacity/i,
    comparison: /comparison|alignment/i,
    source: /manifest|canvas|source|entry transition/i,
  };
  return messages.filter((message) => patterns[task].test(message));
};

export const evaluateTaskAvailability = (
  task: ChapterTaskId,
  context: ChapterTaskContext,
): TaskAvailability => {
  const { chapter, layers = [], loadedSources = [] } = context;
  switch (task) {
    case 'details':
    case 'audio-timing':
    case 'transition-timing':
    case 'source':
      return { state: 'available' };
    case 'position':
      // Framing is stored as a viewBox, which only applies to spatial media.
      if (
        context.mediaType === 'audio' ||
        context.mediaType === 'video' ||
        context.mediaType === 'model' ||
        Boolean(chapter.model)
      ) {
        return {
          state: 'disabled',
          reason: translate('storyBuilder.tasks.availability.positionMedia'),
          action: translate('storyBuilder.tasks.availability.chooseImage'),
        };
      }
      return { state: 'available' };
    case 'media-timing':
      return context.mediaType === 'audio' || context.mediaType === 'video'
        ? { state: 'available' }
        : { state: 'hidden' };
    case 'focus':
      if (
        context.mediaType === 'audio' ||
        context.mediaType === 'video' ||
        context.mediaType === 'model' ||
        Boolean(chapter.model)
      ) {
        return {
          state: 'disabled',
          reason: translate('storyBuilder.tasks.availability.annotationsMedia'),
          action: translate('storyBuilder.tasks.availability.chooseImage'),
        };
      }
      return chapter.viewBox || chapter.model || chapter.annotations
        ? { state: 'available' }
        : {
            state: 'disabled',
            reason: translate('storyBuilder.tasks.availability.annotationsSpatial'),
            action: translate('storyBuilder.tasks.availability.captureSpatial'),
          };
    case 'motion':
      return chapter.viewBox || chapter.model
        ? { state: 'available' }
        : {
            state: 'disabled',
            reason: translate('storyBuilder.tasks.availability.motionSpatial'),
            action: translate('storyBuilder.tasks.availability.captureSpatial'),
          };
    case 'layers':
      return layers.length > 1
        ? { state: 'available' }
        : {
            state: 'disabled',
            reason: translate('storyBuilder.tasks.availability.layers'),
            action: translate('storyBuilder.tasks.availability.chooseLayered'),
          };
    case 'comparison':
      return loadedSources.length > 1
        ? {
            state: 'disabled',
            reason: translate('storyBuilder.tasks.availability.comparisonUnavailable'),
            action: translate('storyBuilder.tasks.availability.keepSources'),
          }
        : {
            state: 'disabled',
            reason: translate('storyBuilder.tasks.availability.comparisonSources'),
            action: translate('storyBuilder.tasks.availability.loadSource'),
          };
  }
};

export const evaluateTaskStatus = (
  task: ChapterTaskId,
  context: ChapterTaskContext,
): TaskStatus => {
  const { chapter, story, languages } = context;
  const messages = validationForTask(task, context.validationErrors ?? []);
  const withAttention = (
    completion: CompletionState,
    extra: Partial<TaskStatus> = {},
  ): TaskStatus => ({
    completion: messages.length ? 'attention' : completion,
    messages,
    ...extra,
  });

  switch (task) {
    case 'details': {
      const configured = [...new Set(languages.filter(Boolean))];
      const translated = configured.filter(
        (language) =>
          hasText(chapter.title?.[language]) && hasText(chapter.description?.[language]),
      ).length;
      const fields = configured.flatMap((language) => [
        chapter.title?.[language],
        chapter.description?.[language],
      ]);
      const populated = fields.filter(hasText).length;
      return withAttention(
        populated === 0 ? 'empty' : populated === fields.length ? 'complete' : 'partial',
        { translated, languageTotal: configured.length },
      );
    }
    case 'position': {
      const viewBox = chapter.viewBox;
      if (!viewBox) return withAttention('empty');
      if (!(viewBox.w > 0 && viewBox.h > 0)) return withAttention('attention');
      /*
       * "Configured" used to mean only that the field was not null — which it
       * always is, because a chapter captures a view the moment it is created.
       * So the tick could never go red, and it read as reassurance about a
       * framing nobody had checked. The question worth answering is whether the
       * captured view is still the one the author is looking at: they create a
       * chapter, then explore to find what it is about, and the capture happens
       * before that exploring rather than after it.
       */
      const current = context.currentViewBox;
      if (current && framingsDiffer(viewBox, current)) {
        return withAttention('attention', {
          labelKey: 'storyBuilder.tasks.status.positionDrift',
        });
      }
      return withAttention('complete');
    }
    case 'focus': {
      const annotations = Object.values(chapter.annotations ?? {});
      const hasAnnotation = annotations.some((annotation) => hasText(annotation.text));
      const placementsComplete =
        !hasAnnotation ||
        annotations.filter((annotation) => hasText(annotation.text)).every((a) => a.placement);
      const drawingCount = chapter.drawingAnnotations?.length ?? 0;
      return withAttention(
        !hasAnnotation && drawingCount === 0
          ? 'empty'
          : placementsComplete
            ? 'complete'
            : 'partial',
      );
    }
    case 'motion': {
      const pointCount = chapter.cameraTrack?.keyframes.length ?? 0;
      return withAttention(pointCount === 0 ? 'empty' : pointCount === 1 ? 'partial' : 'complete');
    }
    case 'audio-timing': {
      const narration = Object.entries(chapter.narrationSegment ?? {});
      const validNarration = narration.every(
        ([language, segment]) =>
          segment.end > segment.start && hasText(story.narration?.tracks?.[language]?.src),
      );
      return withAttention(
        narration.length === 0 ? 'empty' : validNarration ? 'complete' : 'partial',
      );
    }
    case 'transition-timing': {
      const delay = chapter.advance?.delayMs;
      return withAttention(
        chapter.advance?.mode !== 'auto' || delay === undefined
          ? 'empty'
          : Number.isFinite(delay) && delay >= 0
            ? 'complete'
            : 'attention',
      );
    }
    case 'media-timing':
      return withAttention(
        !chapter.media
          ? 'empty'
          : chapter.media.end > chapter.media.start
            ? 'complete'
            : 'attention',
      );
    case 'layers':
      return withAttention(
        Object.keys(chapter.layerOpacities ?? {}).length > 0 ? 'complete' : 'empty',
      );
    case 'comparison':
      return withAttention('empty');
    case 'source':
      return withAttention(
        hasText(chapter.manifest) && chapter.canvasIndex >= 0 ? 'complete' : 'attention',
      );
  }
};

export const evaluateChapterTasks = (context: ChapterTaskContext): ChapterTaskEvaluation[] =>
  (
    [
      'source',
      'transition-timing',
      'details',
      'position',
      'audio-timing',
      'focus',
      'motion',
      'layers',
      'comparison',
      'media-timing',
    ] as ChapterTaskId[]
  ).map((id) => ({
    id,
    availability: evaluateTaskAvailability(id, context),
    status: evaluateTaskStatus(id, context),
  }));

export const taskForValidationMessage = (message: string): ChapterTaskId => {
  const ids: ChapterTaskId[] = [
    'details',
    'position',
    'focus',
    'motion',
    'audio-timing',
    'transition-timing',
    'media-timing',
    'layers',
    'comparison',
    'source',
  ];
  return ids.find((id) => validationForTask(id, [message]).length > 0) ?? 'details';
};
