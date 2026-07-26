export { default as StoryControlsStage } from './story/viewer/StoryControlsStage.svelte';
export { default as StoryAnnotationOverlay } from './story/ui/StoryAnnotationOverlay.svelte';
export {
  createStoryViewerRuntime,
  type StoryViewerRuntime,
} from './story/viewer/storyViewerController';
export {
  normaliseStoryInput,
  validateStoryViewer,
  type StoryWithDefaults,
} from './story/viewer/storyLoader';
export type {
  StoryAnnotation,
  StoryAnnotationPage,
} from './story/storySerializer';
export type {
  AnnotationPlacement,
  Chapter,
  ChapterAdvance,
  ChapterEntryTransition,
  ChapterCameraKeyframe,
  ChapterCameraTrack,
  ChapterAnnotation,
  ChapterMedia,
  ChapterModel,
  LanguageMap,
  NarrationSegment,
  NarrationTrack,
  StoryPublication,
  StoryState,
} from './core/types/story';
