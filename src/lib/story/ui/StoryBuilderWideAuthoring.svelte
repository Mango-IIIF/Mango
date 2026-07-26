<script lang="ts">
  import { MapPin, Plus, Play, Square } from "@lucide/svelte";
  import type { Readable } from "svelte/store";
  import type { ChapterCameraTrack, StoryState } from "../../core/types/story";
  import type { MediaSource, MediaType } from "../../iiif/mediaResolver";
  import type { MediaMarksState } from "../mediaMarks";
  import type { ChapterTaskId } from "../chapterTasks";
  import StoryBuilderWideNarration from "./StoryBuilderWideNarration.svelte";
  import StoryBuilderWideMediaTiming from "./StoryBuilderWideMediaTiming.svelte";
  import StoryBuilderWideAnnotations from "./StoryBuilderWideAnnotations.svelte";

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let activeTask: Readable<ChapterTaskId | null>;
  export let previewing: Readable<boolean>;
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
  export let onAssignMediaSegment: (start: number, end: number) => void;
  export let onPreviewMediaSegment: () => void;
  export let onStopPreviewMediaSegment: () => void;
  export let onDeleteDrawingAnnotation: (annotationId: string) => void;
  export let onDeleteTextAnnotation: (language: string) => void;
  export let onEditDrawingAnnotation: (annotationId: string) => void;
  export let onEditTextAnnotation: (language: string) => void;
  export let onAddPoint: () => void;
  export let onGoToPoint: (keyframeId: string) => void;
  export let onPreview: () => void;
  export let onStopPreview: () => void;

  $: chapter =
    $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: track = chapter?.cameraTrack;
  $: durationMs = Math.max(
    1,
    track?.durationMs ?? chapter?.presentationDurationMs ?? 5000,
  );
  $: durationSeconds = durationMs / 1000;
  $: points = [...(track?.keyframes ?? [])].sort((a, b) => a.timeMs - b.timeMs);

  const pointPosition = (
    point: ChapterCameraTrack["keyframes"][number],
  ): string =>
    `${Math.max(0, Math.min(100, (point.timeMs / durationMs) * 100))}%`;

  const formatTime = (timeMs: number): string => {
    const seconds = timeMs / 1000;
    return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
  };
</script>

{#if chapter && $activeTask === "motion"}
  <section
    class="story-wide-authoring"
    aria-labelledby="story-wide-motion-title"
  >
    <div class="story-wide-authoring__summary">
      <div class="story-wide-authoring__summary-title">
        <span class="story-wide-authoring__summary-icon"
          ><MapPin aria-hidden="true" /></span
        >
        <span>
          <strong id="story-wide-motion-title">Chapter motion</strong>
          <small
            >{durationSeconds.toFixed(
              durationSeconds % 1 === 0 ? 0 : 1,
            )}s</small
          >
        </span>
      </div>
      <p>
        Place camera points on the artwork. Their order is spaced across the
        chapter duration.
      </p>
      <button
        class="story-wide-authoring__preview"
        type="button"
        disabled={points.length < 2}
        on:click={() => ($previewing ? onStopPreview() : onPreview())}
      >
        {#if $previewing}<Square aria-hidden="true" /> Stop{:else}<Play
            aria-hidden="true"
          /> Preview{/if}
      </button>
    </div>

    <div class="story-wide-authoring__timeline">
      <div class="story-wide-authoring__scale" aria-hidden="true">
        {#each [0, 0.25, 0.5, 0.75, 1] as ratio}
          <span style={`left:${ratio * 100}%`}
            >{formatTime(durationMs * ratio)}</span
          >
        {/each}
      </div>

      <div class="story-wide-authoring__rail">
        {#each points as point, index (point.id)}
          <button
            class="story-wide-authoring__point"
            type="button"
            style={`--point-position:${pointPosition(point)}`}
            aria-label={`Go to camera point ${index + 1}`}
            on:click={() => onGoToPoint(point.id)}
          >
            <span class="story-wide-authoring__pin"
              ><MapPin aria-hidden="true" /><b>{index + 1}</b></span
            >
            <span class="story-wide-authoring__point-label">
              <strong>Point {index + 1}</strong>
              <small>{formatTime(point.timeMs)}</small>
            </span>
          </button>
        {/each}
      </div>

      {#if points.length === 0}
        <p class="story-wide-authoring__empty">
          No camera points yet. Add a point, then drag its pin into position in
          the viewer.
        </p>
      {/if}

      <button
        class="story-wide-authoring__add"
        type="button"
        on:click={onAddPoint}
      >
        <Plus aria-hidden="true" /> Add camera point
      </button>
    </div>
  </section>
{:else if chapter && $activeTask === "audio-timing"}
  <StoryBuilderWideNarration
    {story}
    {selectedChapterId}
    {language}
    {languages}
    {onSetNarrationTrack}
    {onAssignNarrationSegment}
  />
{:else if chapter && $activeTask === "media-timing"}
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
{:else if chapter && $activeTask === "focus"}
  <StoryBuilderWideAnnotations
    {story}
    {selectedChapterId}
    onDeleteDrawing={onDeleteDrawingAnnotation}
    onDeleteText={onDeleteTextAnnotation}
    onEditDrawing={onEditDrawingAnnotation}
    onEditText={onEditTextAnnotation}
  />
{:else}
  <div class="story-wide-authoring--empty" aria-hidden="true"></div>
{/if}

<style>
  :global(.stage__bottom:has(.story-wide-authoring--empty)) {
    display: none;
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
    min-height: 166px;
    padding: 18px;
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
  .story-wide-authoring__summary {
    display: grid;
    align-content: start;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid
      var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .story-wide-authoring__summary-title {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .story-wide-authoring__summary-title > span:last-child {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .story-wide-authoring__summary-title strong {
    font-size: 13px;
  }
  .story-wide-authoring__summary-title small {
    padding: 3px 6px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.07);
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
  }
  .story-wide-authoring__summary-icon {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: var(--accent, #e07a3f);
    background: color-mix(in srgb, var(--accent, #e07a3f) 14%, transparent);
  }
  .story-wide-authoring__summary-icon :global(svg) {
    width: 16px;
    height: 16px;
  }
  .story-wide-authoring__summary p {
    margin: 0;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    line-height: 1.45;
  }
  .story-wide-authoring__preview {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 7px 9px;
    background: transparent;
    color: inherit;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .story-wide-authoring__preview:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .story-wide-authoring__preview :global(svg),
  .story-wide-authoring__add :global(svg) {
    width: 14px;
    height: 14px;
  }
  .story-wide-authoring__timeline {
    position: relative;
    display: grid;
    grid-template-rows: 20px 68px auto;
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
      var(--accent, #e07a3f) 78%,
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
  .story-wide-authoring__point {
    position: absolute;
    left: var(--point-position);
    top: 0;
    width: 76px;
    padding: 0;
    transform: translate(-50%, -14px);
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .story-wide-authoring__point:first-child {
    transform: translate(0, -14px);
    text-align: left;
  }
  .story-wide-authoring__point:last-child:not(:first-child) {
    transform: translate(-100%, -14px);
    text-align: right;
  }
  .story-wide-authoring__pin {
    position: relative;
    display: grid;
    place-items: center;
    width: 28px;
    height: 34px;
    margin: 0 auto;
    color: white;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.65));
  }
  .story-wide-authoring__point:first-child .story-wide-authoring__pin {
    margin-left: 0;
  }
  .story-wide-authoring__point:last-child:not(:first-child)
    .story-wide-authoring__pin {
    margin-right: 0;
  }
  .story-wide-authoring__pin :global(svg) {
    position: absolute;
    width: 28px;
    height: 34px;
    fill: var(--accent, #e07a3f);
    stroke: white;
    stroke-width: 1.7;
  }
  .story-wide-authoring__pin b {
    position: relative;
    z-index: 1;
    margin-top: -6px;
    font-size: 10px;
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
  .story-wide-authoring__add {
    justify-self: center;
    align-self: end;
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
  .story-wide-authoring__add:hover,
  .story-wide-authoring__point:hover .story-wide-authoring__point-label strong {
    color: var(--accent, #e07a3f);
  }

  @media (max-width: 720px) {
    .story-wide-authoring {
      gap: 14px;
    }
  }
</style>
