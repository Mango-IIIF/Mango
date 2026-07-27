import type { ViewBox } from '../types/viewer';
import type { ModelPoseOptions } from '../types/model';
import type {
  AnnotationPlacement,
  Chapter,
  ChapterAdvance,
  ChapterMedia,
  ChapterModel,
  NarrationSegment,
  ChapterCameraTrack,
  ChapterDrawingAnnotation,
  StoryState,
} from '../types/story';

export type CapturePayload = {
  manifest: string;
  canvasIndex: number;
  canvasId?: string;
  viewBox?: ViewBox;
  media?: ChapterMedia;
  model?: ChapterModel;
  modelOptions?: ModelPoseOptions;
  layerOpacities?: Record<string, number>;
  entryTransition?: Chapter['entryTransition'];
  presentationDurationMs?: number;
  transitionTimeMs?: number;
  cameraTrack?: ChapterCameraTrack;
  drawingAnnotations?: ChapterDrawingAnnotation[];
};

export type AddChapterPayload = {
  capture: CapturePayload;
  id?: string;
};

export type UpdateChapterPayload = {
  chapterId: string;
  capture: CapturePayload;
};

export type DeleteChapterPayload = {
  chapterId: string;
};

export type NarrationTrackPayload = {
  language: string;
  src: string;
};

export type NarrationSegmentPayload = {
  chapterId: string;
  language: string;
  start: number;
  end: number;
};

export type RemoveNarrationSegmentPayload = {
  chapterId: string;
  language: string;
};

export type AnnotationTextPayload = {
  chapterId: string;
  language: string;
  text?: string;
};

export type AnnotationPlacementPayload = {
  chapterId: string;
  language: string;
  placement?: AnnotationPlacement;
};

export type AdvanceModePayload = {
  chapterId: string;
  mode: ChapterAdvance['mode'];
};

export type AdvanceDelayPayload = {
  chapterId: string;
  delayMs?: number;
};

export type ChapterMarginPayload = {
  chapterId: string;
  margin?: number;
};

export type ChapterMarginUndoPayload = {
  chapterId: string;
  margin?: number;
};

export type ChapterManifestPayload = {
  chapterId: string;
  manifest: string;
};

export type ChapterMetadataPayload = {
  chapterId: string;
  language: string;
  value?: string;
};

export type StoryMetadataPayload = {
  language: string;
  value?: string;
};

export type StoryIdentifiersPayload = {
  id?: string;
  annotationBase?: string;
};

export type ChapterCameraTrackPayload = {
  chapterId: string;
  cameraTrack?: ChapterCameraTrack;
};

export type ChapterViewBoxPayload = {
  chapterId: string;
  viewBox: ViewBox;
};

export type ReorderChapterPayload = {
  chapterId: string;
  targetChapterId: string;
  position?: 'before' | 'after';
};

const createChapterId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `chapter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const clearCaptureFields = (
  chapter: Chapter,
): Omit<Chapter, 'viewBox' | 'media' | 'model' | 'modelOptions' | 'layerOpacities'> => {
  const {
    viewBox: _viewBox,
    media: _media,
    model: _model,
    modelOptions: _modelOptions,
    layerOpacities: _layerOpacities,
    ...rest
  } = chapter;
  return rest;
};

const applyCapture = (chapter: Chapter, capture: CapturePayload): Chapter => {
  const base = clearCaptureFields(chapter);
  const next: Chapter = {
    ...base,
    manifest: capture.manifest,
    canvasIndex: capture.canvasIndex,
  };

  if (capture.canvasId) next.canvasId = capture.canvasId;
  if (capture.viewBox) next.viewBox = capture.viewBox;
  if (capture.media) next.media = capture.media;
  if (capture.model) next.model = capture.model;
  if (capture.modelOptions) next.modelOptions = capture.modelOptions;
  if (capture.layerOpacities) next.layerOpacities = capture.layerOpacities;
  if (capture.entryTransition) next.entryTransition = capture.entryTransition;
  if (capture.presentationDurationMs !== undefined) {
    next.presentationDurationMs = capture.presentationDurationMs;
  }
  if (capture.transitionTimeMs !== undefined) next.transitionTimeMs = capture.transitionTimeMs;
  if (capture.cameraTrack) next.cameraTrack = capture.cameraTrack;
  if (capture.drawingAnnotations) next.drawingAnnotations = capture.drawingAnnotations;

  return next;
};

export const createEmptyStory = (): StoryState => ({
  chapters: [],
});

// Pure functions for story transformations
export const addChapterFromCapture = (
  story: StoryState,
  payload: AddChapterPayload,
): StoryState => {
  const id = payload.id ?? createChapterId();
  const chapter: Chapter = applyCapture(
    {
      id,
      manifest: payload.capture.manifest,
      canvasIndex: payload.capture.canvasIndex,
    },
    payload.capture,
  );

  return {
    ...story,
    chapters: [...story.chapters, chapter],
  };
};

export const updateChapterFromCapture = (
  story: StoryState,
  payload: UpdateChapterPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const updated = applyCapture(current, payload.capture);
  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const deleteChapter = (story: StoryState, payload: DeleteChapterPayload): StoryState => {
  const nextChapters = story.chapters.filter((chapter) => chapter.id !== payload.chapterId);
  if (nextChapters.length === story.chapters.length) return story;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const setNarrationTrack = (
  story: StoryState,
  payload: NarrationTrackPayload,
): StoryState => {
  const tracks = {
    ...(story.narration?.tracks ?? {}),
    [payload.language]: { src: payload.src },
  };

  return {
    ...story,
    narration: {
      tracks,
    },
  };
};

export const setNarrationSegment = (
  story: StoryState,
  payload: NarrationSegmentPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const currentSegments = current.narrationSegment ?? {};
  const nextSegments: Record<string, NarrationSegment> = {
    ...currentSegments,
    [payload.language]: { start: payload.start, end: payload.end },
  };

  const updated: Chapter = {
    ...current,
    narrationSegment: nextSegments,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const removeNarrationSegment = (
  story: StoryState,
  payload: RemoveNarrationSegmentPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  if (!current.narrationSegment?.[payload.language]) return story;

  const { [payload.language]: _removed, ...remainingSegments } = current.narrationSegment;
  const { narrationSegment: _currentSegments, ...chapterWithoutSegments } = current;
  const updated: Chapter =
    Object.keys(remainingSegments).length > 0
      ? { ...chapterWithoutSegments, narrationSegment: remainingSegments }
      : chapterWithoutSegments;

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const setAnnotationText = (
  story: StoryState,
  payload: AnnotationTextPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const currentAnnotations = current.annotations ?? {};
  const previous = currentAnnotations[payload.language] ?? {};
  const nextAnnotations = {
    ...currentAnnotations,
    [payload.language]: {
      ...previous,
      text: payload.text,
    },
  };

  const updated: Chapter = {
    ...current,
    annotations: nextAnnotations,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const setAnnotationPlacement = (
  story: StoryState,
  payload: AnnotationPlacementPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const currentAnnotations = current.annotations ?? {};
  const previous = currentAnnotations[payload.language] ?? {};
  const nextAnnotations = {
    ...currentAnnotations,
    [payload.language]: {
      ...previous,
      placement: payload.placement,
    },
  };

  const updated: Chapter = {
    ...current,
    annotations: nextAnnotations,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const setAdvanceMode = (story: StoryState, payload: AdvanceModePayload): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const nextAdvance: ChapterAdvance = {
    ...(current.advance ?? { mode: payload.mode }),
    mode: payload.mode,
  };

  const updated: Chapter = {
    ...current,
    advance: nextAdvance,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const setDelay = (story: StoryState, payload: AdvanceDelayPayload): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const nextAdvance: ChapterAdvance = {
    ...(current.advance ?? { mode: 'manual' }),
    delayMs: payload.delayMs,
  };

  const updated: Chapter = {
    ...current,
    advance: nextAdvance,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const setChapterManifest = (
  story: StoryState,
  payload: ChapterManifestPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  if (current.manifest === payload.manifest) return story;

  const updated: Chapter = {
    ...current,
    manifest: payload.manifest,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const setChapterTitle = (story: StoryState, payload: ChapterMetadataPayload): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const nextTitle = {
    ...(current.title ?? {}),
    [payload.language]: payload.value ?? '',
  };

  const updated: Chapter = {
    ...current,
    title: nextTitle,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const setStoryTitle = (story: StoryState, payload: StoryMetadataPayload): StoryState => {
  const nextTitle = {
    ...(story.title ?? {}),
    [payload.language]: payload.value ?? '',
  };

  return {
    ...story,
    title: nextTitle,
  };
};

export const setStoryIdentifiers = (
  story: StoryState,
  payload: StoryIdentifiersPayload,
): StoryState => {
  if (story.publication?.identifiersLocked) return story;
  const id = payload.id?.trim() || undefined;
  const annotationBase = payload.annotationBase?.trim() || undefined;
  return {
    ...story,
    id,
    publication: {
      ...story.publication,
      ...(annotationBase ? { annotationBase } : {}),
    },
  };
};

export const setChapterCameraTrack = (
  story: StoryState,
  payload: ChapterCameraTrackPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;
  const nextChapters = [...story.chapters];
  const current = nextChapters[index];
  if (!current) return story;
  const { cameraTrack: _previous, ...withoutTrack } = current;
  nextChapters[index] = payload.cameraTrack
    ? { ...withoutTrack, cameraTrack: payload.cameraTrack }
    : withoutTrack;
  return { ...story, chapters: nextChapters };
};

export const setChapterViewBox = (
  story: StoryState,
  payload: ChapterViewBoxPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;
  const nextChapters = [...story.chapters];
  nextChapters[index] = { ...nextChapters[index], viewBox: payload.viewBox };
  return { ...story, chapters: nextChapters };
};

export const setChapterDescription = (
  story: StoryState,
  payload: ChapterMetadataPayload,
): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const nextDescription = {
    ...(current.description ?? {}),
    [payload.language]: payload.value ?? '',
  };

  const updated: Chapter = {
    ...current,
    description: nextDescription,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export type ChapterLayersPayload = {
  chapterId: string;
  layerOpacities: Record<string, number>;
};

export const setLayerOpacities = (story: StoryState, payload: ChapterLayersPayload): StoryState => {
  const index = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  if (index === -1) return story;

  const current = story.chapters[index];
  const updated: Chapter = {
    ...current,
    layerOpacities: payload.layerOpacities,
  };

  const nextChapters = [...story.chapters];
  nextChapters[index] = updated;

  return {
    ...story,
    chapters: nextChapters,
  };
};

export const reorderChapter = (story: StoryState, payload: ReorderChapterPayload): StoryState => {
  if (payload.chapterId === payload.targetChapterId) return story;

  const sourceIndex = story.chapters.findIndex((chapter) => chapter.id === payload.chapterId);
  const targetIndex = story.chapters.findIndex((chapter) => chapter.id === payload.targetChapterId);
  if (sourceIndex === -1 || targetIndex === -1) return story;

  const nextChapters = [...story.chapters];
  const [moved] = nextChapters.splice(sourceIndex, 1);
  if (!moved) return story;

  let insertAt = nextChapters.findIndex((chapter) => chapter.id === payload.targetChapterId);
  if (insertAt === -1) return story;
  if (payload.position === 'after') {
    insertAt += 1;
  }
  nextChapters.splice(insertAt, 0, moved);

  return {
    ...story,
    chapters: nextChapters,
  };
};

/**
 * StoryState store using Svelte 5 runes.
 *
 * This is a runes-based reactive store that can be used from Svelte components.
 * It maintains story data as plain, serializable state following the architectural principle
 * that story JSON must remain plain data without functions or runtime values.
 *
 * Usage in a Svelte component:
 * ```svelte
 * <script>
 *   import { createStoryStore } from '$lib/state/story.svelte';
 *   const store = createStoryStore();
 * </script>
 *
 * {store.story.chapters.length} chapters
 * ```
 */
export function createStoryStore(initial?: StoryState) {
  // Use $state for reactive story
  let story = $state<StoryState>(initial ?? createEmptyStory());

  return {
    // Getter for reactive story access
    get story() {
      return story;
    },

    // Methods to mutate story state
    addChapterFromCapture(payload: AddChapterPayload): void {
      story = addChapterFromCapture(story, payload);
    },

    updateChapterFromCapture(payload: UpdateChapterPayload): void {
      story = updateChapterFromCapture(story, payload);
    },

    deleteChapter(payload: DeleteChapterPayload): void {
      story = deleteChapter(story, payload);
    },

    setNarrationTrack(payload: NarrationTrackPayload): void {
      story = setNarrationTrack(story, payload);
    },

    setNarrationSegment(payload: NarrationSegmentPayload): void {
      story = setNarrationSegment(story, payload);
    },

    removeNarrationSegment(payload: RemoveNarrationSegmentPayload): void {
      story = removeNarrationSegment(story, payload);
    },

    setAnnotationText(payload: AnnotationTextPayload): void {
      story = setAnnotationText(story, payload);
    },

    setAnnotationPlacement(payload: AnnotationPlacementPayload): void {
      story = setAnnotationPlacement(story, payload);
    },

    setAdvanceMode(payload: AdvanceModePayload): void {
      story = setAdvanceMode(story, payload);
    },

    setDelay(payload: AdvanceDelayPayload): void {
      story = setDelay(story, payload);
    },

    setChapterManifest(payload: ChapterManifestPayload): void {
      story = setChapterManifest(story, payload);
    },

    setChapterTitle(payload: ChapterMetadataPayload): void {
      story = setChapterTitle(story, payload);
    },

    setStoryTitle(payload: StoryMetadataPayload): void {
      story = setStoryTitle(story, payload);
    },

    setStoryIdentifiers(payload: StoryIdentifiersPayload): void {
      story = setStoryIdentifiers(story, payload);
    },

    setChapterCameraTrack(payload: ChapterCameraTrackPayload): void {
      story = setChapterCameraTrack(story, payload);
    },

    setChapterViewBox(payload: ChapterViewBoxPayload): void {
      story = setChapterViewBox(story, payload);
    },

    setChapterDescription(payload: ChapterMetadataPayload): void {
      story = setChapterDescription(story, payload);
    },

    setLayerOpacities(payload: ChapterLayersPayload): void {
      story = setLayerOpacities(story, payload);
    },

    reorderChapter(payload: ReorderChapterPayload): void {
      story = reorderChapter(story, payload);
    },

    // Export story as plain JSON
    exportStory(): StoryState {
      return story;
    },

    // Load a story (replace current state)
    loadStory(next: StoryState): void {
      story = next;
    },
  };
}

export type StoryStoreRunes = ReturnType<typeof createStoryStore>;
