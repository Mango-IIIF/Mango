<script lang="ts">
  import { Check, Crosshair, Eye, EyeOff, Play, Plus, Shapes, Square, Trash2 } from "@lucide/svelte";
  import { readable, type Readable } from "svelte/store";
  import {
    type ChapterAnnotationTool,
    type ChapterCameraTrack,
    type ChapterDrawingAnnotation,
    type StoryState,
  } from "../../core/types/story";
  import {
    ANNOTATION_TOOLS,
    annotationToolLabelKey,
  } from "../../features/annotations/annotationTools";
  import type { MediaSource, MediaType } from "../../iiif/mediaResolver";
  import type { MediaMarksState } from "../mediaMarks";
  import type { ChapterTaskId } from "../chapterTasks";
  import StoryBuilderWideNarration from "./StoryBuilderWideNarration.svelte";
  import StoryBuilderWideMediaTiming from "./StoryBuilderWideMediaTiming.svelte";
  import ChapterMotionPanel from "./ChapterMotionPanel.svelte";
  import StoryBuilderWideAnnotations from "./StoryBuilderWideAnnotations.svelte";
  import StoryBuilderWideAnnotationOptions from "./StoryBuilderWideAnnotationOptions.svelte";
  import { t } from '../../core/i18n';
  import { animatableCameraDurationMs, balanceCameraTrackKeyframes } from '../cameraTrack';

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let activeTask: Readable<ChapterTaskId | null>;
  export let mediaType: Readable<MediaType | null>;
  export let mediaSources: Readable<MediaSource[]>;
  export let mediaMarks: Readable<MediaMarksState>;
  export let avMarksValid: Readable<boolean>;
  export let language = "en";
  export let languages: string[] = ["en"];
  export let onSetNarrationTrack: (language: string, src: string) => void;
  export let onAssignNarrationSegment: (
    language: string,
    start: number,
    end: number,
  ) => void;
  export let onSkipNarration: (language: string) => void = () => {};
  export let onAssignMediaSegment: (start: number, end: number) => void;
  export let onPreviewMediaSegment: () => void;
  export let onStopPreviewMediaSegment: () => void;
  export let onAddPoint: () => void;
  export let onDeletePoint: (keyframeId: string) => void = () => {};
  export let onGoToPoint: (keyframeId: string) => void;
  export let onUpdatePointFromView: (keyframeId: string) => void = () => {};
  export let motionPreviewing: Readable<boolean> = readable(false);
  export let motionPreviewPinsVisible: Readable<boolean> = readable(false);
  export let onSetMotionPreviewPinsVisible: (visible: boolean) => void = () => {};
  export let onUpdateMotionDuration: (durationMs: number) => void = () => {};
  export let onUpdateMotionPathType: (pathType: "linear" | "spline") => void = () => {};
  export let onUpdateMotionInitialDwell: (dwellMs: number) => void = () => {};
  export let onUpdateMotionEasing: (
    easing: "linear" | "ease-in" | "ease-out" | "ease-in-out",
  ) => void = () => {};
  export let onApplyMotionPreset: (
    preset: NonNullable<ChapterCameraTrack["preset"]>,
  ) => void = () => {};
  export let onPreviewMotion: () => void = () => {};
  export let onStopMotionPreview: () => void = () => {};
  export let annotationTool: Readable<ChapterAnnotationTool> = readable("select");
  export let selectedAnnotationId: Readable<string | null> = readable(null);
  export let onSetAnnotationTool: (tool: ChapterAnnotationTool) => void = () => {};
  export let onSetAnnotationLabel: (
    annotationId: string,
    language: string,
    value: string,
  ) => void = () => {};
  export let onSetAnnotationStyle: (
    annotationId: string,
    style: {
      color?: string | null;
      strokeWidth?: "thin" | "medium" | "thick";
      fillMode?: ChapterDrawingAnnotation["fillMode"];
      motivation?: ChapterDrawingAnnotation["motivation"] | null;
    },
  ) => void = () => {};
  export let onDeleteAnnotation: (annotationId: string) => void = () => {};
  export let onEditAnnotation: (annotationId: string) => void = () => {};
  export let onFinishAnnotationEdit: () => void = () => {};
  /** The point whose frame currently carries the handles on the stage. */
  export let selectedPointId: Readable<string | null> = readable(null);
  /**
   * Closes the open tool, keeping its edits. The panel floats over the stage,
   * so it has to carry its own way out — the inspector's Done may be in
   * another group, scrolled away, or collapsed with the panel.
   */
  export let onDone: (() => void) | undefined = undefined;

  let motionTab: "pins" | "options" = "pins";

  $: chapter =
    $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: selectedAnnotation =
    chapter?.drawingAnnotations?.find(
      (annotation) => annotation.id === $selectedAnnotationId,
    ) ?? null;
  $: track = chapter?.cameraTrack;
  $: movementDurationMs = Math.max(
    1,
    track?.durationMs ?? chapter?.presentationDurationMs ?? 5000,
  );
  $: timelineDurationMs = track
    ? Math.max(1, animatableCameraDurationMs(track))
    : movementDurationMs;
  $: points = track ? balanceCameraTrackKeyframes(track) : [];
  $: selectedPointIndex = points.findIndex((point) => point.id === $selectedPointId);
  $: mediaTimingIsVideo =
    $mediaType === "video" || $mediaSources.some((entry) => entry.type === "video");

  const pointPosition = (
    point: ChapterCameraTrack["keyframes"][number],
  ): string =>
    `${Math.max(0, Math.min(100, (point.timeMs / timelineDurationMs) * 100))}%`;

  const formatTime = (timeMs: number): string => {
    const seconds = timeMs / 1000;
    return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
  };

  const formatPointZoom = (
    point: ChapterCameraTrack["keyframes"][number],
  ): string | null => {
    if (!chapter?.viewBox || !point.viewBox || point.viewBox.w <= 0) return null;
    const zoom = chapter.viewBox.w / point.viewBox.w;
    return $t('storyBuilder.motion.zoomValue', { zoom: zoom.toFixed(2) });
  };

  const editAnnotation = (annotationId: string) => {
    onEditAnnotation(annotationId);
  };
</script>

{#if chapter && ($activeTask === "position" || $activeTask === "motion")}
  <!-- Direct-manipulation tools keep their primary controls on the stage. -->
  <div class="story-wide-actions" class:story-wide-actions--previewing={$motionPreviewing}>
    {#if $activeTask === "motion"}
      {#if $motionPreviewing}
        <button
          class="story-wide-action story-wide-action--secondary"
          type="button"
          data-testid="motion-preview-pins-toggle"
          aria-pressed={$motionPreviewPinsVisible}
          title={$motionPreviewPinsVisible
            ? $t('storyBuilder.motion.hidePreviewPins')
            : $t('storyBuilder.motion.showPreviewPins')}
          on:click={() => onSetMotionPreviewPinsVisible(!$motionPreviewPinsVisible)}
        >
          {#if $motionPreviewPinsVisible}<EyeOff aria-hidden="true" /> {$t('storyBuilder.motion.hidePreviewPins')}{:else}<Eye aria-hidden="true" /> {$t('storyBuilder.motion.showPreviewPins')}{/if}
        </button>
      {/if}
      <button
        class="story-wide-action story-wide-action--secondary"
        type="button"
        data-testid="motion-preview-next-to-done"
        disabled={points.length < 2}
        on:click={() => ($motionPreviewing ? onStopMotionPreview() : onPreviewMotion())}
      >
        {#if $motionPreviewing}<Square aria-hidden="true" /> {$t('storyBuilder.motion.stopPreview')}{:else}<Play aria-hidden="true" /> {$t('storyBuilder.motion.preview')}{/if}
      </button>
    {/if}
    <button
      class="story-wide-action story-wide-done"
      type="button"
      data-testid="story-wide-done"
      aria-label={$t('storyBuilder.inspector.done')}
      title={$t('storyBuilder.inspector.done')}
      on:click={() => {
        if ($motionPreviewing) onStopMotionPreview();
        onDone?.();
      }}
    >
      <Check aria-hidden="true" />
      <span>{$t('storyBuilder.inspector.done')}</span>
    </button>
  </div>
{/if}

{#if chapter && $activeTask === "motion" && !$motionPreviewing}
  <section
    class="story-wide-authoring"
    aria-label={$t('storyBuilder.motion.title')}
  >
    <div class="story-wide-authoring__tabs" role="tablist" aria-label={$t('storyBuilder.motion.title')}>
      <button
        id="motion-pins-tab"
        type="button"
        role="tab"
        aria-selected={motionTab === "pins"}
        aria-controls="motion-pins-panel"
        class:story-wide-authoring__tab--active={motionTab === "pins"}
        on:click={() => (motionTab = "pins")}
      >
        {$t('storyBuilder.motion.pinsTab')}
      </button>
      <button
        id="motion-options-tab"
        type="button"
        role="tab"
        aria-selected={motionTab === "options"}
        aria-controls="motion-options-panel"
        class:story-wide-authoring__tab--active={motionTab === "options"}
        on:click={() => (motionTab = "options")}
      >
        {$t('storyBuilder.motion.optionsTab')}
      </button>
    </div>

    {#if motionTab === "pins"}
      <div
        id="motion-pins-panel"
        class="story-wide-authoring__timeline"
        role="tabpanel"
        aria-labelledby="motion-pins-tab"
      >
        <div class="story-wide-authoring__scale" aria-hidden="true">
          {#each [0, 0.25, 0.5, 0.75, 1] as ratio}
            <span style={`left:${ratio * 100}%`}
              >{formatTime(timelineDurationMs * ratio)}</span
            >
          {/each}
        </div>

        <div class="story-wide-authoring__rail">
          {#each points as point, index (point.id)}
            <div
              class="story-wide-authoring__point-item"
              class:story-wide-authoring__point-item--selected={$selectedPointId === point.id}
              style={`--point-position:${pointPosition(point)}`}
            >
              <button
                class="story-wide-authoring__point"
                type="button"
                aria-label={$t('storyBuilder.motion.goToPoint', { number: index + 1 })}
                aria-pressed={$selectedPointId === point.id}
                on:click={() => onGoToPoint(point.id)}
              >
                <span class="story-wide-authoring__pin" aria-hidden="true">
                  <b>{index + 1}</b>
                </span>
                <span class="story-wide-authoring__point-label">
                  <strong>{$t('storyBuilder.motion.point', { number: index + 1 })}</strong>
                  <small>
                    {formatTime(point.timeMs)}
                    {#if formatPointZoom(point)} · {formatPointZoom(point)}{/if}
                  </small>
                </span>
              </button>
            </div>
          {/each}
        </div>

        {#if points.length === 0}
          <p class="story-wide-authoring__empty">
            {$t('storyBuilder.motion.emptyPoints')}
          </p>
        {/if}

        <div class="story-wide-authoring__capture-guide">
          <strong>{$t('storyBuilder.motion.captureGuideTitle')}</strong>
          <span>{$t('storyBuilder.motion.captureGuideHint')}</span>
        </div>

        <div class="story-wide-authoring__actions">
          <button
            class="story-wide-authoring__action"
            type="button"
            on:click={onAddPoint}
          >
            <Plus aria-hidden="true" /> {$t('storyBuilder.motion.addPoint')}
          </button>
          <button
            class="story-wide-authoring__action story-wide-authoring__action--update"
            data-testid="motion-save-zoom"
            type="button"
            disabled={!$selectedPointId}
            title={$selectedPointId
              ? $t('storyBuilder.motion.saveZoomForPoint', {
                  number: selectedPointIndex + 1,
                })
              : $t('storyBuilder.motion.selectPointToUpdate')}
            on:click={() =>
              $selectedPointId && onUpdatePointFromView($selectedPointId)}
          >
            <Crosshair aria-hidden="true" />
            {$selectedPointId
              ? $t('storyBuilder.motion.saveZoomForPoint', {
                  number: selectedPointIndex + 1,
                })
              : $t('storyBuilder.motion.saveZoom')}
          </button>
        </div>

        {#if selectedPointIndex >= 0}
          <button
            class="story-wide-authoring__delete-selected"
            type="button"
            data-testid="motion-delete-selected"
            on:click={() => onDeletePoint(points[selectedPointIndex].id)}
          >
            <Trash2 aria-hidden="true" />
            {$t('storyBuilder.motion.deletePointNumber', {
              number: selectedPointIndex + 1,
            })}
          </button>
        {/if}
      </div>
    {:else}
      <div
        id="motion-options-panel"
        class="story-wide-authoring__options"
        role="tabpanel"
        aria-labelledby="motion-options-tab"
      >
        <ChapterMotionPanel
          {track}
          wide
          onUpdateDuration={onUpdateMotionDuration}
          onUpdatePathType={onUpdateMotionPathType}
          onUpdateDwell={onUpdateMotionInitialDwell}
          onUpdateEasing={onUpdateMotionEasing}
          onApplyPreset={onApplyMotionPreset}
        />
      </div>
    {/if}
  </section>
{:else if chapter && $activeTask === "focus" && $annotationTool !== "select"}
  <div class="story-wide-authoring--annotation-placing" aria-hidden="true"></div>
{:else if chapter && $activeTask === "focus"}
  <section
    class="story-wide-authoring story-wide-authoring--annotations"
    aria-label={$t("storyBuilder.annotations.chapter")}
  >
    {#if selectedAnnotation}
      <div class="story-wide-authoring__annotation-top">
        <div class="story-wide-authoring__annotation-context">
          <Shapes aria-hidden="true" />
          <strong>{$t("storyBuilder.annotations.edit")}</strong>
          <span>{$t(`viewer.panels.annotations.editor.tools.${selectedAnnotation.type}`)}</span>
        </div>
        <button
          class="story-wide-authoring__annotation-done"
          type="button"
          data-testid="annotation-edit-done"
          on:click={onFinishAnnotationEdit}
        >
          <Check aria-hidden="true" />
          <span>{$t("storyBuilder.inspector.done")}</span>
        </button>
      </div>
      <div
        id="annotation-options-panel"
        class="story-wide-authoring__options"
      >
        <StoryBuilderWideAnnotationOptions
          {story}
          {selectedChapterId}
          selectedAnnotationId={selectedAnnotationId}
          {language}
          {languages}
          onSetLabel={onSetAnnotationLabel}
          onSetStyle={onSetAnnotationStyle}
        />
      </div>
    {:else}
      <div
        id="annotation-list-panel"
        class="story-wide-authoring__annotation-list"
      >
        <div class="story-wide-authoring__annotation-intro">
          <strong>{$t("storyBuilder.annotations.add")}</strong>
          <span>{$t("storyBuilder.annotations.drawingHint")}</span>
        </div>
        <div class="story-wide-authoring__annotation-tools">
          <div role="group" aria-label={$t("storyBuilder.annotations.tools")}>
            {#each ANNOTATION_TOOLS as tool}
              <button
                class="story-wide-authoring__annotation-tool"
                type="button"
                aria-pressed={$annotationTool === tool.id}
                class:story-wide-authoring__annotation-tool--active={$annotationTool === tool.id}
                on:click={() => onSetAnnotationTool(tool.id)}
              >
                <svelte:component this={tool.icon} aria-hidden="true" />
                <span>{$t(annotationToolLabelKey(tool.id))}</span>
              </button>
            {/each}
          </div>
          <button
            class="story-wide-authoring__annotation-done"
            type="button"
            data-testid="story-wide-done"
            on:click={() => onDone?.()}
          >
            <Check aria-hidden="true" />
            <span>{$t("storyBuilder.inspector.done")}</span>
          </button>
        </div>
        <StoryBuilderWideAnnotations
          {story}
          {selectedChapterId}
          selectedAnnotationId={selectedAnnotationId}
          {language}
          onDeleteDrawing={onDeleteAnnotation}
          onEditDrawing={editAnnotation}
        />
      </div>
    {/if}
  </section>
{:else if chapter && $activeTask === "audio-timing"}
  <div class="story-wide-modal">
    <button
      class="story-wide-modal__scrim"
      type="button"
      tabindex="-1"
      aria-label={$t('storyBuilder.inspector.done')}
      on:click={() => onDone?.()}
    ></button>
    <div
      class="story-wide-modal__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-wide-audio-title"
    >
      <header class="story-wide-modal__header">
        <strong id="story-wide-audio-title">{$t('storyBuilder.narration.title')}</strong>
        <button
          class="story-wide-modal__done"
          type="button"
          on:click={() => onDone?.()}
        >
          <Check aria-hidden="true" />
          <span>{$t('storyBuilder.inspector.done')}</span>
        </button>
      </header>
      <div class="story-wide-modal__body">
        <StoryBuilderWideNarration
          {story}
          {selectedChapterId}
          {language}
          {languages}
          {onSetNarrationTrack}
          {onAssignNarrationSegment}
          {onSkipNarration}
        />
      </div>
    </div>
  </div>
{:else if chapter && $activeTask === "media-timing"}
  <div
    class="story-wide-modal story-wide-modal--media"
    class:story-wide-modal--video={mediaTimingIsVideo}
  >
    <button
      class="story-wide-modal__scrim"
      type="button"
      tabindex="-1"
      aria-label={$t('storyBuilder.inspector.done')}
      on:click={() => onDone?.()}
    ></button>
    <div
      class="story-wide-modal__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-wide-media-title"
    >
      <header class="story-wide-modal__header">
        <strong id="story-wide-media-title">{$t('storyBuilder.media.segment')}</strong>
        <button
          class="story-wide-modal__done"
          type="button"
          on:click={() => onDone?.()}
        >
          <Check aria-hidden="true" />
          <span>{$t('storyBuilder.inspector.done')}</span>
        </button>
      </header>
      <div class="story-wide-modal__body">
        <StoryBuilderWideMediaTiming
          {story}
          {selectedChapterId}
          {mediaType}
          {mediaSources}
          {mediaMarks}
          marksValid={avMarksValid}
          {onAssignMediaSegment}
          onPreview={onPreviewMediaSegment}
          onStopPreview={onStopPreviewMediaSegment}
        />
      </div>
    </div>
  </div>
{:else if chapter && $activeTask === "position"}
  <!-- Direct manipulation lives on the stage; its footer is just the way out. -->
  <div class="story-wide-authoring--bare" aria-hidden="true"></div>
{:else if chapter && $activeTask === "motion" && $motionPreviewing}
  <div class="story-wide-preview-controls" aria-hidden="true"></div>
{:else}
  <div class="story-wide-authoring--empty" aria-hidden="true"></div>
{/if}

<style>

  :global(.stage__bottom:has(.story-wide-authoring--empty)) {
    display: none;
  }
  :global(.stage--story-builder:has(#motion-options-panel) .story-builder-motion-markers) {
    visibility: hidden;
  }
  :global(.stage--story-builder .stage__bottom:has(.story-wide-authoring)) {
    z-index: 50;
  }
  :global(.stage--story-builder .stage__bottom:has(.story-wide-modal)) {
    inset: 0;
    width: 100%;
    max-block-size: none;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: inherit;
    background: transparent;
    box-shadow: none;
  }
  :global(.stage__bottom:has(.story-wide-done)) {
    position: relative;
  }
  :global(.stage__bottom:has(.story-wide-authoring--bare)) {
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  :global(.stage__bottom:has(.story-wide-authoring--bare) .plugin-panel__panel) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-authoring--bare) .plugin-panel__title) {
    display: none;
  }
  :global(.stage__bottom:has(.story-wide-preview-controls) .plugin-slot),
  :global(.stage__bottom:has(.story-wide-preview-controls) .plugin-panel),
  :global(.stage__bottom:has(.story-wide-preview-controls) .plugin-panel__panel),
  :global(.stage__bottom:has(.story-wide-preview-controls) .plugin-panel__body) {
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  :global(.stage__bottom:has(.story-wide-preview-controls) .plugin-panel__panel) {
    gap: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-preview-controls) .plugin-panel__title) {
    display: none;
  }
  .story-wide-actions {
    position: absolute;
    z-index: 2;
    inset-block-start: 10px;
    inset-inline-end: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .story-wide-actions--previewing {
    inset-block-start: 6px;
    inset-inline-end: 6px;
    gap: 8px;
  }
  .story-wide-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 11px 6px 9px;
    border: 1px solid color-mix(in srgb, var(--story-builder-accent, #e07a3f) 60%, transparent);
    border-radius: 9px;
    background: var(--story-builder-accent, #e07a3f);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  }
  .story-wide-actions--previewing .story-wide-action {
    padding: 0 12px;
  }
  .story-wide-action--secondary {
    background: color-mix(in srgb, var(--story-builder-surface, #111827) 92%, transparent);
    color: var(--story-builder-text, #f8fafc);
  }
  .story-wide-action:hover:not(:disabled) {
    background: var(--story-builder-accent-hover, #ff9d5c);
  }
  .story-wide-action:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .story-wide-action :global(svg) {
    width: 13px;
    height: 13px;
  }
  .story-wide-preview-controls {
    width: 100%;
    height: 36px;
    pointer-events: none;
  }
  .story-wide-modal {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    padding: clamp(10px, 3cqw, 28px);
    box-sizing: border-box;
  }
  .story-wide-modal__scrim {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: inherit;
    background: rgba(3, 7, 12, 0.68);
    backdrop-filter: blur(5px);
    cursor: default;
  }
  .story-wide-modal__panel {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(960px, 100%);
    max-height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    border-radius: 18px;
    background: var(--viewer-panel, #121922);
    color: var(--viewer-text, #e8edf4);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.48);
  }
  .story-wide-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .story-wide-modal__header > strong {
    font-size: 14px;
  }
  .story-wide-modal__done {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 11px 7px 9px;
    border: 1px solid color-mix(in srgb, var(--story-builder-accent, #e07a3f) 60%, transparent);
    border-radius: 9px;
    background: var(--story-builder-accent, #e07a3f);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .story-wide-modal__done:hover {
    background: var(--story-builder-accent-hover, #ff9d5c);
  }
  .story-wide-modal__done :global(svg) {
    width: 13px;
    height: 13px;
  }
  .story-wide-modal__body {
    min-width: 0;
    min-height: 0;
    padding: 14px;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .story-wide-modal__body :global(.story-wide-narration),
  .story-wide-modal__body :global(.story-wide-media) {
    min-height: 0;
    max-height: none;
    overflow: visible;
    resize: none;
  }
  .story-wide-modal--video .story-wide-modal__scrim {
    background: var(--viewer-stage-tail, #050a10);
    backdrop-filter: none;
  }
  .story-wide-modal--video .story-wide-modal__panel {
    width: min(1180px, 100%);
  }
  :global(.stage__bottom:has(.story-wide-authoring)) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-narration)) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-media)) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-annotations)) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-authoring) .plugin-slot),
  :global(.stage__bottom:has(.story-wide-authoring) .plugin-panel),
  :global(.stage__bottom:has(.story-wide-authoring) .plugin-panel__panel),
  :global(.stage__bottom:has(.story-wide-authoring) .plugin-panel__body) {
    min-width: 0;
    width: 100%;
  }
  :global(.stage__bottom:has(.story-wide-narration) .plugin-slot),
  :global(.stage__bottom:has(.story-wide-narration) .plugin-panel),
  :global(.stage__bottom:has(.story-wide-narration) .plugin-panel__panel),
  :global(.stage__bottom:has(.story-wide-narration) .plugin-panel__body) {
    min-width: 0;
    width: 100%;
  }
  :global(.stage__bottom:has(.story-wide-media) .plugin-slot),
  :global(.stage__bottom:has(.story-wide-media) .plugin-panel),
  :global(.stage__bottom:has(.story-wide-media) .plugin-panel__panel),
  :global(.stage__bottom:has(.story-wide-media) .plugin-panel__body) {
    min-width: 0;
    width: 100%;
  }
  :global(.stage__bottom:has(.story-wide-annotations) .plugin-slot),
  :global(.stage__bottom:has(.story-wide-annotations) .plugin-panel),
  :global(.stage__bottom:has(.story-wide-annotations) .plugin-panel__panel),
  :global(.stage__bottom:has(.story-wide-annotations) .plugin-panel__body) {
    min-width: 0;
    width: 100%;
  }
  :global(.stage__bottom:has(.story-wide-authoring) .plugin-panel__panel) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-narration) .plugin-panel__panel) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-media) .plugin-panel__panel) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-annotations) .plugin-panel__panel) {
    padding: 0;
    border: 0;
    background: transparent;
  }
  :global(.stage__bottom:has(.story-wide-authoring) .plugin-panel__title) {
    display: none;
  }
  :global(.stage__bottom:has(.story-wide-narration) .plugin-panel__title) {
    display: none;
  }
  :global(.stage__bottom:has(.story-wide-media) .plugin-panel__title) {
    display: none;
  }
  :global(.stage__bottom:has(.story-wide-annotations) .plugin-panel__title) {
    display: none;
  }

  .story-wide-authoring {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 12px 14px;
    box-sizing: border-box;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    background: color-mix(
      in srgb,
      var(--viewer-panel, #121922) 92%,
      transparent
    );
    color: var(--viewer-text, #e8edf4);
  }
  .story-wide-authoring__tabs {
    display: inline-flex;
    justify-self: start;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: color-mix(in srgb, var(--viewer-stage-tail, #050a10) 55%, transparent);
  }
  .story-wide-authoring__tabs button {
    min-width: 88px;
    padding: 6px 14px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .story-wide-authoring__tabs .story-wide-authoring__tab--active {
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 16%, transparent);
    color: var(--viewer-text, #e8edf4);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 65%, transparent);
  }
  .story-wide-authoring__options {
    min-width: 0;
    padding: 2px 10px 0;
  }
  .story-wide-authoring--annotations {
    gap: 8px;
    padding-block: 10px;
  }
  .story-wide-authoring__annotation-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-width: 0;
    padding: 0 10px;
  }
  .story-wide-authoring__annotation-context {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .story-wide-authoring__annotation-context :global(svg) {
    width: 16px;
    color: var(--accent, var(--story-builder-accent, #e07a3f));
  }
  .story-wide-authoring__annotation-context strong {
    font-size: 12px;
  }
  .story-wide-authoring__annotation-context span {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
  }
  .story-wide-authoring__annotation-list {
    display: grid;
    gap: 11px;
    min-width: 0;
    padding: 0 10px;
  }
  .story-wide-authoring__annotation-intro {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .story-wide-authoring__annotation-intro strong {
    font-size: 13px;
  }
  .story-wide-authoring__annotation-intro span {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
  }
  .story-wide-authoring__annotation-list :global(.story-wide-annotations) {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .story-wide-authoring__annotation-tools {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }
  .story-wide-authoring__annotation-tools > div {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
  }
  .story-wide-authoring__annotation-tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    padding: 8px 7px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }
  .story-wide-authoring__annotation-tool :global(svg) {
    width: 14px;
  }
  .story-wide-authoring__annotation-tools .story-wide-authoring__annotation-tool--active {
    border-color: var(--accent, var(--story-builder-accent, #e07a3f));
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 12%, transparent);
    color: var(--viewer-text, #e8edf4);
  }
  .story-wide-authoring__annotation-done {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 76px;
    padding: 8px 11px 8px 9px;
    border: 1px solid color-mix(in srgb, var(--story-builder-accent, #e07a3f) 60%, transparent);
    border-radius: 8px;
    background: var(--story-builder-accent, #e07a3f);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
  }
  .story-wide-authoring__annotation-done:hover {
    background: var(--story-builder-accent-hover, #ff9d5c);
  }
  .story-wide-authoring__annotation-done :global(svg) {
    width: 13px;
    height: 13px;
  }
  .story-wide-authoring__action :global(svg) {
    width: 14px;
    height: 14px;
  }
  .story-wide-authoring__timeline {
    position: relative;
    display: grid;
    grid-template-rows: 20px 68px auto auto;
    align-content: start;
    min-width: 0;
    padding: 0 10px;
  }
  .story-wide-authoring__scale {
    position: relative;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
  }
  .story-wide-authoring__scale span {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }
  .story-wide-authoring__scale span:first-child {
    transform: none;
  }
  .story-wide-authoring__scale span:last-child {
    transform: translateX(-100%);
  }
  .story-wide-authoring__rail {
    position: relative;
    height: 2px;
    margin-top: 14px;
    background: color-mix(
      in srgb,
      var(--accent, var(--story-builder-accent, #e07a3f)) 78%,
      var(--viewer-panel-border)
    );
  }
  .story-wide-authoring__rail::before,
  .story-wide-authoring__rail::after {
    content: "";
    position: absolute;
    top: -3px;
    width: 1px;
    height: 8px;
    background: var(--viewer-muted, #9aa6b2);
  }
  .story-wide-authoring__rail::before {
    left: 0;
  }
  .story-wide-authoring__rail::after {
    right: 0;
  }
  .story-wide-authoring__point-item {
    position: absolute;
    left: var(--point-position);
    top: 0;
    transform: translate(-50%, -14px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    width: 76px;
  }
  .story-wide-authoring__point-item:first-child {
    transform: translate(0, -14px);
  }
  .story-wide-authoring__point-item:last-child:not(:first-child) {
    transform: translate(-100%, -14px);
  }
  .story-wide-authoring__point {
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .story-wide-authoring__pin {
    position: relative;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin: 0 auto;
    border: 2px solid white;
    border-radius: 50% 50% 50% 0;
    background: var(--accent, var(--story-builder-accent, #e07a3f));
    box-sizing: border-box;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.65));
    transform: rotate(-45deg);
  }
  .story-wide-authoring__point:first-child .story-wide-authoring__pin {
    margin-left: 0;
  }
  .story-wide-authoring__point:last-child:not(:first-child)
    .story-wide-authoring__pin {
    margin-right: 0;
  }
  .story-wide-authoring__point-item--selected .story-wide-authoring__pin {
    border-color: var(--accent, var(--story-builder-accent, #e07a3f));
    background: white;
  }
  .story-wide-authoring__point-item--selected .story-wide-authoring__pin b {
    color: var(--accent, var(--story-builder-accent, #e07a3f));
  }
  .story-wide-authoring__pin b {
    position: relative;
    z-index: 1;
    color: white;
    font-size: 11px;
    line-height: 1;
    transform: rotate(45deg);
  }
  .story-wide-authoring__point-label {
    display: grid;
    margin-top: 3px;
    white-space: nowrap;
    font-size: 10px;
  }
  .story-wide-authoring__point-label small {
    color: var(--viewer-muted, #9aa6b2);
  }
  .story-wide-authoring__empty {
    align-self: center;
    margin: -28px 0 0;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    text-align: center;
  }
  .story-wide-authoring__actions {
    justify-self: center;
    align-self: end;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 7px;
  }
  .story-wide-authoring__capture-guide {
    justify-self: center;
    display: grid;
    gap: 2px;
    max-width: 720px;
    margin: 0 12px 7px;
    text-align: center;
  }
  .story-wide-authoring__capture-guide strong {
    font-size: 11px;
  }
  .story-wide-authoring__capture-guide span {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    line-height: 1.4;
  }
  .story-wide-authoring__delete-selected {
    position: absolute;
    right: 10px;
    bottom: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--viewer-danger, #ef4444) 45%, transparent);
    border-radius: 9px;
    background: color-mix(in srgb, var(--viewer-danger, #ef4444) 9%, transparent);
    color: var(--viewer-danger, #ffb8b8);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }
  .story-wide-authoring__delete-selected:hover {
    border-color: var(--viewer-danger, #ef4444);
    background: color-mix(in srgb, var(--viewer-danger, #ef4444) 16%, transparent);
  }
  .story-wide-authoring__delete-selected :global(svg) {
    width: 13px;
    height: 13px;
  }
  .story-wide-authoring__action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 9px;
    padding: 8px 12px;
    background: transparent;
    color: inherit;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .story-wide-authoring__action:disabled {
    opacity: 0.46;
    cursor: not-allowed;
  }
  .story-wide-authoring__action:not(:disabled):hover,
  .story-wide-authoring__point:hover .story-wide-authoring__point-label strong {
    color: var(--accent, var(--story-builder-accent, #e07a3f));
  }

  @media (max-width: 720px) {
    .story-wide-authoring {
      gap: 14px;
    }
    .story-wide-authoring__delete-selected {
      position: static;
      justify-self: end;
      margin-top: 4px;
    }
  }
</style>
