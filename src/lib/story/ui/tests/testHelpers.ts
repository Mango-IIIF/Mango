import { writable } from 'svelte/store';
import {
  createStoryStore,
  type AddChapterPayload,
  type DeleteChapterPayload,
  type ChapterManifestPayload,
  type AnnotationTextPayload,
  type AnnotationPlacementPayload,
  type AdvanceModePayload,
  type AdvanceDelayPayload,
  type ChapterMetadataPayload,
  type NarrationTrackPayload,
} from '../../../state/story.svelte';
import type { Story } from '../../../core/types/story';

/**
 * Test helper that wraps the runes store to provide a Readable<Story>
 * for components that expect the old store API.
 */
export function createStoryStoreForTest(initial?: Story) {
  const runesStore = createStoryStore(initial);
  const storyWritable = writable(runesStore.story);

  return {
    // Store that components can subscribe to
    story: storyWritable,
    
    // Wrapped methods that update both runes and writable
    addChapterFromCapture(payload: AddChapterPayload) {
      runesStore.addChapterFromCapture(payload);
      storyWritable.set(runesStore.story);
    },
    
    deleteChapter(payload: DeleteChapterPayload) {
      runesStore.deleteChapter(payload);
      storyWritable.set(runesStore.story);
    },
    
    setChapterManifest(payload: ChapterManifestPayload) {
      runesStore.setChapterManifest(payload);
      storyWritable.set(runesStore.story);
    },

    setAnnotationText(payload: AnnotationTextPayload) {
      runesStore.setAnnotationText(payload);
      storyWritable.set(runesStore.story);
    },

    setAnnotationPlacement(payload: AnnotationPlacementPayload) {
      runesStore.setAnnotationPlacement(payload);
      storyWritable.set(runesStore.story);
    },

    setAdvanceMode(payload: AdvanceModePayload) {
      runesStore.setAdvanceMode(payload);
      storyWritable.set(runesStore.story);
    },

    setDelay(payload: AdvanceDelayPayload) {
      runesStore.setDelay(payload);
      storyWritable.set(runesStore.story);
    },

    setChapterTitle(payload: ChapterMetadataPayload) {
      runesStore.setChapterTitle(payload);
      storyWritable.set(runesStore.story);
    },

    setChapterDescription(payload: ChapterMetadataPayload) {
      runesStore.setChapterDescription(payload);
      storyWritable.set(runesStore.story);
    },

    setNarrationTrack(payload: NarrationTrackPayload) {
      runesStore.setNarrationTrack(payload);
      storyWritable.set(runesStore.story);
    },
    
    exportStory() {
      return runesStore.exportStory();
    },
  };
}
