<script lang="ts">
  export let activeLanguage = 'en';
  export let hasAvMedia = false;
  export let marksValid = true;
  export let markInDraft = '';
  export let markOutDraft = '';

  export let activeNarrationUrl = '';
  export let narrationSectionCollapsed = false;
  export let avSectionCollapsed = false;
  export let narrationPreviewing = false;
  export let narrationPreviewLanguage: string | null = null;
  export let activeNarrationStartSec = 0;
  export let activeNarrationEndSec = 0;
  export let activeNarrationDurationSec = 0;
  export let activeNarrationWaveLoading = false;
  export let activeNarrationOverlayStyle = '--start-ratio:0; --end-ratio:0;';
  export let narrationStartDraft = '';
  export let narrationEndDraft = '';

  export let currentNarrationAudioRef: HTMLAudioElement | null = null;
  export let narrationWaveCanvas: HTMLCanvasElement | null = null;

  export let formatTimestamp: (value: number, withFraction?: boolean) => string;
  export let hasValidNarrationSegment: (lang: string) => boolean;
  export let parseHms: (value: string) => number | null;
  export let onToggleNarration: (() => void) | undefined;
  export let onNarrationTrackInput: ((event: Event) => void) | undefined;
  export let onNarrationTimeUpdate: (() => void) | undefined;
  export let onNarrationLoadedMetadata: (() => void) | undefined;
  export let onToggleNarrationPlayback: (() => void) | undefined;
  export let onNarrationStartRangeInput: ((event: Event) => void) | undefined;
  export let onNarrationEndRangeInput: ((event: Event) => void) | undefined;
  export let onNarrationStartInput: ((event: Event) => void) | undefined;
  export let onNarrationEndInput: ((event: Event) => void) | undefined;
  export let onMarkInInput: ((event: Event) => void) | undefined;
  export let onMarkOutInput: ((event: Event) => void) | undefined;
  export let onNarrationMarksCommit: (() => void) | undefined;
  export let onUseNarrationStartCurrent: (() => void) | undefined;
  export let onUseNarrationEndCurrent: (() => void) | undefined;
  export let onToggleAv: (() => void) | undefined;
  export let onCommitMediaMarks: (() => void) | undefined;
  export let onUseMarkInCurrent: (() => void) | undefined;
  export let onUseMarkOutCurrent: (() => void) | undefined;
  export let onPreviewMedia: (() => void) | undefined;
  export let onStopPreviewMedia: (() => void) | undefined;
</script>

{#if activeNarrationUrl}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">Audio Narration ({activeLanguage.toUpperCase()})</div>
      <button
        class="chapter-overlay__collapse-toggle"
        type="button"
        on:click={onToggleNarration}
        aria-expanded={!narrationSectionCollapsed}
        aria-label={narrationSectionCollapsed ? 'Expand audio narration section' : 'Collapse audio narration section'}
      >
        <span
          class="chapter-overlay__collapse-icon"
          class:chapter-overlay__collapse-icon--collapsed={narrationSectionCollapsed}
        >
          ▾
        </span>
      </button>
    </div>

    <div class="chapter-overlay__section-content" hidden={narrationSectionCollapsed}>
      <label class="chapter-overlay__label">
        Narration URL
        <input
          class="chapter-overlay__input"
          type="url"
          data-testid="chapter-narration-url"
          value={activeNarrationUrl}
          on:input={onNarrationTrackInput}
        />
      </label>

      <audio
        class="chapter-overlay__audio-source"
        src={activeNarrationUrl}
        preload="metadata"
        bind:this={currentNarrationAudioRef}
        on:timeupdate={onNarrationTimeUpdate}
        on:loadedmetadata={onNarrationLoadedMetadata}
      ></audio>

      <div class="chapter-overlay__wave-shell">
        <button
          class="chapter-overlay__wave-play"
          type="button"
          data-testid="chapter-narration-preview"
          on:click={onToggleNarrationPlayback}
          disabled={!hasValidNarrationSegment(activeLanguage)}
        >
          {#if narrationPreviewing && narrationPreviewLanguage === activeLanguage}
            Pause
          {:else}
            Play
          {/if}
        </button>

        <div class="chapter-overlay__wave-main">
          <div class="chapter-overlay__wave-summary">
            <div>
              <span class="chapter-overlay__wave-caption">Start</span>
              <strong>{formatTimestamp(activeNarrationStartSec, true)}</strong>
            </div>
            <div class="chapter-overlay__wave-summary-end">
              <span class="chapter-overlay__wave-caption">End</span>
              <strong>{formatTimestamp(activeNarrationEndSec, true)}</strong>
            </div>
          </div>

          <div class="chapter-overlay__wave-track">
            <canvas class="chapter-overlay__wave-canvas" bind:this={narrationWaveCanvas}></canvas>
            {#if activeNarrationDurationSec > 0}
              <div class="chapter-overlay__wave-overlay" style={activeNarrationOverlayStyle} aria-hidden="true">
                <div class="chapter-overlay__wave-selection"></div>
                <div class="chapter-overlay__wave-marker chapter-overlay__wave-marker--start"></div>
                <div class="chapter-overlay__wave-marker chapter-overlay__wave-marker--end"></div>
              </div>
            {/if}
            {#if activeNarrationWaveLoading}
              <div class="chapter-overlay__wave-loading">Loading waveform...</div>
            {/if}
          </div>

          <div class="chapter-overlay__wave-axis">
            <span>{formatTimestamp(0)}</span>
            <span>{formatTimestamp(activeNarrationDurationSec / 2)}</span>
            <span>{formatTimestamp(activeNarrationDurationSec, true)}</span>
          </div>

          <div class="chapter-overlay__wave-sliders">
            <input
              class="chapter-overlay__range chapter-overlay__range--start"
              type="range"
              min="0"
              max={Math.max(1, activeNarrationDurationSec)}
              step="1"
              data-testid="chapter-narration-start-range"
              value={Math.min(activeNarrationStartSec, Math.max(1, activeNarrationDurationSec))}
              on:input={onNarrationStartRangeInput}
              disabled={activeNarrationDurationSec <= 0}
            />
            <input
              class="chapter-overlay__range chapter-overlay__range--end"
              type="range"
              min="0"
              max={Math.max(1, activeNarrationDurationSec)}
              step="1"
              data-testid="chapter-narration-end-range"
              value={Math.min(activeNarrationEndSec, Math.max(1, activeNarrationDurationSec))}
              on:input={onNarrationEndRangeInput}
              disabled={activeNarrationDurationSec <= 0}
            />
          </div>
        </div>
      </div>

      <div class="chapter-overlay__timegrid">
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline">
            Start (HH:MM:SS)
            <input
              class="chapter-overlay__input chapter-overlay__input--time"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              placeholder="00:00:00"
              data-testid="chapter-narration-start"
              value={narrationStartDraft}
              on:input={onNarrationStartInput}
              on:change={onNarrationMarksCommit}
              on:blur={onNarrationMarksCommit}
            />
          </label>
          <button
            class="chapter-overlay__button chapter-overlay__button--subtle"
            type="button"
            data-testid="chapter-narration-start-now"
            on:click={onUseNarrationStartCurrent}
          >
            Use current
          </button>
        </div>

        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline">
            End (HH:MM:SS)
            <input
              class="chapter-overlay__input chapter-overlay__input--time"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              placeholder="00:00:00"
              data-testid="chapter-narration-end"
              value={narrationEndDraft}
              on:input={onNarrationEndInput}
              on:change={onNarrationMarksCommit}
              on:blur={onNarrationMarksCommit}
            />
          </label>
          <button
            class="chapter-overlay__button chapter-overlay__button--subtle"
            type="button"
            data-testid="chapter-narration-end-now"
            on:click={onUseNarrationEndCurrent}
          >
            Use current
          </button>
        </div>
      </div>
    </div>
  </section>
{/if}

{#if hasAvMedia}
  <section class="chapter-overlay__section chapter-overlay__section--card">
    <div class="chapter-overlay__section-header">
      <div class="chapter-overlay__section-title">Audio / Video Preview</div>
      <button
        class="chapter-overlay__collapse-toggle"
        type="button"
        on:click={onToggleAv}
        aria-expanded={!avSectionCollapsed}
        aria-label={avSectionCollapsed ? 'Expand audio and video preview section' : 'Collapse audio and video preview section'}
      >
        <span class="chapter-overlay__collapse-icon" class:chapter-overlay__collapse-icon--collapsed={avSectionCollapsed}>▾</span>
      </button>
    </div>

    <div class="chapter-overlay__section-content" hidden={avSectionCollapsed}>
      <div class="chapter-overlay__hint">Use the media controls in the viewer to set Mark In and Mark Out times.</div>

      <div class="chapter-overlay__timegrid">
        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline">
            Mark In (HH:MM:SS)
            <input
              class="chapter-overlay__input"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              placeholder="00:00:00"
              data-testid="chapter-mark-in"
              value={markInDraft}
              on:input={onMarkInInput}
              on:change={onCommitMediaMarks}
              on:blur={onCommitMediaMarks}
              on:keydown={(event) => {
                if (event.key === 'Enter') onCommitMediaMarks?.();
              }}
            />
          </label>
          <button class="chapter-overlay__button chapter-overlay__button--subtle" type="button" data-testid="chapter-mark-in-btn" on:click={onUseMarkInCurrent}>Use current</button>
        </div>

        <div class="chapter-overlay__timerow">
          <label class="chapter-overlay__label chapter-overlay__label--inline">
            Mark Out (HH:MM:SS)
            <input
              class="chapter-overlay__input"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              placeholder="00:00:00"
              data-testid="chapter-mark-out"
              value={markOutDraft}
              on:input={onMarkOutInput}
              on:change={onCommitMediaMarks}
              on:blur={onCommitMediaMarks}
              on:keydown={(event) => {
                if (event.key === 'Enter') onCommitMediaMarks?.();
              }}
            />
          </label>
          <button class="chapter-overlay__button chapter-overlay__button--subtle" type="button" data-testid="chapter-mark-out-btn" on:click={onUseMarkOutCurrent}>Use current</button>
        </div>
      </div>

      {#if !marksValid}
        <div class="chapter-overlay__hint" data-testid="chapter-av-hint">Mark Out must be greater than Mark In for audio / video.</div>
      {/if}

      <div class="chapter-overlay__row chapter-overlay__row--tight">
        <button
          class="chapter-overlay__button chapter-overlay__button--accent"
          type="button"
          data-testid="chapter-media-preview"
          on:click={onPreviewMedia}
          disabled={parseHms(markInDraft) === null || parseHms(markOutDraft) === null || parseHms(markOutDraft) <= parseHms(markInDraft)}
        >
          Preview segment
        </button>
        <button class="chapter-overlay__button chapter-overlay__button--subtle" type="button" data-testid="chapter-media-stop" on:click={onStopPreviewMedia}>Stop</button>
      </div>
    </div>
  </section>
{/if}
