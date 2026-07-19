<script lang="ts">
  import type { Readable, Writable } from 'svelte/store';
  import type { StoryState } from '../../core/types/story';
  import StoryNarrationOverlay from './NarrationOverlay.svelte';
  import StoryChapterOverlay from './ChapterOverlay.svelte';
  import StoryAnnotationOverlay from './StoryAnnotationOverlay.svelte';
  import SaveExportModal from './SaveExportModal.svelte';
  import RectanglePlacementEditor from '../../features/annotations/RectanglePlacementEditor.svelte';
  import type { AnnotationPlacement, ChapterAdvance } from '../../core/types/story';
  import type { ViewBox } from '../../core/types/viewer';
  import type { UIMode } from '../storyBuilderController';
  import type { MediaType, MediaSource } from '../../iiif/mediaResolver';
  import type { MediaMarksState } from '../mediaMarks';
  import type { ExportEnvelope } from '../storySerializer';
 
  export let story: Readable<StoryState>;
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
  export let saveModalPayload: Readable<ExportEnvelope | null>;
  export let onCloseSaveModal: () => void;
  export let onSetAnnotationLanguage: (lang: string) => void;
  export let annotationLanguage: Readable<string>;
  export let language = 'en';
  export let languages: string[] = ['en'];
  export let onBackNarration: () => void;
  export let onCloseNarration: () => void;
  export let onCloseChapter: () => void;
  export let onSetMediaMarks: (start: number | null, end: number | null) => void;
  export let positioningLanguage: Readable<string | null>;
  export let onStartAnnotationPositioning: (lang: string) => void;
  export let onConfirmAnnotationPositioning: () => void;
  export let onCancelAnnotationPositioning: () => void;
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
  let exportPayload: ExportEnvelope | null = null;
  $: exportPayload = $saveModalPayload;
  let exportModalOpen = false;
  $: exportModalOpen = $saveModalOpen;

  let activePositioningLanguage: string | null = null;
  $: activePositioningLanguage = $positioningLanguage;

  let positioningText = '';
  $: if (currentMode === 'annotationPositioning' && activePositioningLanguage && chapterId) {
    const ch = $story.chapters.find(c => c.id === chapterId);
    const ann = ch?.annotations?.[activePositioningLanguage];
    positioningText = ann?.text ?? '';
  } else {
    positioningText = '';
  }

  let overlayWidth = 0;
  let overlayHeight = 0;

  let currentViewBox: ViewBox | null = null;
  $: currentViewBox = $viewBox;

  let placementRectValue: { x: number; y: number; w: number; h: number } | null = null;

  const toScreenX = (canvasX: number): number =>
    currentViewBox && overlayWidth > 0 ? ((canvasX - currentViewBox.x) / currentViewBox.w) * overlayWidth : 0;
  const toScreenY = (canvasY: number): number =>
    currentViewBox && overlayHeight > 0 ? ((canvasY - currentViewBox.y) / currentViewBox.h) * overlayHeight : 0;

  const toCanvasX = (screenX: number): number =>
    currentViewBox && overlayWidth > 0 ? currentViewBox.x + (screenX / overlayWidth) * currentViewBox.w : 0;
  const toCanvasY = (screenY: number): number =>
    currentViewBox && overlayHeight > 0 ? currentViewBox.y + (screenY / overlayHeight) * currentViewBox.h : 0;

  const normalizedFromCanvas = (rect: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } | null => {
    if (!currentViewBox || overlayWidth <= 0 || overlayHeight <= 0) return null;
    const x = toScreenX(rect.x) / overlayWidth;
    const y = toScreenY(rect.y) / overlayHeight;
    const w = rect.w / currentViewBox.w;
    const h = rect.h / currentViewBox.h;
    
    const clampedW = Math.min(1, Math.max(0.0001, w));
    const clampedH = Math.min(1, Math.max(0.0001, h));
    return {
      x: Math.min(1 - clampedW, Math.max(0, x)),
      y: Math.min(1 - clampedH, Math.max(0, y)),
      w: clampedW,
      h: clampedH
    };
  };

  const canvasFromNormalized = (rect: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } | null => {
    if (!currentViewBox || overlayWidth <= 0 || overlayHeight <= 0) return null;
    const sx1 = rect.x * overlayWidth;
    const sy1 = rect.y * overlayHeight;
    const sx2 = (rect.x + rect.w) * overlayWidth;
    const sy2 = (rect.y + rect.h) * overlayHeight;

    const cx1 = toCanvasX(sx1);
    const cy1 = toCanvasY(sy1);
    const cx2 = toCanvasX(sx2);
    const cy2 = toCanvasY(sy2);

    return {
      x: cx1,
      y: cy1,
      w: Math.max(1, cx2 - cx1),
      h: Math.max(1, cy2 - cy1)
    };
  };

  let editingCanvasRect: { x: number; y: number; w: number; h: number } | null = null;
  let lastMode: UIMode = 'idle';

  $: if (currentMode === 'annotationPositioning' && lastMode !== 'annotationPositioning' && activePositioningLanguage && chapterId) {
    lastMode = currentMode;
    const ch = $story.chapters.find(c => c.id === chapterId);
    const ann = ch?.annotations?.[activePositioningLanguage];
    const cv = ch?.viewBox;

    const defaultAbsRect = cv ? {
      x: cv.x + cv.w * 0.33,
      y: cv.y + cv.h * 0.33,
      w: cv.w * 0.34,
      h: cv.h * 0.34
    } : { x: 4500, y: 6500, w: 800, h: 300 };

    let initialAbsRect = defaultAbsRect;

    if (
      ann &&
      ann.placement &&
      Number.isFinite(ann.placement.x) &&
      Number.isFinite(ann.placement.y) &&
      Number.isFinite(ann.placement.w) &&
      Number.isFinite(ann.placement.h)
    ) {
      const isAbs = ann.placement.x > 1 || ann.placement.y > 1 || ann.placement.w > 1 || ann.placement.h > 1;
      if (isAbs) {
        initialAbsRect = ann.placement;
      } else if (cv) {
        initialAbsRect = {
          x: cv.x + cv.w * ann.placement.x,
          y: cv.y + cv.h * ann.placement.y,
          w: cv.w * ann.placement.w,
          h: cv.h * ann.placement.h
        };
      }
    }
    editingCanvasRect = initialAbsRect;
  } else if (currentMode !== 'annotationPositioning' && lastMode === 'annotationPositioning') {
    lastMode = currentMode;
    editingCanvasRect = null;
    placementRectValue = null;
  }

  $: if (currentMode === 'annotationPositioning' && editingCanvasRect && currentViewBox && overlayWidth > 0 && overlayHeight > 0) {
    const normalized = normalizedFromCanvas(editingCanvasRect);
    if (
      normalized &&
      Number.isFinite(normalized.x) &&
      Number.isFinite(normalized.y) &&
      Number.isFinite(normalized.w) &&
      Number.isFinite(normalized.h)
    ) {
      placementRectValue = normalized;
    } else {
      placementRectValue = { x: 0.33, y: 0.33, w: 0.34, h: 0.34 };
    }
  }

  const handleEditorChange = (rect: { x: number; y: number; w: number; h: number } | null) => {
    if (rect) {
      const absCanvas = canvasFromNormalized(rect);
      if (absCanvas && Number.isFinite(absCanvas.x)) {
        editingCanvasRect = absCanvas;
      }
    }
  };

  const handleConfirm = () => {
    if (editingCanvasRect && chapterId && activePositioningLanguage) {
      onUpdateAnnotationPlacement(activePositioningLanguage, editingCanvasRect);
    }
    onConfirmAnnotationPositioning();
  };

  const handleCancel = () => {
    onCancelAnnotationPositioning();
  };
</script>

<div class="story-builder-overlay-root" bind:clientWidth={overlayWidth} bind:clientHeight={overlayHeight}>
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
    onUpdateChapterPosition={() => onUpdateChapterPosition()}
    onSave={onSaveChapterSettings}
    onSetAnnotationLanguage={onSetAnnotationLanguage}
    onSetAnnotationPositioning={(lang) => onStartAnnotationPositioning(lang)}
    layers={$layers}
    layerOpacities={$layerOpacities}
    onUpdateLayerOpacity={onUpdateLayerOpacity}
  />

  {#if currentMode !== 'annotationPositioning'}
    <StoryAnnotationOverlay
      {story}
      {viewBox}
      {chapterId}
      language={overlayAnnotationLanguage}
    />
  {/if}

  <SaveExportModal
    open={exportModalOpen}
    payload={exportPayload}
    onclose={onCloseSaveModal}
  />

  {#if currentMode === 'annotationPositioning'}
    <div class="story-builder-positioning-container">
      {#if placementRectValue}
        <div class="story-builder-positioning-editor-wrapper">
          <RectanglePlacementEditor
            enabled={true}
            value={placementRectValue}
            minSize={0.001}
            allowCreate={false}
            allowMove={true}
            allowResize={true}
            showHandles={true}
            passthrough={false}
            text={positioningText}
            onrectchange={({ rect }) => handleEditorChange(rect)}
          />
        </div>
      {/if}

      <div class="story-builder-positioning-toolbar">
        <button
          class="story-builder-positioning-button story-builder-positioning-button--cancel"
          type="button"
          on:click={handleCancel}
        >
          Cancel
        </button>
        <button
          class="story-builder-positioning-button story-builder-positioning-button--confirm"
          type="button"
          on:click={handleConfirm}
        >
          Confirm Position
        </button>
      </div>
    </div>
  {/if}

</div>

<style>
  .story-builder-overlay-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .story-builder-positioning-container {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background: rgba(11, 18, 26, 0.4);
    z-index: 100;
  }

  .story-builder-positioning-editor-wrapper {
    position: absolute;
    inset: 0;
    z-index: 101;
  }

  .story-builder-positioning-toolbar {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(25, 33, 44, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    z-index: 102;
  }

  .story-builder-positioning-button {
    border: none;
    border-radius: 10px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .story-builder-positioning-button--cancel {
    background: rgba(255, 255, 255, 0.15);
    color: #eef3f8;
  }

  .story-builder-positioning-button--cancel:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .story-builder-positioning-button--confirm {
    background: var(--accent, #e07a3f);
    color: #fffaf6;
  }

  .story-builder-positioning-button--confirm:hover {
    background: var(--accent-hover, #ef8f56);
    box-shadow: 0 0 12px rgba(224, 122, 63, 0.4);
  }

</style>
