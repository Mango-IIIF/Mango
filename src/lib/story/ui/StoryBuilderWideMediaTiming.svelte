<script lang="ts">
  import { Play, RotateCcw, Square } from "@lucide/svelte";
  import type { Readable } from "svelte/store";
  import type { StoryState } from "../../core/types/story";
  import type { MediaSource, MediaType } from "../../iiif/mediaResolver";
  import type { MediaMarksState } from "../mediaMarks";
  import AudioRegionEditor from "./AudioRegionEditor.svelte";
  import { t } from '../../core/i18n';

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let mediaType: Readable<MediaType | null>;
  export let mediaSources: Readable<MediaSource[]>;
  export let mediaMarks: Readable<MediaMarksState>;
  export let marksValid: Readable<boolean>;
  export let onAssignMediaSegment: (start: number, end: number) => void;
  export let onPreview: () => void;
  export let onStopPreview: () => void;

  let startDraft = "0.00";
  let endDraft = "0.00";
  let waveformDuration = 0;
  let lastSyncKey = "";

  const formatTime = (value: number) => value.toFixed(2);

  $: chapter =
    $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: source =
    $mediaSources.find((entry) => entry.type === $mediaType) ??
    $mediaSources.find(
      (entry) => entry.type === "audio" || entry.type === "video",
    );
  $: duration = Math.max(
    1,
    source?.duration ?? 0,
    waveformDuration,
    chapter?.media?.end ?? 0,
    $mediaMarks.markOut ?? 0,
  );
  $: {
    const syncKey = `${chapter?.id ?? ""}:${chapter?.media?.start ?? ""}:${chapter?.media?.end ?? ""}:${$mediaMarks.markIn ?? ""}:${$mediaMarks.markOut ?? ""}:${duration}`;
    if (syncKey !== lastSyncKey) {
      lastSyncKey = syncKey;
      startDraft = formatTime(chapter?.media?.start ?? $mediaMarks.markIn ?? 0);
      endDraft = formatTime(
        chapter?.media?.end ?? $mediaMarks.markOut ?? duration,
      );
    }
  }
  $: valid =
    Number.isFinite(Number(startDraft)) &&
    Number.isFinite(Number(endDraft)) &&
    Number(startDraft) >= 0 &&
    Number(endDraft) > Number(startDraft) &&
    Number(endDraft) <= duration + 0.001;

  const commit = () => {
    const nextStart = Number(startDraft);
    const nextEnd = Number(endDraft);
    if (
      Number.isFinite(nextStart) &&
      Number.isFinite(nextEnd) &&
      nextStart >= 0 &&
      nextEnd > nextStart &&
      nextEnd <= duration + 0.001
    )
      onAssignMediaSegment(nextStart, nextEnd);
  };

  const preview = () => {
    if (!valid) return;
    commit();
    onPreview();
  };

  const useCurrent = (edge: "start" | "end") => {
    const current = Math.max(0, Math.min(duration, $mediaMarks.lastTime));
    if (edge === "start")
      startDraft = formatTime(Math.min(current, Number(endDraft) - 0.01));
    else endDraft = formatTime(Math.max(current, Number(startDraft) + 0.01));
    commit();
  };

  const useFullMedia = () => {
    startDraft = formatTime(0);
    endDraft = formatTime(duration);
    commit();
  };

  const normalizeAndCommit = () => {
    const nextStart = Number(startDraft);
    const nextEnd = Number(endDraft);
    if (Number.isFinite(nextStart)) startDraft = formatTime(nextStart);
    if (Number.isFinite(nextEnd)) endDraft = formatTime(nextEnd);
    commit();
  };

  const handleRegionChange = (
    start: number,
    end: number,
    committed: boolean,
  ) => {
    startDraft = formatTime(start);
    endDraft = formatTime(end);
    if (committed) commit();
  };
</script>

<section class="story-wide-media" data-testid="chapter-media-timing-editor">
  <div class="story-wide-media__editor">
    <div class="story-wide-media__toolbar">
      <strong>{$t('storyBuilder.media.segment')}</strong>
      <button type="button" on:click={useFullMedia}>
        <RotateCcw aria-hidden="true" /> {$t('storyBuilder.media.useFull')}
      </button>
      <button type="button" disabled={!valid} on:click={preview}>
        <Play aria-hidden="true" /> {$t('storyBuilder.chapter.preview')}
      </button>
      <button type="button" on:click={onStopPreview}>
        <Square aria-hidden="true" /> {$t('storyBuilder.media.stop')}
      </button>
    </div>

    <AudioRegionEditor
      url={source?.src ?? ""}
      start={Number(startDraft)}
      end={Number(endDraft)}
      {duration}
      label={$t('storyBuilder.media.sourceWaveform', { type: source?.type ?? $mediaType ?? $t('storyBuilder.media.media') })}
      testId="chapter-media-waveform"
      onChange={handleRegionChange}
      onReady={(nextDuration) => (waveformDuration = nextDuration)}
    />

    <div class="story-wide-media__range">
      <label>
        <span>{$t('storyBuilder.media.startSeconds')}</span>
        <input
          type="number"
          min="0"
          max={duration}
          step="0.01"
          aria-label={$t('storyBuilder.media.startTime')}
          bind:value={startDraft}
          on:change={normalizeAndCommit}
          on:blur={normalizeAndCommit}
        />
      </label>
      <button
        type="button"
        class="story-wide-media__current"
        on:click={() => useCurrent("start")}
      >
        {$t('storyBuilder.media.useCurrent')}
      </button>
      <span>{$t('storyBuilder.media.to')}</span>
      <label>
        <span>{$t('storyBuilder.media.endSeconds')}</span>
        <input
          type="number"
          min="0"
          max={duration}
          step="0.01"
          aria-label={$t('storyBuilder.media.endTime')}
          bind:value={endDraft}
          on:change={normalizeAndCommit}
          on:blur={normalizeAndCommit}
        />
      </label>
      <button
        type="button"
        class="story-wide-media__current"
        on:click={() => useCurrent("end")}
      >
        {$t('storyBuilder.media.useCurrent')}
      </button>
    </div>
    {#if !$marksValid && $mediaMarks.markIn !== null && $mediaMarks.markOut !== null}
      <p class="story-wide-media__error">{$t('storyBuilder.media.invalidRange')}</p>
    {/if}
  </div>
</section>

<style>
  .story-wide-media {
    min-height: 166px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
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
  .story-wide-media__toolbar {
    display: flex;
    align-items: center;
  }
  .story-wide-media :global(svg) {
    width: 14px;
    height: 14px;
  }
  .story-wide-media__error {
    margin: 0;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    line-height: 1.45;
  }
  .story-wide-media__current,
  .story-wide-media__toolbar button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 7px 10px;
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 4%, transparent);
    color: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  .story-wide-media__editor {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 8px;
  }
  .story-wide-media__toolbar {
    gap: 8px;
  }
  .story-wide-media__toolbar > strong {
    margin-right: auto;
  }
  .story-wide-media__range {
    display: grid;
    grid-template-columns:
      minmax(120px, 1fr) auto auto minmax(120px, 1fr)
      auto;
    align-items: end;
    gap: 7px;
  }
  .story-wide-media__range label {
    min-width: 105px;
    display: grid;
    gap: 3px;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 8px;
  }
  .story-wide-media__range input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 7px;
    padding: 7px 8px;
    background: var(--viewer-well-bg, rgba(5, 10, 16, 0.28));
    color: inherit;
  }
  .story-wide-media__range > span,
  .story-wide-media__current {
    min-height: 34px;
    align-self: end;
  }
  .story-wide-media__range > span {
    display: grid;
    place-items: center;
  }
  .story-wide-media button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .story-wide-media__error {
    color: var(--viewer-danger, #ff9d9d);
  }
  @media (max-width: 760px) {
    .story-wide-media__range {
      grid-template-columns: minmax(110px, 1fr) auto;
    }
    .story-wide-media__range > span {
      display: none;
    }
  }
</style>
