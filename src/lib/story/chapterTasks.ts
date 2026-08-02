import type { Chapter, StoryState } from '../core/types/story';
import type { MediaSource, MediaType } from '../iiif/mediaResolver';
import { translate } from '../i18n';

export type ChapterTaskId =
  | 'details'
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
};

export type ChapterTaskEvaluation = {
  id: ChapterTaskId;
  availability: TaskAvailability;
  status: TaskStatus;
};

const hasText = (value: string | undefined): boolean => Boolean(value?.trim());

const validationForTask = (task: ChapterTaskId, messages: string[]): string[] => {
  const patterns: Record<ChapterTaskId, RegExp> = {
    details: /title|description|language|translation/i,
    focus: /viewBox|capture|model pose|placement|annotation/i,
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
