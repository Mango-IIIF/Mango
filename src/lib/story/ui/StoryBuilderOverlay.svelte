<script lang="ts">
  import type { Readable, Writable } from 'svelte/store';
  import { readable } from 'svelte/store';
  import { MapPin } from '@lucide/svelte';
  import type { StoryState } from '../../core/types/story';
  import StoryNarrationOverlay from './NarrationOverlay.svelte';
  import StoryChapterOverlay from './ChapterOverlay.svelte';
  import StoryAnnotationOverlay from './StoryAnnotationOverlay.svelte';
  import SaveExportModal from './SaveExportModal.svelte';
  import RectanglePlacementEditor from '../../features/annotations/RectanglePlacementEditor.svelte';
  import type {
    AnnotationPlacement,
    ChapterAdvance,
  } from '../../core/types/story';
  import type { ViewBox } from '../../core/types/viewer';
  import type { UIMode } from '../storyBuilderController';
  import type { MediaType, MediaSource } from '../../iiif/mediaResolver';
  import type { MediaMarksState } from '../mediaMarks';
  import type { ExportEnvelope } from '../storySerializer';
  import type { ChapterTaskId } from '../chapterTasks';
  import { t } from '../../core/i18n';

  export let story: Readable<StoryState>;
  export let surface: 'overlay' | 'inspector' = 'overlay';
  export let layers: Readable<MediaSource[]>;
  export let layerOpacities: Readable<Record<string, number>>;
  export let onUpdateLayerOpacity: (id: string, opacity: number) => void;
  export let currentManifest: Readable<string | null>;
  export let viewBox: Readable<ViewBox | null>;
  export let selectedChapterId: Writable<string | null>;
  export let activeChapterTask: Readable<ChapterTaskId | null>;
  export let selectedMotionPointId: Readable<string | null> = readable(null);
  export let onGoToMotionPoint: (keyframeId: string) => void = () => {};
  export let onMoveMotionPoint: (
    keyframeId: string,
    focus: { x: number; y: number },
  ) => void = () => {};
  export let onChapterTaskChange: ((task: ChapterTaskId | null) => void) | undefined = undefined;
  export let validationErrors: Readable<string[]>;
  export let uiMode: Readable<UIMode>;
  export let mediaType: Readable<MediaType | null>;
  export let mediaMarks: Readable<MediaMarksState>;
  export let avMarksValid: Readable<boolean>;
  export let transitionDelayDefault: Readable<number>;
  export let saveModalOpen: Readable<boolean>;
  export let saveModalPayload: Readable<ExportEnvelope | null>;
  export let onCloseSaveModal: () => void;
  export let onSetAnnotationLanguage: (lang: string) => void;
  export let annotationLanguage: Readable<string>;
  export let language = 'en';
  export let languages: string[] = ['en'];
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
  export let onUpdateStoryTitle: (lang: string, value: string) => void;
  export let onUpdateStoryIdentifiers: (id: string, annotationBase: string) => void;
  export let onAssignSegment: (lang: string, start: number, end: number) => void;
  export let onSkipNarration: (lang: string) => void;
  export let onUpdateManifest: (manifest: string) => void;
  export let onReloadManifest: (manifest: string, canvasIndex: number) => void;
  export let onLoadManifest: (manifest: string) => void;
  export let onLoadSource: (manifest: string) => void;
  export let onAddChapter: () => void;
  export let onUpdateChapterTitle: (lang: string, value: string) => void;
  export let onUpdateChapterDescription: (lang: string, value: string) => void;
  export let onUpdateAnnotationText: (lang: string, text: string) => void;
  export let onUpdateAnnotationPlacement: (lang: string, placement: AnnotationPlacement) => void;
  export let onUpdateAdvanceMode: (mode: ChapterAdvance['mode']) => void;
  export let onUpdateDelay: (delayMs?: number) => void;
  export let onSetChapterPosition: (viewBox: ViewBox) => void;
  export let storyPreviewing: Readable<boolean> = readable(false);
  export let onPreviewChapter: (chapterId?: string) => void = () => {};
  export let onStopChapterPreview: () => void = () => {};
  export let onRevertChapterPosition: () => void;
  export let onSaveChapterSettings: () => void;
  export let onCancelChapterSettings: () => void = () => {};
  export let motionPreviewing: Readable<boolean>;
  let chapterId: string | null = null;
  let manifestValue: string | null = null;
  let currentMode: UIMode = 'idle';
  let narrationOpen = false;
  let chapterOpen = false;
  $: chapterId = $selectedChapterId;
  $: manifestValue = $currentManifest;
  $: currentMode = $uiMode;
  $: narrationOpen = currentMode === 'narrationPanel';
  $: chapterOpen =
    currentMode === 'chapterEdit' ||
    (Boolean(chapterId) && currentMode !== 'narrationPanel') ||
    ((!manifestValue || $story.chapters.length === 0) && currentMode !== 'narrationPanel');
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
    const ch = $story.chapters.find((c) => c.id === chapterId);
    const ann = ch?.annotations?.[activePositioningLanguage];
    positioningText = ann?.text ?? '';
  } else {
    positioningText = '';
  }

  let overlayWidth = 0;
  let overlayHeight = 0;
  let overlayRoot: HTMLDivElement | null = null;

  let currentViewBox: ViewBox | null = null;
  $: currentViewBox = $viewBox;
  let motionMarkers: Array<{
    id: string;
    index: number;
    x: number;
    y: number;
    timeMs: number;
    offsetX: number;
    offsetY: number;
  }> = [];
  $: {
    const activeChapter = $story.chapters.find((entry) => entry.id === chapterId);
    const cameraPoints = activeChapter?.cameraTrack?.keyframes ?? [];
    const projected = currentViewBox
      ? cameraPoints.flatMap((point, index) => {
          if ((!point.focus && !point.viewBox) || !currentViewBox) return [];
          const centerX = point.focus?.x ?? point.viewBox!.x + point.viewBox!.w / 2;
          const centerY = point.focus?.y ?? point.viewBox!.y + point.viewBox!.h / 2;
          const x = (centerX - currentViewBox.x) / currentViewBox.w;
          const y = (centerY - currentViewBox.y) / currentViewBox.h;
          return x >= 0 && x <= 1 && y >= 0 && y <= 1
            ? [{ id: point.id, index, x, y, timeMs: point.timeMs }]
            : [];
        })
      : [];
    const locations = new Map<string, typeof projected>();
    for (const marker of projected) {
      const key = `${Math.round(marker.x * 50)}:${Math.round(marker.y * 50)}`;
      locations.set(key, [...(locations.get(key) ?? []), marker]);
    }
    motionMarkers = projected.map((marker) => {
      const key = `${Math.round(marker.x * 50)}:${Math.round(marker.y * 50)}`;
      const group = locations.get(key) ?? [marker];
      const position = group.findIndex((entry) => entry.id === marker.id);
      const spread = group.length > 1 ? (position - (group.length - 1) / 2) * 30 : 0;
      return { ...marker, offsetX: spread, offsetY: group.length > 1 ? -8 : 0 };
    });
  }

  let motionDrag: {
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    boundsWidth: number;
    boundsHeight: number;
    viewBox: ViewBox;
    x: number;
    y: number;
    moved: boolean;
  } | null = null;
  let suppressMotionClickFor: string | null = null;

  const handleMotionPointerDown = (event: PointerEvent, marker: (typeof motionMarkers)[number]) => {
    if (event.button !== 0) return;
    const bounds = overlayRoot?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0 || !currentViewBox) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    motionDrag = {
      id: marker.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: marker.x,
      startY: marker.y,
      boundsWidth: bounds.width,
      boundsHeight: bounds.height,
      viewBox: { ...currentViewBox },
      x: marker.x,
      y: marker.y,
      moved: false,
    };
  };

  const handleMotionPointerMove = (event: PointerEvent) => {
    if (!motionDrag || motionDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const distance = Math.hypot(
      event.clientX - motionDrag.startClientX,
      event.clientY - motionDrag.startClientY,
    );
    const moved = motionDrag.moved || distance >= 6;
    if (!moved) return;
    motionDrag = {
      ...motionDrag,
      x: Math.min(
        1,
        Math.max(
          0,
          motionDrag.startX + (event.clientX - motionDrag.startClientX) / motionDrag.boundsWidth,
        ),
      ),
      y: Math.min(
        1,
        Math.max(
          0,
          motionDrag.startY + (event.clientY - motionDrag.startClientY) / motionDrag.boundsHeight,
        ),
      ),
      moved,
    };
  };

  const finishMotionDrag = (event: PointerEvent, commit: boolean) => {
    if (!motionDrag || motionDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const drag = motionDrag;
    const moved =
      drag.moved ||
      Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) >= 6;
    const position = moved
      ? {
          x: Math.min(
            1,
            Math.max(0, drag.startX + (event.clientX - drag.startClientX) / drag.boundsWidth),
          ),
          y: Math.min(
            1,
            Math.max(0, drag.startY + (event.clientY - drag.startClientY) / drag.boundsHeight),
          ),
        }
      : { x: drag.x, y: drag.y };
    motionDrag = null;
    if (!commit || !moved) return;
    suppressMotionClickFor = drag.id;
    onMoveMotionPoint(drag.id, {
      x: drag.viewBox.x + position.x * drag.viewBox.w,
      y: drag.viewBox.y + position.y * drag.viewBox.h,
    });
  };

  const handleMotionClick = (event: MouseEvent, markerId: string) => {
    event.stopPropagation();
    if (suppressMotionClickFor === markerId) {
      suppressMotionClickFor = null;
      return;
    }
    onGoToMotionPoint(markerId);
  };

  const markerX = (marker: (typeof motionMarkers)[number]): number =>
    motionDrag?.id === marker.id && motionDrag.moved ? motionDrag.x : marker.x;
  const markerY = (marker: (typeof motionMarkers)[number]): number =>
    motionDrag?.id === marker.id && motionDrag.moved ? motionDrag.y : marker.y;
  let placementRectValue: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;

  const toScreenX = (canvasX: number): number =>
    currentViewBox && overlayWidth > 0
      ? ((canvasX - currentViewBox.x) / currentViewBox.w) * overlayWidth
      : 0;
  const toScreenY = (canvasY: number): number =>
    currentViewBox && overlayHeight > 0
      ? ((canvasY - currentViewBox.y) / currentViewBox.h) * overlayHeight
      : 0;

  const toCanvasX = (screenX: number): number =>
    currentViewBox && overlayWidth > 0
      ? currentViewBox.x + (screenX / overlayWidth) * currentViewBox.w
      : 0;
  const toCanvasY = (screenY: number): number =>
    currentViewBox && overlayHeight > 0
      ? currentViewBox.y + (screenY / overlayHeight) * currentViewBox.h
      : 0;

  const normalizedFromCanvas = (rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): { x: number; y: number; w: number; h: number } | null => {
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
      h: clampedH,
    };
  };

  const canvasFromNormalized = (rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): { x: number; y: number; w: number; h: number } | null => {
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
      h: Math.max(1, cy2 - cy1),
    };
  };

  let editingCanvasRect: { x: number; y: number; w: number; h: number } | null = null;
  let lastMode: UIMode = 'idle';

  $: if (
    currentMode === 'annotationPositioning' &&
    lastMode !== 'annotationPositioning' &&
    activePositioningLanguage &&
    chapterId
  ) {
    lastMode = currentMode;
    const ch = $story.chapters.find((c) => c.id === chapterId);
    const ann = ch?.annotations?.[activePositioningLanguage];
    const cv = ch?.viewBox;

    const defaultAbsRect = cv
      ? {
          x: cv.x + cv.w * 0.33,
          y: cv.y + cv.h * 0.33,
          w: cv.w * 0.34,
          h: cv.h * 0.34,
        }
      : { x: 4500, y: 6500, w: 800, h: 300 };

    let initialAbsRect = defaultAbsRect;

    if (
      ann &&
      ann.placement &&
      Number.isFinite(ann.placement.x) &&
      Number.isFinite(ann.placement.y) &&
      Number.isFinite(ann.placement.w) &&
      Number.isFinite(ann.placement.h)
    ) {
      const isAbs =
        ann.placement.x > 1 || ann.placement.y > 1 || ann.placement.w > 1 || ann.placement.h > 1;
      if (isAbs) {
        initialAbsRect = ann.placement;
      } else if (cv) {
        initialAbsRect = {
          x: cv.x + cv.w * ann.placement.x,
          y: cv.y + cv.h * ann.placement.y,
          w: cv.w * ann.placement.w,
          h: cv.h * ann.placement.h,
        };
      }
    }
    editingCanvasRect = initialAbsRect;
  } else if (currentMode !== 'annotationPositioning' && lastMode === 'annotationPositioning') {
    lastMode = currentMode;
    editingCanvasRect = null;
    placementRectValue = null;
  }

  $: if (
    currentMode === 'annotationPositioning' &&
    editingCanvasRect &&
    currentViewBox &&
    overlayWidth > 0 &&
    overlayHeight > 0
  ) {
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

{#if surface === 'inspector'}
  <div
    class="story-builder-inspector-root"
    data-testid="story-builder-inspector"
  >
    {#if chapterId}
      <StoryChapterOverlay
        {story}
        open={chapterOpen}
        docked={true}
        {chapterId}
        {activeChapterTask}
        validationErrors={$validationErrors}
        currentManifest={manifestValue}
        {mediaType}
        {mediaMarks}
        {avMarksValid}
        transitionDelayDefaultMs={$transitionDelayDefault}
        language={overlayAnnotationLanguage}
        {languages}
        onClose={onCloseChapter}
        {onSetNarrationTrack}
        {onAssignSegment}
        {onSkipNarration}
        {onSetMediaMarks}
        {onPreviewMediaSegment}
        {onStopPreviewMediaSegment}
        onUpdateManifest={(chapterId, manifest) => onUpdateManifest(manifest)}
        {onLoadManifest}
        onCreateChapter={onAddChapter}
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
        onSetChapterPosition={(chapterId, viewBox) => onSetChapterPosition(viewBox)}
        {storyPreviewing}
        onPreviewChapter={(chapterId) => onPreviewChapter(chapterId)}
        {onStopChapterPreview}
        onRevertChapterPosition={() => onRevertChapterPosition()}
        onSave={onSaveChapterSettings}
        onCancel={onCancelChapterSettings}
        {onSetAnnotationLanguage}
        layers={$layers}
        layerOpacities={$layerOpacities}
        {onUpdateLayerOpacity}
        {onChapterTaskChange}
      />
    {:else}
      <div class="story-builder-inspector-empty">
        <strong>{$t('storyBuilder.overlay.noChapter')}</strong>
        <span>{$t('storyBuilder.overlay.noChapterHint')}</span>
      </div>
    {/if}
  </div>
{:else}
  <div
    bind:this={overlayRoot}
    class="story-builder-overlay-root"
    bind:clientWidth={overlayWidth}
    bind:clientHeight={overlayHeight}
  >
    {#if currentMode !== 'annotationPositioning'}
      <StoryAnnotationOverlay
        {story}
        {viewBox}
        {chapterId}
        language={overlayAnnotationLanguage}
        showDrawings={$activeChapterTask !== 'focus'}
        editable={$activeChapterTask === 'focus'}
        onEditText={(lang) => onStartAnnotationPositioning(lang)}
      />
    {/if}

    {#if chapterId && $activeChapterTask === 'motion' && !$motionPreviewing && currentMode !== 'annotationPositioning' && currentMode !== 'narrationPanel' && motionMarkers.length > 0}
      <div class="story-builder-motion-markers" aria-label={$t('storyBuilder.motion.cameraPoints')}>
        {#each motionMarkers as marker (marker.id)}
          <button
            class="story-builder-motion-marker"
            class:story-builder-motion-marker--selected={$selectedMotionPointId === marker.id}
            class:story-builder-motion-marker--dragging={motionDrag?.id === marker.id &&
              motionDrag.moved}
            type="button"
            style={`--motion-x:${markerX(marker) * 100}%;--motion-y:${markerY(marker) * 100}%;--motion-offset-x:${motionDrag?.id === marker.id && motionDrag.moved ? 0 : marker.offsetX}px;--motion-offset-y:${motionDrag?.id === marker.id && motionDrag.moved ? 0 : marker.offsetY}px`}
            aria-label={$t('storyBuilder.motion.goToPoint', {
              number: marker.index + 1,
            })}
            aria-pressed={$selectedMotionPointId === marker.id}
            title={$t('storyBuilder.motion.movePointTitle', {
              number: marker.index + 1,
              seconds: (marker.timeMs / 1000).toFixed(1),
            })}
            on:pointerdown={(event) => handleMotionPointerDown(event, marker)}
            on:pointermove={handleMotionPointerMove}
            on:pointerup={(event) => finishMotionDrag(event, true)}
            on:pointercancel={(event) => finishMotionDrag(event, false)}
            on:click={(event) => handleMotionClick(event, marker.id)}
          >
            <MapPin aria-hidden="true" />
            <span>{marker.index + 1}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if narrationOpen}
      <StoryNarrationOverlay
        {story}
        open={true}
        docked={false}
        {language}
        {languages}
        showSourceSetup={$story.chapters.length === 0}
        currentManifest={manifestValue}
        onClose={onCloseNarration}
        {onSetNarrationTrack}
        {onUpdateStoryTitle}
        {onUpdateStoryIdentifiers}
        {onLoadSource}
      />
    {/if}

    <SaveExportModal open={exportModalOpen} payload={exportPayload} onclose={onCloseSaveModal} />

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
            {$t('storyBuilder.chapters.cancel')}
          </button>
          <button
            class="story-builder-positioning-button story-builder-positioning-button--confirm"
            type="button"
            on:click={handleConfirm}
          >
            {$t('storyBuilder.overlay.confirmPosition')}
          </button>
        </div>
      </div>
    {/if}

  </div>
{/if}

<style>
  .story-builder-overlay-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
    /* Above the artwork, below the floating sidebars and authoring footer. */
    z-index: 3;
  }

  .story-builder-inspector-root {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--viewer-panel, #121922);
    color: var(--viewer-text, #e8edf4);
  }

  .story-builder-motion-markers {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 45;
  }

  .story-builder-motion-marker {
    position: absolute;
    left: var(--motion-x);
    top: var(--motion-y);
    width: 38px;
    height: 44px;
    display: grid;
    place-items: center;
    transform: translate(calc(-50% + var(--motion-offset-x)), calc(-88% + var(--motion-offset-y)));
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: white;
    filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.72));
    font-size: 11px;
    font-weight: 800;
    cursor: grab;
    pointer-events: auto;
    touch-action: none;
  }

  .story-builder-motion-marker :global(svg) {
    position: absolute;
    inset: 0;
    width: 38px;
    height: 44px;
    fill: var(--accent, var(--story-builder-accent, #e07a3f));
    stroke: white;
    stroke-width: 1.8;
  }

  .story-builder-motion-marker span {
    position: relative;
    z-index: 1;
    margin-top: -7px;
  }

  .story-builder-motion-marker:hover,
  .story-builder-motion-marker:focus-visible,
  .story-builder-motion-marker--selected {
    transform: translate(calc(-50% + var(--motion-offset-x)), calc(-88% + var(--motion-offset-y)))
      scale(1.14);
    outline: 2px solid color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 45%, white);
    outline-offset: 2px;
  }

  .story-builder-motion-marker--dragging {
    cursor: grabbing;
  }

  .story-builder-inspector-empty {
    display: grid;
    gap: 8px;
    align-content: center;
    min-height: 220px;
    padding: 28px;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 13px;
    line-height: 1.5;
  }

  .story-builder-inspector-empty strong {
    color: var(--viewer-text, #e8edf4);
    font-size: 16px;
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
    background: color-mix(in srgb, var(--viewer-panel-strong, #1b242e) 95%, transparent);
    border: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 10%, transparent);
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
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 15%, transparent);
    color: var(--viewer-text, #eef3f8);
  }

  .story-builder-positioning-button--cancel:hover {
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 25%, transparent);
  }

  .story-builder-positioning-button--confirm {
    background: var(--accent, var(--story-builder-accent, #e07a3f));
    color: var(--viewer-text, #fffaf6);
  }

  .story-builder-positioning-button--confirm:hover {
    background: var(--accent-hover, #ef8f56);
    box-shadow: 0 0 12px color-mix(in srgb, var(--story-builder-accent, #e07a3f) 40%, transparent);
  }

</style>
