export { default as StoryMainSidebar } from './story/ui/MainSidebar.svelte';
export { default as StoryBottomAuthoringBar } from './story/ui/BottomAuthoringBar.svelte';
export { default as StoryNarrationOverlay } from './story/ui/NarrationOverlay.svelte';
export { default as StoryChapterOverlay } from './story/ui/ChapterOverlay.svelte';
export { default as StoryAnnotationOverlay } from './story/ui/StoryAnnotationOverlay.svelte';
export {
  captureAudioVideo,
  captureImagePdf,
  captureModel,
} from './story/capture';
export { createMediaMarks } from './story/mediaMarks';
export { createModelPose } from './story/modelPose';
export { setChapterManifest } from './state/story.svelte';
export { resolveManifestForNewChapter } from './story/manifestResolver';
export { validateStory } from './story/validation';
export {
  buildExportEnvelope,
  serializeStoryToIiif,
  type ExportEnvelope,
  type SerializeStoryOptions,
  type StoryAnnotation,
  type StoryAnnotationPage,
} from './story/storySerializer';
export {
  IIIF_PRESENTATION_3_CONTEXT,
  MANGO_STORY_CONTEXT,
  MANGO_STORY_NAMESPACE,
  MANGO_STORY_VERSION,
  MANGO_VIEWER_STATE_FORMAT,
  MANGO_VIEWER_STATE_TYPE,
  type MangoStoryPlayback,
  type MangoViewerState,
  type MangoViewerStateBody,
} from './story/storyAnnotationProfile';
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
} from './core/types/story';
