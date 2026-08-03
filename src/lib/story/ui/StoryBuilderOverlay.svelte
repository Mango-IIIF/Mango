<script lang="ts">
  import type { Readable, Writable } from 'svelte/store';
  import { readable } from 'svelte/store';
  import { MapPin } from '@lucide/svelte';
  import type { StoryState } from '../../core/types/story';
  import StoryNarrationOverlay from './NarrationOverlay.svelte';
  import StoryChapterOverlay from './ChapterOverlay.svelte';
  import StoryAnnotationOverlay from './StoryAnnotationOverlay.svelte';
  import FramingGuide from './FramingGuide.svelte';
  import { resolvePresentationAspect } from '../framing';
  import SaveExportModal from './SaveExportModal.svelte';
  import RectanglePlacementEditor from '../../features/annotations/RectanglePlacementEditor.svelte';
  import type {
    AnnotationPlacement,
    ChapterAdvance,
    ChapterAnnotationTool,
  } from '../../core/types/story';
  import type { ViewBox } from '../../core/types/viewer';
  import type { UIMode } from '../storyBuilderController';
  import type { MediaType, MediaSource } from '../../iiif/mediaResolver';
  import type { MediaMarksState } from '../mediaMarks';
  import type { ExportEnvelope } from '../storySerializer';
  import type { ChapterTaskId } from '../chapterTasks';
  import { t } from '../../i18n';

  export let story: Readable<StoryState>;
  export let surface: 'overlay' | 'inspector' = 'overlay';
  export let layers: Readable<MediaSource[]>;
  export let layerOpacities: Readable<Record<string, number>>;
  export let onUpdateLayerOpacity: (id: string, opacity: number) => void;
  export let currentManifest: Readable<string | null>;
  export let viewerCanvasIndex: Readable<number>;
  export let viewerCanvasCount: Readable<number>;
  export let viewBox: Readable<ViewBox | null>;
  export let selectedChapterId: Writable<string | null>;
  export let activeChapterTask: Readable<ChapterTaskId | null>;
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
  export let annotationTool: Readable<ChapterAnnotationTool>;
  export let selectedDrawingAnnotationId: Readable<string | null>;
  export let onSetAnnotationTool: (tool: ChapterAnnotationTool) => void;
  export let onSetDrawingAnnotationLabel: (annotationId: string, lang: string, value: string) => void;
  export let onSetDrawingAnnotationStyle: (
    annotationId: string,
    style: {
      color?: string | null;
      strokeWidth?: 'thin' | 'medium' | 'thick';
      fillMode?: 'transparent' | 'solid';
    },
  ) => void;
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
  export let onUpdateStoryTitle: (lang: string, value: string) => void;
  export let onUpdateStoryIdentifiers: (id: string, annotationBase: string) => void;
  export let onAssignSegment: (lang: string, start: number, end: number) => void;
  export let onSkipNarration: (lang: string) => void;
  export let onUpdateManifest: (manifest: string) => void;
  export let onReloadManifest: (manifest: string, canvasIndex: number) => void;
  export let onSelectCanvas: (canvasIndex: number) => void;
  export let onLoadManifest: (manifest: string) => void;
  export let onAddChapter: () => void;
  export let onUpdateChapterTitle: (lang: string, value: string) => void;
  export let onUpdateChapterDescription: (lang: string, value: string) => void;
  export let onUpdateAnnotationText: (lang: string, text: string) => void;
  export let onUpdateAnnotationPlacement: (lang: string, placement: AnnotationPlacement) => void;
  export let onUpdateAdvanceMode: (mode: ChapterAdvance['mode']) => void;
  export let onUpdateDelay: (delayMs?: number) => void;
  export let onUpdateChapterPosition: () => void;
  export let onSetChapterPosition: (viewBox: ViewBox) => void;
  export let storyPreviewing: Readable<boolean> = readable(false);
  export let onPreviewChapter: (chapterId?: string) => void = () => {};
  export let onStopChapterPreview: () => void = () => {};
  export let onRevertChapterPosition: () => void;
  export let onSaveChapterSettings: () => void;
  export let onUpdateMotionDuration: (durationMs: number) => void;
  export let onUpdateMotionPathType: (pathType: 'linear' | 'spline') => void;
  export let onUpdateMotionInitialDwell: (dwellMs: number) => void;
  export let onUpdateMotionEasing: (
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out',
  ) => void;
  export let motionPreviewing: Readable<boolean>;
  export let motionPointDraft: Readable<{
    keyframeId?: string;
    focus?: { x: number; y: number };
  } | null>;
  export let onApplyMotionPreset: (
    preset: NonNullable<NonNullable<StoryState['chapters'][number]['cameraTrack']>['preset']>,
  ) => void;
  export let onPreviewMotion: () => void;
  export let onStopMotionPreview: () => void;
  export let onStartMotionPointPositioning: (keyframeId?: string) => void;
  export let onConfirmMotionPointPositioning: (focus: { x: number; y: number }) => void;
  export let onCancelMotionPointPositioning: () => void;

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

  let motionPlacementFocus: { x: number; y: number } | null = null;
  let effectiveMotionPlacementFocus: { x: number; y: number } | null = null;
  let motionReferenceViewBox: ViewBox | null = null;
  let motionPlacementNumber = 1;
  let lastMotionPlacementKey = '';
  $: {
    const draft = $motionPointDraft;
    const key = draft
      ? `${currentMode}:${draft.keyframeId ?? 'new'}:${draft.focus?.x ?? 'none'}:${draft.focus?.y ?? 'none'}`
      : '';
    if (!draft) {
      lastMotionPlacementKey = '';
      motionPlacementFocus = null;
    } else if (key !== lastMotionPlacementKey) {
      lastMotionPlacementKey = key;
      motionPlacementFocus = draft.focus ?? null;
    }
  }
  $: if (
    currentMode === 'motionPointPositioning' &&
    $motionPointDraft &&
    !motionPlacementFocus &&
    currentViewBox
  ) {
    motionPlacementFocus = $motionPointDraft.focus ?? {
      x: currentViewBox.x + currentViewBox.w / 2,
      y: currentViewBox.y + currentViewBox.h / 2,
    };
  }
  $: motionReferenceViewBox =
    currentViewBox ?? $story.chapters.find((entry) => entry.id === chapterId)?.viewBox ?? null;
  $: effectiveMotionPlacementFocus =
    motionPlacementFocus ??
    $motionPointDraft?.focus ??
    (motionReferenceViewBox
      ? {
          x: motionReferenceViewBox.x + motionReferenceViewBox.w / 2,
          y: motionReferenceViewBox.y + motionReferenceViewBox.h / 2,
        }
      : null);
  $: motionPlacementPinStyle =
    effectiveMotionPlacementFocus && motionReferenceViewBox
      ? `left:${((effectiveMotionPlacementFocus.x - motionReferenceViewBox.x) / motionReferenceViewBox.w) * 100}%;top:${((effectiveMotionPlacementFocus.y - motionReferenceViewBox.y) / motionReferenceViewBox.h) * 100}%`
      : '';
  $: {
    const activeChapter = $story.chapters.find((entry) => entry.id === chapterId);
    const existingIndex = activeChapter?.cameraTrack?.keyframes.findIndex(
      (point) => point.id === $motionPointDraft?.keyframeId,
    );
    motionPlacementNumber =
      existingIndex !== undefined && existingIndex >= 0
        ? existingIndex + 1
        : (activeChapter?.cameraTrack?.keyframes.length ?? 0) + 1;
  }
  let motionPointDragging = false;
  let motionSurfaceElement: HTMLElement | null = null;
  const focusFromPointer = (event: MouseEvent | PointerEvent): { x: number; y: number } | null => {
    if (!motionReferenceViewBox) return null;
    const targetEl = motionSurfaceElement || (event.currentTarget as HTMLElement | null);
    const bounds = targetEl?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    const xRatio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const yRatio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    return {
      x: motionReferenceViewBox.x + xRatio * motionReferenceViewBox.w,
      y: motionReferenceViewBox.y + yRatio * motionReferenceViewBox.h,
    };
  };
  const handleMotionCanvasClick = (event: MouseEvent) => {
    motionPlacementFocus = focusFromPointer(event) ?? motionPlacementFocus;
  };
  const handleMotionPointerDown = (event: PointerEvent) => {
    motionPointDragging = true;
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    motionPlacementFocus = focusFromPointer(event) ?? motionPlacementFocus;
  };
  const handleMotionPointerMove = (event: PointerEvent) => {
    if (motionPointDragging) motionPlacementFocus = focusFromPointer(event) ?? motionPlacementFocus;
  };
  const handleMotionPointerUp = (event: PointerEvent) => {
    motionPlacementFocus = focusFromPointer(event) ?? motionPlacementFocus;
    motionPointDragging = false;
  };
</script>

{#if surface === 'inspector'}
  <div class="story-builder-inspector-root" data-testid="story-builder-inspector">
    {#if narrationOpen}
      <StoryNarrationOverlay
        {story}
        open={true}
        docked={true}
        {chapterId}
        {language}
        {languages}
        onBack={onBackNarration}
        onClose={onCloseNarration}
        {onSetNarrationTrack}
        {onUpdateStoryTitle}
        {onUpdateStoryIdentifiers}
        {onAssignSegment}
      />
    {:else if chapterId || currentMode === 'chapterEdit' || !manifestValue || $story.chapters.length === 0}
      <StoryChapterOverlay
        {story}
        open={chapterOpen}
        docked={true}
        {chapterId}
        {activeChapterTask}
        validationErrors={$validationErrors}
        currentManifest={manifestValue}
        {viewBox}
        canvasIndex={$viewerCanvasIndex}
        canvasCount={$viewerCanvasCount}
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
        {onSelectCanvas}
        onUpdateChapterTitle={(chapterId, lang, value) => onUpdateChapterTitle(lang, value)}
        onUpdateChapterDescription={(chapterId, lang, value) =>
          onUpdateChapterDescription(lang, value)}
        onUpdateAnnotationText={(chapterId, lang, text) => onUpdateAnnotationText(lang, text)}
        onUpdateAnnotationPlacement={(chapterId, lang, placement) =>
          onUpdateAnnotationPlacement(lang, placement)}
        onUpdateAdvanceMode={(chapterId, mode) => onUpdateAdvanceMode(mode)}
        onUpdateDelay={(chapterId, delayMs) => onUpdateDelay(delayMs)}
        onUpdateChapterPosition={() => onUpdateChapterPosition()}
        onSetChapterPosition={(chapterId, viewBox) => onSetChapterPosition(viewBox)}
        {storyPreviewing}
        onPreviewChapter={(chapterId) => onPreviewChapter(chapterId)}
        {onStopChapterPreview}
        onRevertChapterPosition={() => onRevertChapterPosition()}
        onSave={onSaveChapterSettings}
        {onSetAnnotationLanguage}
        {annotationTool}
        {selectedDrawingAnnotationId}
        {onSetAnnotationTool}
        {onSetDrawingAnnotationLabel}
        {onSetDrawingAnnotationStyle}
        onSetAnnotationPositioning={(lang) => onStartAnnotationPositioning(lang)}
        layers={$layers}
        layerOpacities={$layerOpacities}
        {onUpdateLayerOpacity}
        {onUpdateMotionDuration}
        {onUpdateMotionPathType}
        {onUpdateMotionInitialDwell}
        {onUpdateMotionEasing}
        motionPreviewing={$motionPreviewing}
        {onApplyMotionPreset}
        {onPreviewMotion}
        {onStopMotionPreview}
        {onStartMotionPointPositioning}
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
    class="story-builder-overlay-root"
    bind:clientWidth={overlayWidth}
    bind:clientHeight={overlayHeight}
  >
    <FramingGuide
      aspect={resolvePresentationAspect($story)}
      stageWidth={overlayWidth}
      stageHeight={overlayHeight}
    />

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

    <SaveExportModal open={exportModalOpen} payload={exportPayload} onclose={onCloseSaveModal} />

    {#if chapterId && $activeChapterTask === 'motion' && !$motionPreviewing && currentMode !== 'annotationPositioning' && currentMode !== 'motionPointPositioning' && currentMode !== 'narrationPanel' && motionMarkers.length > 0}
      <div class="story-builder-motion-markers" aria-label={$t('storyBuilder.motion.cameraPoints')}>
        {#each motionMarkers as marker (marker.id)}
          <button
            class="story-builder-motion-marker"
            type="button"
            style={`--motion-x:${marker.x * 100}%;--motion-y:${marker.y * 100}%;--motion-offset-x:${marker.offsetX}px;--motion-offset-y:${marker.offsetY}px`}
            aria-label={$t('storyBuilder.motion.movePointAt', { number: marker.index + 1, seconds: (marker.timeMs / 1000).toFixed(1) })}
            title={$t('storyBuilder.motion.movePointTitle', { number: marker.index + 1, seconds: (marker.timeMs / 1000).toFixed(1) })}
            on:click={() => onStartMotionPointPositioning(marker.id)}
          >
            <MapPin aria-hidden="true" />
            <span>{marker.index + 1}</span>
          </button>
        {/each}
      </div>
    {/if}

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

    {#if currentMode === 'motionPointPositioning' && $motionPointDraft}
      <button
        bind:this={motionSurfaceElement}
        class="story-builder-motion-point-surface"
        type="button"
        aria-label={$t('storyBuilder.motion.placePointHint')}
        on:click={handleMotionCanvasClick}
        on:pointerdown={handleMotionPointerDown}
        on:pointermove={handleMotionPointerMove}
        on:pointerup={handleMotionPointerUp}
      >
        {#if effectiveMotionPlacementFocus}
          <div
            class="story-builder-motion-placement-pin"
            class:story-builder-motion-placement-pin--dragging={motionPointDragging}
            style={motionPlacementPinStyle}
          >
            <div class="story-builder-motion-placement-target" aria-hidden="true"></div>
            <MapPin aria-hidden="true" />
            <span>{motionPlacementNumber}</span>
          </div>
        {/if}
      </button>
      <div class="story-builder-motion-placement" role="dialog" aria-label={$t('storyBuilder.motion.setPoint')}>
        <div class="story-builder-motion-placement__message">
          <strong>
            {$motionPointDraft.keyframeId
              ? $t('storyBuilder.motion.movePoint', { number: motionPlacementNumber })
              : $t('storyBuilder.motion.placePoint', { number: motionPlacementNumber })}
          </strong>
        </div>
        <div class="story-builder-motion-placement__actions">
          <button type="button" on:click={onCancelMotionPointPositioning}>{$t('storyBuilder.chapters.cancel')}</button>
          <button
            class="story-builder-motion-placement__confirm"
            type="button"
            disabled={!effectiveMotionPlacementFocus}
            on:click={() =>
              effectiveMotionPlacementFocus &&
              onConfirmMotionPointPositioning(effectiveMotionPlacementFocus)}>{$t('storyBuilder.motion.usePoint')}</button
          >
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
    z-index: 40;
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
    cursor: move;
    pointer-events: auto;
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
  .story-builder-motion-marker:focus-visible {
    transform: translate(calc(-50% + var(--motion-offset-x)), calc(-88% + var(--motion-offset-y)))
      scale(1.14);
    outline: 2px solid color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 45%, white);
    outline-offset: 2px;
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

  .story-builder-motion-placement {
    position: absolute;
    left: 50%;
    bottom: 16px;
    z-index: 102;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    width: auto;
    max-width: min(440px, calc(100% - 32px));
    padding: 6px 12px;
    transform: translateX(-50%);
    border: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 14%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--viewer-panel, #121922) 96%, transparent);
    color: var(--viewer-text, #e8edf4);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42);
    pointer-events: auto;
  }

  .story-builder-motion-point-surface {
    position: absolute;
    inset: 0;
    z-index: 100;
    cursor: crosshair;
    pointer-events: auto;
    border: 0;
    padding: 0;
    background: transparent;
  }

  .story-builder-motion-placement-pin {
    position: absolute;
    width: 42px;
    height: 50px;
    display: grid;
    place-items: center;
    transform: translate(-50%, -88%);
    color: white;
    filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.75));
    pointer-events: none;
    transition:
      filter 0.15s ease,
      transform 0.1s ease;
  }

  .story-builder-motion-placement-pin--dragging {
    filter: drop-shadow(0 8px 14px color-mix(in srgb, var(--story-builder-accent, #e07a3f) 85%, transparent));
    transform: translate(-50%, -96%) scale(1.08);
  }

  .story-builder-motion-placement-target {
    position: absolute;
    bottom: 4px;
    left: 50%;
    width: 14px;
    height: 14px;
    transform: translate(-50%, 50%);
    border: 2px solid white;
    border-radius: 50%;
    background: var(--accent, var(--story-builder-accent, #e07a3f));
    box-shadow:
      0 0 8px rgba(0, 0, 0, 0.6),
      inset 0 0 0 2px rgba(0, 0, 0, 0.3);
    pointer-events: none;
  }

  .story-builder-motion-placement-pin :global(svg) {
    position: absolute;
    inset: 0;
    width: 42px;
    height: 50px;
    fill: var(--accent, var(--story-builder-accent, #e07a3f));
    stroke: white;
    stroke-width: 1.8;
  }

  .story-builder-motion-placement-pin span {
    position: relative;
    z-index: 1;
    margin-top: -9px;
    font-size: 12px;
    font-weight: 850;
  }

  .story-builder-motion-placement__message {
    display: grid;
    gap: 3px;
    min-width: 0;
    margin-right: auto;
  }
  .story-builder-motion-placement__message strong {
    font-size: 13px;
  }
  .story-builder-motion-placement__actions {
    display: flex;
    gap: 7px;
    flex: 0 0 auto;
  }
  .story-builder-motion-placement__actions button {
    border: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 12%, transparent);
    border-radius: 9px;
    padding: 9px 11px;
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 8%, transparent);
    color: inherit;
    font-weight: 650;
    cursor: pointer;
  }
  .story-builder-motion-placement__actions .story-builder-motion-placement__confirm {
    border-color: transparent;
    background: var(--accent, var(--story-builder-accent, #e07a3f));
    color: white;
  }
  .story-builder-motion-placement__actions .story-builder-motion-placement__confirm:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 560px) {
    .story-builder-motion-placement {
      align-items: stretch;
      flex-direction: column;
      gap: 10px;
    }
    .story-builder-motion-placement__actions {
      justify-content: flex-end;
    }
  }
</style>
