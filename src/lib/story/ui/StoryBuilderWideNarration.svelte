<script lang="ts">
  import { onDestroy } from 'svelte';
  import { AudioLines, Check, Play, Square, Volume2 } from '@lucide/svelte';
  import type { Readable } from 'svelte/store';
  import type { StoryState } from '../../core/types/story';

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let language = 'en';
  export let languages: string[] = ['en'];
  export let onSetNarrationTrack: (language: string, src: string) => void;
  export let onAssignNarrationSegment: (language: string, start: number, end: number) => void;

  let activeLanguage = language;
  let trackDraft = '';
  let startDraft = '0';
  let endDraft = '';
  let lastSyncKey = '';
  let audioElement: HTMLAudioElement | null = null;
  let audioDuration = 0;
  let waveform: number[] = [];
  let waveformSource = '';
  let waveformLoading = false;
  let waveformRequest = 0;
  let previewing = false;

  $: chapter = $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: availableLanguages = [...new Set([language, ...languages].filter(Boolean))];
  $: segment = chapter?.narrationSegment?.[activeLanguage];
  $: trackSource = $story.narration?.tracks?.[activeLanguage]?.src ?? '';
  $: {
    const syncKey = `${chapter?.id ?? ''}:${activeLanguage}:${trackSource}:${segment?.start ?? ''}:${segment?.end ?? ''}`;
    if (syncKey !== lastSyncKey) {
      lastSyncKey = syncKey;
      trackDraft = trackSource;
      startDraft = segment ? String(segment.start) : '0';
      endDraft = segment ? String(segment.end) : '';
    }
  }

  const commitTrack = () => onSetNarrationTrack(activeLanguage, trackDraft.trim());

  const commitSegment = () => {
    const start = Number(startDraft);
    const end = Number(endDraft);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return;
    onAssignNarrationSegment(activeLanguage, start, end);
  };

  const fallbackWaveform = (seedText: string, bins = 144): number[] => {
    let seed = 0;
    for (const char of seedText) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    let state = seed || 1;
    return Array.from({ length: bins }, (_, index) => {
      state = (state * 1664525 + 1013904223) >>> 0;
      const random = state / 4294967296;
      return 0.14 + Math.abs(Math.sin(index * 0.2 + random * 6.2)) * 0.78;
    });
  };

  const waveformBins = (buffer: AudioBuffer, bins = 144): number[] => {
    const channel = buffer.getChannelData(0);
    if (!channel.length) return [];
    const blockSize = Math.max(1, Math.floor(channel.length / bins));
    const peaks = Array.from({ length: bins }, (_, index) => {
      let peak = 0;
      const start = index * blockSize;
      const end = Math.min(channel.length, start + blockSize);
      for (let sample = start; sample < end; sample += 1) {
        peak = Math.max(peak, Math.abs(channel[sample] ?? 0));
      }
      return peak;
    });
    const maximum = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => Math.max(0.07, peak / maximum));
  };

  const loadWaveform = async (src: string) => {
    const request = ++waveformRequest;
    waveformSource = src;
    waveform = src ? fallbackWaveform(src) : [];
    waveformLoading = Boolean(src);
    if (!src || typeof window === 'undefined' || typeof fetch !== 'function') {
      waveformLoading = false;
      return;
    }

    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      const context = new AudioContextConstructor();
      try {
        const buffer = await context.decodeAudioData(bytes.slice(0));
        if (request !== waveformRequest) return;
        waveform = waveformBins(buffer);
        if (Number.isFinite(buffer.duration)) audioDuration = buffer.duration;
      } finally {
        void context.close();
      }
    } catch {
      // The deterministic fallback remains visible when remote audio blocks waveform decoding.
    } finally {
      if (request === waveformRequest) waveformLoading = false;
    }
  };

  const stopPreview = () => {
    if (previewing) audioElement?.pause();
    previewing = false;
  };

  const togglePreview = async () => {
    if (previewing) {
      stopPreview();
      return;
    }
    if (!audioElement || !validSegment) return;
    audioElement.currentTime = Number(startDraft);
    try {
      await audioElement.play();
      previewing = true;
    } catch {
      previewing = false;
    }
  };

  const handleAudioTimeUpdate = () => {
    if (previewing && audioElement && audioElement.currentTime >= Number(endDraft)) stopPreview();
  };

  const updateRange = (edge: 'start' | 'end', event: Event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (edge === 'start') startDraft = String(Math.min(value, Number(endDraft) - 0.1));
    else endDraft = String(Math.max(value, Number(startDraft) + 0.1));
  };

  $: validSegment =
    Number.isFinite(Number(startDraft)) &&
    Number.isFinite(Number(endDraft)) &&
    Number(startDraft) >= 0 &&
    Number(endDraft) > Number(startDraft);
  $: effectiveDuration = Math.max(
    1,
    audioDuration,
    Number.isFinite(Number(endDraft)) ? Number(endDraft) : 0,
  );
  $: selectionStart = validSegment
    ? Math.max(0, Math.min(1, Number(startDraft) / effectiveDuration))
    : 0;
  $: selectionEnd = validSegment
    ? Math.max(selectionStart, Math.min(1, Number(endDraft) / effectiveDuration))
    : 0;
  $: if (trackSource !== waveformSource) {
    stopPreview();
    audioDuration = 0;
    void loadWaveform(trackSource);
  }

  onDestroy(() => {
    waveformRequest += 1;
    stopPreview();
  });
</script>

<section class="story-wide-narration" aria-labelledby="story-wide-narration-title">
  <div class="story-wide-narration__summary">
    <div class="story-wide-narration__title">
      <span class="story-wide-narration__icon"><AudioLines aria-hidden="true" /></span>
      <span>
        <strong id="story-wide-narration-title">Narration</strong>
        <small>{activeLanguage.toUpperCase()}</small>
      </span>
    </div>
    <p>Choose the narration track and the section used by this chapter.</p>
    {#if availableLanguages.length > 1}
      <div class="story-wide-narration__languages" aria-label="Narration language">
        {#each availableLanguages as entry}
          <button
            type="button"
            class:story-wide-narration__language--active={entry === activeLanguage}
            on:click={() => (activeLanguage = entry)}>{entry.toUpperCase()}</button
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

    <audio
      class="story-wide-narration__audio"
      bind:this={audioElement}
      preload="metadata"
      src={trackSource}
      on:loadedmetadata={() => {
        if (audioElement && Number.isFinite(audioElement.duration))
          audioDuration = audioElement.duration;
      }}
      on:timeupdate={handleAudioTimeUpdate}
      on:ended={() => (previewing = false)}><track kind="captions" /></audio
    >

    <div class="story-wide-narration__waveform" data-testid="chapter-narration-waveform">
      <div class="story-wide-narration__waveform-header">
        <button type="button" disabled={!trackSource || !validSegment} on:click={togglePreview}>
          {#if previewing}<Square aria-hidden="true" /> Stop{:else}<Play aria-hidden="true" /> Preview
            narration{/if}
        </button>
        <span><Volume2 aria-hidden="true" /> Chapter selection</span>
      </div>
      <div class="story-wide-narration__wave-track">
        {#if waveform.length}
          <svg
            viewBox={`0 0 ${waveform.length} 40`}
            preserveAspectRatio="none"
            aria-label="Narration waveform"
          >
            {#each waveform as amplitude, index}
              {@const height = Math.max(3, amplitude * 34)}
              <rect
                class:story-wide-narration__wave-bar--selected={(index + 0.5) / waveform.length >=
                  selectionStart && (index + 0.5) / waveform.length <= selectionEnd}
                x={index + 0.14}
                y={(40 - height) / 2}
                width="0.72"
                {height}
                rx="0.2"
              />
            {/each}
          </svg>
        {:else}
          <span class="story-wide-narration__wave-empty"
            >Add an audio URL to generate its waveform.</span
          >
        {/if}
        {#if waveformLoading}<span class="story-wide-narration__wave-loading"
            >Loading waveform…</span
          >{/if}
        {#if validSegment}
          <span
            class="story-wide-narration__selection"
            style={`left:${selectionStart * 100}%;width:${(selectionEnd - selectionStart) * 100}%`}
            aria-hidden="true"
          ></span>
        {/if}
      </div>
      <div class="story-wide-narration__axis" aria-hidden="true">
        <span>0:00</span><span>{(effectiveDuration / 2).toFixed(1)}s</span><span
          >{effectiveDuration.toFixed(1)}s</span
        >
      </div>
      <div class="story-wide-narration__sliders">
        <input
          type="range"
          min="0"
          max={effectiveDuration}
          step="0.1"
          value={Math.min(Number(startDraft) || 0, effectiveDuration)}
          aria-label="Narration start time"
          on:input={(event) => updateRange('start', event)}
          on:change={commitSegment}
          disabled={!trackSource}
        />
        <input
          type="range"
          min="0"
          max={effectiveDuration}
          step="0.1"
          value={Math.min(Number(endDraft) || effectiveDuration, effectiveDuration)}
          aria-label="Narration end time"
          on:input={(event) => updateRange('end', event)}
          on:change={commitSegment}
          disabled={!trackSource}
        />
      </div>
    </div>

    <div class="story-wide-narration__range">
      <label>
        <span>Start (seconds)</span>
        <input type="number" min="0" step="0.1" bind:value={startDraft} />
      </label>
      <span class="story-wide-narration__range-separator">to</span>
      <label>
        <span>End (seconds)</span>
        <input type="number" min="0" step="0.1" bind:value={endDraft} />
      </label>
      <button
        class="story-wide-narration__apply"
        type="button"
        disabled={!chapter || !validSegment}
        on:click={commitSegment}><Check aria-hidden="true" /> Apply to chapter</button
      >
    </div>
  </div>
</section>

<style>
  .story-wide-narration {
    display: grid;
    grid-template-columns: minmax(150px, 190px) minmax(0, 1fr);
    gap: 22px;
    min-height: 166px;
    padding: 18px;
    box-sizing: border-box;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    background: color-mix(in srgb, var(--viewer-panel, #121922) 92%, transparent);
    color: var(--viewer-text, #e8edf4);
  }
  .story-wide-narration__summary {
    display: grid;
    align-content: start;
    gap: 10px;
    padding-right: 18px;
    border-right: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .story-wide-narration__title {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .story-wide-narration__title > span:last-child {
    display: flex;
    align-items: center;
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
  .story-wide-narration__icon :global(svg) {
    width: 16px;
    height: 16px;
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
    grid-template-columns: minmax(0, 1fr);
    gap: 12px 18px;
    align-content: start;
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
  .story-wide-narration__audio {
    display: none;
  }
  .story-wide-narration__waveform {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .story-wide-narration__waveform-header,
  .story-wide-narration__waveform-header > span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .story-wide-narration__waveform-header > span {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .story-wide-narration__waveform-header button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid color-mix(in srgb, var(--accent, #e07a3f) 55%, transparent);
    border-radius: 7px;
    padding: 5px 8px;
    background: color-mix(in srgb, var(--accent, #e07a3f) 12%, transparent);
    color: var(--viewer-text, #e8edf4);
    font-size: 9px;
    font-weight: 750;
    cursor: pointer;
  }
  .story-wide-narration__waveform-header button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .story-wide-narration__waveform-header :global(svg) {
    width: 12px;
    height: 12px;
  }
  .story-wide-narration__wave-track {
    position: relative;
    height: 48px;
    overflow: hidden;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: rgba(5, 10, 16, 0.42);
  }
  .story-wide-narration__wave-track svg {
    position: absolute;
    inset: 4px 6px;
    width: calc(100% - 12px);
    height: calc(100% - 8px);
  }
  .story-wide-narration__wave-track rect {
    fill: rgba(160, 175, 188, 0.36);
  }
  .story-wide-narration__wave-track .story-wide-narration__wave-bar--selected {
    fill: var(--accent, #e07a3f);
  }
  .story-wide-narration__selection {
    position: absolute;
    top: 0;
    bottom: 0;
    box-sizing: border-box;
    border-right: 1px solid #ffb184;
    border-left: 1px solid #ffb184;
    background: color-mix(in srgb, var(--accent, #e07a3f) 8%, transparent);
    pointer-events: none;
  }
  .story-wide-narration__wave-loading,
  .story-wide-narration__wave-empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
    pointer-events: none;
  }
  .story-wide-narration__wave-loading {
    inset: auto 6px 4px auto;
    display: block;
    padding: 2px 4px;
    border-radius: 4px;
    background: rgba(5, 10, 16, 0.7);
  }
  .story-wide-narration__axis {
    display: flex;
    justify-content: space-between;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 8px;
    font-variant-numeric: tabular-nums;
  }
  .story-wide-narration__sliders {
    position: relative;
    height: 13px;
  }
  .story-wide-narration__sliders input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 13px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    accent-color: var(--accent, #e07a3f);
    pointer-events: none;
  }
  .story-wide-narration__sliders input::-webkit-slider-thumb {
    pointer-events: auto;
  }
  .story-wide-narration__sliders input::-moz-range-thumb {
    pointer-events: auto;
  }
  .story-wide-narration__range {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(90px, 140px) auto minmax(90px, 140px) auto;
    align-items: end;
    gap: 8px;
  }
  .story-wide-narration__range-separator {
    align-self: end;
    padding-bottom: 9px;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
  }
  .story-wide-narration__apply {
    align-self: end;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 33px;
    border: 0;
    border-radius: 8px;
    padding: 8px 12px;
    background: var(--accent, #e07a3f);
    color: white;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
  }
  .story-wide-narration__apply:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .story-wide-narration__apply :global(svg) {
    width: 13px;
    height: 13px;
  }
  @media (max-width: 720px) {
    .story-wide-narration {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .story-wide-narration__summary {
      padding-right: 0;
      padding-bottom: 12px;
      border-right: 0;
      border-bottom: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    }
    .story-wide-narration__editor {
      grid-template-columns: 1fr;
    }
    .story-wide-narration__range {
      grid-template-columns: 1fr auto 1fr;
    }
    .story-wide-narration__apply {
      grid-column: 1 / -1;
    }
  }
</style>
