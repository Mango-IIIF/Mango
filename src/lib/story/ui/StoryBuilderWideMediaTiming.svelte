<script lang="ts">
  import { Check, Film, Play, RotateCcw, Square } from '@lucide/svelte';
  import type { Readable } from 'svelte/store';
  import type { StoryState } from '../../core/types/story';
  import type { MediaSource, MediaType } from '../../iiif/mediaResolver';
  import type { MediaMarksState } from '../mediaMarks';

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let mediaType: Readable<MediaType | null>;
  export let mediaSources: Readable<MediaSource[]>;
  export let mediaMarks: Readable<MediaMarksState>;
  export let marksValid: Readable<boolean>;
  export let onAssignMediaSegment: (start: number, end: number) => void;
  export let onPreview: () => void;
  export let onStopPreview: () => void;

  let startDraft = 0;
  let endDraft = 0;
  let lastSyncKey = '';

  $: chapter = $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: source = $mediaSources.find(
    (entry) => entry.type === 'audio' || entry.type === 'video',
  );
  $: duration = Math.max(
    1,
    source?.duration ?? 0,
    chapter?.media?.end ?? 0,
    $mediaMarks.markOut ?? 0,
  );
  $: {
    const syncKey = `${chapter?.id ?? ''}:${chapter?.media?.start ?? ''}:${chapter?.media?.end ?? ''}:${$mediaMarks.markIn ?? ''}:${$mediaMarks.markOut ?? ''}:${duration}`;
    if (syncKey !== lastSyncKey) {
      lastSyncKey = syncKey;
      startDraft = chapter?.media?.start ?? $mediaMarks.markIn ?? 0;
      endDraft = chapter?.media?.end ?? $mediaMarks.markOut ?? duration;
    }
  }
  $: valid =
    Number.isFinite(startDraft) &&
    Number.isFinite(endDraft) &&
    startDraft >= 0 &&
    endDraft > startDraft &&
    endDraft <= duration + 0.001;
  $: startRatio = Math.max(0, Math.min(1, startDraft / duration));
  $: endRatio = Math.max(startRatio, Math.min(1, endDraft / duration));

  const commit = () => {
    if (valid) onAssignMediaSegment(startDraft, endDraft);
  };

  const preview = () => {
    if (!valid) return;
    onAssignMediaSegment(startDraft, endDraft);
    onPreview();
  };

  const useCurrent = (edge: 'start' | 'end') => {
    const current = Math.max(0, Math.min(duration, $mediaMarks.lastTime));
    if (edge === 'start') startDraft = Math.min(current, endDraft - 0.1);
    else endDraft = Math.max(current, startDraft + 0.1);
  };

  const useFullMedia = () => {
    startDraft = 0;
    endDraft = duration;
    commit();
  };

  const updateRange = (edge: 'start' | 'end', event: Event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    if (edge === 'start') startDraft = Math.min(value, endDraft - 0.1);
    else endDraft = Math.max(value, startDraft + 0.1);
  };
</script>

<section class="story-wide-media" data-testid="chapter-media-timing-editor">
  <div class="story-wide-media__summary">
    <div class="story-wide-media__title">
      <span class="story-wide-media__icon"><Film aria-hidden="true" /></span>
      <span>
        <strong>Source {$mediaType === 'video' ? 'video' : 'audio'}</strong>
        <small>{duration.toFixed(1)}s</small>
      </span>
    </div>
    <p>Choose the part of the Canvas media presented by this chapter.</p>
    <button type="button" class="story-wide-media__secondary" on:click={useFullMedia}>
      <RotateCcw aria-hidden="true" /> Use full media
    </button>
  </div>

  <div class="story-wide-media__editor">
    <div class="story-wide-media__toolbar">
      <strong>Chapter media segment</strong>
      <span>Narration is edited separately.</span>
      <button type="button" disabled={!valid} on:click={preview}>
        <Play aria-hidden="true" /> Preview segment
      </button>
      <button type="button" on:click={onStopPreview}><Square aria-hidden="true" /> Stop</button>
    </div>

    <div class="story-wide-media__track" aria-hidden="true">
      <span
        class="story-wide-media__selection"
        style={`left:${startRatio * 100}%;width:${(endRatio - startRatio) * 100}%`}
      ></span>
    </div>
    <div class="story-wide-media__axis" aria-hidden="true">
      <span>0s</span><span>{(duration / 2).toFixed(1)}s</span><span>{duration.toFixed(1)}s</span>
    </div>
    <div class="story-wide-media__sliders">
      <input
        type="range"
        min="0"
        max={duration}
        step="0.1"
        value={startDraft}
        aria-label="Media start time"
        on:input={(event) => updateRange('start', event)}
      />
      <input
        type="range"
        min="0"
        max={duration}
        step="0.1"
        value={endDraft}
        aria-label="Media end time"
        on:input={(event) => updateRange('end', event)}
      />
    </div>

    <div class="story-wide-media__range">
      <label>
        <span>Start (seconds)</span>
        <input type="number" min="0" max={duration} step="0.1" bind:value={startDraft} />
      </label>
      <button type="button" class="story-wide-media__current" on:click={() => useCurrent('start')}>
        Use current
      </button>
      <span>to</span>
      <label>
        <span>End (seconds)</span>
        <input type="number" min="0" max={duration} step="0.1" bind:value={endDraft} />
      </label>
      <button type="button" class="story-wide-media__current" on:click={() => useCurrent('end')}>
        Use current
      </button>
      <button class="story-wide-media__apply" type="button" disabled={!valid} on:click={commit}>
        <Check aria-hidden="true" /> Apply segment
      </button>
    </div>
    {#if !$marksValid && $mediaMarks.markIn !== null && $mediaMarks.markOut !== null}
      <p class="story-wide-media__error">End must be later than start.</p>
    {/if}
  </div>
</section>

<style>
  .story-wide-media {
    min-height: 166px;
    display: grid;
    grid-template-columns: minmax(150px, 190px) minmax(0, 1fr);
    gap: 22px;
    padding: 18px;
    box-sizing: border-box;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    background: color-mix(in srgb, var(--viewer-panel, #121922) 92%, transparent);
    color: var(--viewer-text, #e8edf4);
  }
  .story-wide-media__summary {
    display: grid;
    align-content: start;
    gap: 10px;
    padding-right: 18px;
    border-right: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .story-wide-media__title,
  .story-wide-media__title > span:last-child,
  .story-wide-media__toolbar,
  .story-wide-media__range {
    display: flex;
    align-items: center;
  }
  .story-wide-media__title { gap: 9px; }
  .story-wide-media__title > span:last-child { gap: 7px; }
  .story-wide-media__title strong { font-size: 13px; }
  .story-wide-media__title small {
    padding: 3px 6px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.07);
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
  }
  .story-wide-media__icon {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: var(--accent, #e07a3f);
    background: color-mix(in srgb, var(--accent, #e07a3f) 14%, transparent);
  }
  .story-wide-media :global(svg) { width: 14px; height: 14px; }
  .story-wide-media__summary p,
  .story-wide-media__toolbar > span,
  .story-wide-media__error {
    margin: 0;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    line-height: 1.45;
  }
  .story-wide-media__secondary,
  .story-wide-media__current,
  .story-wide-media__toolbar button,
  .story-wide-media__apply {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 7px 10px;
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  .story-wide-media__secondary { justify-self: start; }
  .story-wide-media__editor { min-width: 0; display: grid; align-content: start; gap: 8px; }
  .story-wide-media__toolbar { gap: 8px; }
  .story-wide-media__toolbar > span { margin-right: auto; }
  .story-wide-media__track {
    position: relative;
    height: 34px;
    overflow: hidden;
    border-radius: 8px;
    background: repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 2px, transparent 2px 6px), rgba(255,255,255,.035);
  }
  .story-wide-media__selection {
    position: absolute;
    top: 0;
    bottom: 0;
    border-inline: 2px solid var(--accent, #e07a3f);
    background: color-mix(in srgb, var(--accent, #e07a3f) 22%, transparent);
  }
  .story-wide-media__axis { display: flex; justify-content: space-between; color: var(--viewer-muted, #9aa6b2); font-size: 8px; }
  .story-wide-media__sliders { position: relative; height: 16px; }
  .story-wide-media__sliders input { position: absolute; inset: 0; width: 100%; margin: 0; pointer-events: none; background: transparent; }
  .story-wide-media__sliders input::-webkit-slider-thumb { pointer-events: auto; }
  .story-wide-media__sliders input::-moz-range-thumb { pointer-events: auto; }
  .story-wide-media__range { gap: 7px; }
  .story-wide-media__range label { min-width: 105px; display: grid; gap: 3px; color: var(--viewer-muted, #9aa6b2); font-size: 8px; }
  .story-wide-media__range input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 7px;
    padding: 7px 8px;
    background: rgba(5, 10, 16, 0.28);
    color: inherit;
  }
  .story-wide-media__apply { margin-left: auto; border-color: var(--accent, #e07a3f); background: var(--accent, #e07a3f); color: #fff; }
  .story-wide-media button:disabled { opacity: .45; cursor: not-allowed; }
  .story-wide-media__error { color: #ff9d9d; }
  @media (max-width: 760px) {
    .story-wide-media { grid-template-columns: 1fr; }
    .story-wide-media__summary { padding-right: 0; padding-bottom: 12px; border-right: 0; border-bottom: 1px solid var(--viewer-panel-border, rgba(255,255,255,.08)); }
    .story-wide-media__range { flex-wrap: wrap; }
  }
</style>
