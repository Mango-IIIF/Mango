<script lang="ts">
  import { AudioLines, Check, Play, Square, Volume2 } from "@lucide/svelte";
  import type { Readable } from "svelte/store";
  import type { StoryState } from "../../core/types/story";
  import AudioRegionEditor from "./AudioRegionEditor.svelte";

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let language = "en";
  export let languages: string[] = ["en"];
  export let onSetNarrationTrack: (language: string, src: string) => void;
  export let onAssignNarrationSegment: (
    language: string,
    start: number,
    end: number,
  ) => void;

  let activeLanguage = language;
  let trackDraft = "";
  let startDraft = "0.00";
  let endDraft = "0.00";
  let audioDuration = 0;
  let lastSyncKey = "";
  let previewing = false;
  let regionEditor: AudioRegionEditor | null = null;

  const formatTime = (value: number) => value.toFixed(2);

  $: chapter =
    $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: availableLanguages = [
    ...new Set([language, ...languages].filter(Boolean)),
  ];
  $: segment = chapter?.narrationSegment?.[activeLanguage];
  $: trackSource = $story.narration?.tracks?.[activeLanguage]?.src ?? "";
  $: {
    const syncKey = `${chapter?.id ?? ""}:${activeLanguage}:${trackSource}:${segment?.start ?? ""}:${segment?.end ?? ""}`;
    if (syncKey !== lastSyncKey) {
      lastSyncKey = syncKey;
      regionEditor?.stop();
      previewing = false;
      trackDraft = trackSource;
      startDraft = formatTime(segment?.start ?? 0);
      endDraft = segment ? formatTime(segment.end) : "0.00";
    }
  }

  $: validSegment =
    Number.isFinite(Number(startDraft)) &&
    Number.isFinite(Number(endDraft)) &&
    Number(startDraft) >= 0 &&
    Number(endDraft) > Number(startDraft) &&
    (audioDuration <= 0 || Number(endDraft) <= audioDuration + 0.001);

  const commitTrack = () =>
    onSetNarrationTrack(activeLanguage, trackDraft.trim());
  const commitSegment = () => {
    if (!validSegment) return;
    onAssignNarrationSegment(
      activeLanguage,
      Number(startDraft),
      Number(endDraft),
    );
  };
  const normalizeAndCommitSegment = () => {
    const nextStart = Number(startDraft);
    const nextEnd = Number(endDraft);
    if (Number.isFinite(nextStart)) startDraft = formatTime(nextStart);
    if (Number.isFinite(nextEnd)) endDraft = formatTime(nextEnd);
    commitSegment();
  };
  const handleRegionChange = (
    start: number,
    end: number,
    committed: boolean,
  ) => {
    startDraft = formatTime(start);
    endDraft = formatTime(end);
    if (committed) commitSegment();
  };
  const togglePreview = async () => {
    if (previewing) {
      regionEditor?.stop();
      return;
    }
    if (!validSegment) return;
    previewing = (await regionEditor?.playSelection()) ?? false;
  };
</script>

<section
  class="story-wide-narration"
  aria-labelledby="story-wide-narration-title"
>
  <div class="story-wide-narration__summary">
    <div class="story-wide-narration__title">
      <span class="story-wide-narration__icon"
        ><AudioLines aria-hidden="true" /></span
      >
      <span
        ><strong id="story-wide-narration-title">Narration</strong><small
          >{activeLanguage.toUpperCase()}</small
        ></span
      >
    </div>
    <p>Choose the narration track and drag or resize the chapter region.</p>
    {#if availableLanguages.length > 1}
      <div
        class="story-wide-narration__languages"
        aria-label="Narration language"
      >
        {#each availableLanguages as entry}
          <button
            type="button"
            class:story-wide-narration__language--active={entry ===
              activeLanguage}
            on:click={() => (activeLanguage = entry)}
            >{entry.toUpperCase()}</button
          >
        {/each}
      </div>
    {/if}
  </div>

  <div class="story-wide-narration__editor">
    <label class="story-wide-narration__track">
      <span>Narration audio URL</span>
      <input
        type="url"
        placeholder="https://example.org/narration.mp3"
        bind:value={trackDraft}
        on:change={commitTrack}
      />
    </label>
    <div class="story-wide-narration__waveform-header">
      <button
        type="button"
        disabled={!trackSource || !validSegment}
        on:click={togglePreview}
      >
        {#if previewing}<Square aria-hidden="true" /> Stop{:else}<Play
            aria-hidden="true"
          /> Preview narration{/if}
      </button>
      <span
        ><Volume2 aria-hidden="true" /> Drag or resize the chapter selection</span
      >
    </div>
    <AudioRegionEditor
      bind:this={regionEditor}
      url={trackSource}
      start={Number(startDraft) || 0}
      end={Number(endDraft) || audioDuration}
      duration={audioDuration}
      label="Narration waveform"
      testId="chapter-narration-waveform"
      onChange={handleRegionChange}
      onReady={(duration) => {
        audioDuration = duration;
        if (
          !Number.isFinite(Number(endDraft)) ||
          Number(endDraft) <= Number(startDraft)
        )
          endDraft = formatTime(duration);
      }}
      onPlayStateChange={(playing) => (previewing = playing)}
    />
    <div class="story-wide-narration__range">
      <label
        ><span>Start (seconds)</span><input
          type="number"
          min="0"
          max={audioDuration || undefined}
          step="0.01"
          bind:value={startDraft}
          on:change={normalizeAndCommitSegment}
          on:blur={normalizeAndCommitSegment}
        /></label
      >
      <span>to</span>
      <label
        ><span>End (seconds)</span><input
          type="number"
          min="0"
          max={audioDuration || undefined}
          step="0.01"
          bind:value={endDraft}
          on:change={normalizeAndCommitSegment}
          on:blur={normalizeAndCommitSegment}
        /></label
      >
      <button
        class="story-wide-narration__apply"
        type="button"
        disabled={!chapter || !validSegment}
        on:click={commitSegment}
        ><Check aria-hidden="true" /> Apply to chapter</button
      >
    </div>
  </div>
</section>

<style>
  .story-wide-narration {
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
  .story-wide-narration__summary {
    display: grid;
    align-content: start;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid
      var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .story-wide-narration__title,
  .story-wide-narration__title > span:last-child,
  .story-wide-narration__waveform-header,
  .story-wide-narration__waveform-header > span {
    display: flex;
    align-items: center;
  }
  .story-wide-narration__title {
    gap: 9px;
  }
  .story-wide-narration__title > span:last-child {
    gap: 7px;
  }
  .story-wide-narration__title strong {
    font-size: 13px;
  }
  .story-wide-narration__title small {
    padding: 3px 6px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.07);
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
  }
  .story-wide-narration__icon {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: var(--accent, #e07a3f);
    background: color-mix(in srgb, var(--accent, #e07a3f) 14%, transparent);
  }
  .story-wide-narration :global(svg) {
    width: 14px;
    height: 14px;
  }
  .story-wide-narration__summary p {
    margin: 0;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    line-height: 1.45;
  }
  .story-wide-narration__languages {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .story-wide-narration__languages button {
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 7px;
    padding: 5px 7px;
    background: transparent;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
  }
  .story-wide-narration__languages .story-wide-narration__language--active {
    border-color: var(--accent, #e07a3f);
    color: var(--viewer-text, #e8edf4);
  }
  .story-wide-narration__editor {
    display: grid;
    align-content: start;
    gap: 8px;
    min-width: 0;
  }
  .story-wide-narration__track,
  .story-wide-narration__range label {
    display: grid;
    gap: 5px;
    min-width: 0;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .story-wide-narration input {
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 8px 10px;
    background: rgba(5, 10, 16, 0.35);
    color: var(--viewer-text, #e8edf4);
    font: inherit;
    font-size: 11px;
  }
  .story-wide-narration__waveform-header {
    justify-content: space-between;
    gap: 8px;
  }
  .story-wide-narration__waveform-header > span {
    gap: 6px;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .story-wide-narration__waveform-header button,
  .story-wide-narration__apply {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid
      color-mix(in srgb, var(--accent, #e07a3f) 55%, transparent);
    border-radius: 8px;
    padding: 7px 10px;
    background: color-mix(in srgb, var(--accent, #e07a3f) 12%, transparent);
    color: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  .story-wide-narration__waveform-header button:disabled,
  .story-wide-narration__apply:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .story-wide-narration__range {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) auto minmax(120px, 1fr) auto;
    align-items: end;
    gap: 8px;
  }
  .story-wide-narration__range label {
    width: 100%;
  }
  .story-wide-narration__apply {
    min-height: 34px;
    align-self: end;
  }
  .story-wide-narration__range > span {
    min-height: 34px;
    display: grid;
    place-items: center;
    align-self: end;
  }
  @media (max-width: 760px) {
    .story-wide-narration__range {
      grid-template-columns: minmax(110px, 1fr) auto;
    }
    .story-wide-narration__range > span {
      display: none;
    }
  }
</style>
