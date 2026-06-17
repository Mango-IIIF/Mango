<script lang="ts">
  import type { Readable, Writable } from 'svelte/store';
  import type { Story } from '../../core/types/story';
  import StoryNarrationOverlay from './NarrationOverlay.svelte';
  import StoryChapterOverlay from './ChapterOverlay.svelte';
  import StoryAnnotationOverlay from './StoryAnnotationOverlay.svelte';
  import SaveExportModal from './SaveExportModal.svelte';
  import type { AnnotationPlacement, ChapterAdvance } from '../../core/types/story';
  import type { ViewBox } from '../../core/types/viewer';
  import type { UIMode } from '../storyBuilderController';
  import type { MediaType, MediaSource } from '../../iiif/mediaResolver';
  import type { MediaMarksState } from '../mediaMarks';

  export let story: Readable<Story>;
  export let layers: Readable<MediaSource[]>;
  export let layerOpacities: Readable<Record<string, number>>;
  export let onUpdateLayerOpacity: (id: string, opacity: number) => void;
  export let currentManifest: Readable<string | null>;
  export let viewBox: Readable<ViewBox | null>;
  export let selectedChapterId: Writable<string | null>;
  export let uiMode: Readable<UIMode>;
  export let mediaType: Readable<MediaType | null>;
  export let mediaMarks: Readable<MediaMarksState>;
  export let avMarksValid: Readable<boolean>;
  export let saveModalOpen: Readable<boolean>;
  export let saveModalPayload: Readable<any>;
  export let onCloseSaveModal: () => void;
  export let onSetAnnotationLanguage: (lang: string) => void;
  export let annotationLanguage: Readable<string>;
  export let language = 'en';
  export let languages: string[] = ['en'];
  export let onBackNarration: () => void;
  export let onCloseNarration: () => void;
  export let onCloseChapter: () => void;
  export let onSetMediaMarks: (start: number | null, end: number | null) => void;
  export let onPreviewMediaSegment: () => void;
  export let onStopPreviewMediaSegment: () => void;
  export let onSetNarrationTrack: (lang: string, src: string) => void;
  export let onAssignSegment: (lang: string, start: number, end: number) => void;
  export let onUpdateManifest: (manifest: string) => void;
  export let onReloadManifest: (manifest: string, canvasIndex: number) => void;
  export let onLoadManifest: (manifest: string) => void;
  export let onUpdateChapterTitle: (lang: string, value: string) => void;
  export let onUpdateChapterDescription: (lang: string, value: string) => void;
  export let onUpdateAnnotationText: (lang: string, text: string) => void;
  export let onUpdateAnnotationPlacement: (lang: string, placement: AnnotationPlacement) => void;
  export let onUpdateAdvanceMode: (mode: ChapterAdvance['mode']) => void;
  export let onUpdateDelay: (delayMs?: number) => void;
  export let onUpdateChapterPosition: () => void;
  export let onSaveChapterSettings: () => void;
  export let onMarkIn: () => void;
  export let onMarkOut: () => void;

  let chapterId: string | null = null;
  let manifestValue: string | null = null;
  let currentMode: UIMode = 'idle';
  let narrationOpen = false;
  let chapterOpen = false;
  $: chapterId = $selectedChapterId;
  $: manifestValue = $currentManifest;
  $: currentMode = $uiMode;
  $: narrationOpen = currentMode === 'narrationPanel';
  $: chapterOpen = currentMode === 'chapterEdit';
  let overlayAnnotationLanguage = language;
  $: overlayAnnotationLanguage = $annotationLanguage ?? language;
  let exportPayload: any = null;
  $: exportPayload = $saveModalPayload;
  let exportModalOpen = false;
  $: exportModalOpen = $saveModalOpen;
</script>

<StoryNarrationOverlay
  {story}
  open={narrationOpen}
  {chapterId}
  {language}
  {languages}
  onBack={onBackNarration}
  onClose={onCloseNarration}
  onSetNarrationTrack={onSetNarrationTrack}
  onAssignSegment={onAssignSegment}
/>

<StoryChapterOverlay
  {story}
  open={chapterOpen}
  {chapterId}
  currentManifest={manifestValue}
  {mediaType}
  {mediaMarks}
  {avMarksValid}
  {language}
  {languages}
  onClose={onCloseChapter}
  onSetNarrationTrack={onSetNarrationTrack}
  onAssignSegment={onAssignSegment}
  onSetMediaMarks={onSetMediaMarks}
  onPreviewMediaSegment={onPreviewMediaSegment}
  onStopPreviewMediaSegment={onStopPreviewMediaSegment}
  onUpdateManifest={(chapterId, manifest) => onUpdateManifest(manifest)}
  onLoadManifest={onLoadManifest}
  onReloadManifest={(chapterId, manifest, canvasIndex) =>
    onReloadManifest(manifest, canvasIndex)}
  onUpdateChapterTitle={(chapterId, lang, value) => onUpdateChapterTitle(lang, value)}
  onUpdateChapterDescription={(chapterId, lang, value) =>
    onUpdateChapterDescription(lang, value)}
  onUpdateAnnotationText={(chapterId, lang, text) => onUpdateAnnotationText(lang, text)}
  onUpdateAnnotationPlacement={(chapterId, lang, placement) =>
    onUpdateAnnotationPlacement(lang, placement)}
  onUpdateAdvanceMode={(chapterId, mode) => onUpdateAdvanceMode(mode)}
  onUpdateDelay={(chapterId, delayMs) => onUpdateDelay(delayMs)}
  onUpdateChapterPosition={(chapterId) => onUpdateChapterPosition()}
  onSave={onSaveChapterSettings}
  onSetAnnotationLanguage={onSetAnnotationLanguage}
  layers={$layers}
  layerOpacities={$layerOpacities}
  onUpdateLayerOpacity={onUpdateLayerOpacity}
/>

<StoryAnnotationOverlay
  {story}
  {viewBox}
  {chapterId}
  language={overlayAnnotationLanguage}
/>

<SaveExportModal
  open={exportModalOpen}
  payload={exportPayload}
  on:close={onCloseSaveModal}
/>

<!-- Show Mark In/Out buttons when audio/video is loaded and chapter editor is NOT open -->
{#if $mediaType === 'audio' || $mediaType === 'video'}
  {#if !chapterOpen}
    <div class="story-builder-av" data-testid="authoring-av-controls">
      <div class="story-builder-av__hint">
        Use Mark In/Out to capture the segment for this chapter.
      </div>
      <div class="story-builder-av__buttons">
        <button
          class="story-builder-av__button"
          type="button"
          data-testid="authoring-mark-in"
          on:click={onMarkIn}
        >
          Mark In
        </button>
        <button
          class="story-builder-av__button"
          type="button"
          data-testid="authoring-mark-out"
          on:click={onMarkOut}
        >
          Mark Out
        </button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .story-builder-av {
    position: fixed;
    right: 16px;
    bottom: 16px;
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(11, 18, 26, 0.9);
    color: #eef3f8;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    z-index: 20;
  }

  .story-builder-av__hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
  }

  .story-builder-av__buttons {
    display: flex;
    gap: 8px;
  }

  .story-builder-av__button {
    border: none;
    border-radius: 10px;
    padding: 8px 12px;
    background: var(--accent, #e07a3f);
    color: #fffaf6;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }
</style>
