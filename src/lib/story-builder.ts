export { default as StoryMainSidebar } from './story/ui/MainSidebar.svelte';
export { default as StoryBottomAuthoringBar } from './story/ui/BottomAuthoringBar.svelte';
export { default as StoryNarrationOverlay } from './story/ui/NarrationOverlay.svelte';
export { default as StoryChapterOverlay } from './story/ui/ChapterOverlay.svelte';
export { default as StoryAnnotationOverlay } from './story/ui/StoryAnnotationOverlay.svelte';
export { captureAudioVideo, captureImagePdf, captureModel } from './story/capture';
export { createMediaMarks } from './story/mediaMarks';
export { createModelPose } from './story/modelPose';
export { setChapterManifest } from './state/story.svelte';
export { resolveManifestForNewChapter } from './story/manifestResolver';
export { validateStory } from './story/validation';
export {
  addChapterFromCapture,
  createEmptyStory,
  createStoryStore,
  deleteChapter,
  setAdvanceMode,
  setAnnotationPlacement,
  setAnnotationText,
  setDelay,
  setNarrationSegment,
  setNarrationTrack,
  updateChapterFromCapture,
  type StoryStoreRunes,
} from './state/story.svelte';
export { createStoryBuilderPlugins } from './plugins/storyBuilder';
export type {
  AnnotationPlacement,
  Chapter,
  ChapterAdvance,
  ChapterAnnotation,
  ChapterMedia,
  ChapterModel,
  LanguageMap,
  NarrationSegment,
  NarrationTrack,
  Story,
} from './core/types/story';
