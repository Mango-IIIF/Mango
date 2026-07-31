<script lang="ts">
  import { Clock3, Play, Square } from '@lucide/svelte';
  import type { ChapterCameraTrack } from '../../core/types/story';

  export let track: ChapterCameraTrack | undefined;
  export let previewing = false;
  export let onUpdateDuration: (durationMs: number) => void;
  export let onUpdatePathType: (pathType: 'linear' | 'spline') => void = () => {};
  export let onUpdateDwell: (dwellMs: number) => void = () => {};
  export let onUpdateEasing: (
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out',
  ) => void = () => {};
  export let onApplyPreset: (preset: NonNullable<ChapterCameraTrack['preset']>) => void;
  export let onPreview: () => void;
  export let onStopPreview: () => void;

  $: durationSeconds = (track?.durationMs ?? 5000) / 1000;
  $: points = [...(track?.keyframes ?? [])].sort((a, b) => a.timeMs - b.timeMs);
  $: currentDwell = points[0]?.dwellMs ?? 0;
  $: firstSegmentMs = points.length >= 2 ? Math.max(1, points[1].timeMs - points[0].timeMs) : 0;
  $: arcNeedsPoint = track?.preset === 'custom' && points.length > 0 && points.length < 3;
  $: requirementMessage =
    points.length === 0
      ? 'Choose a movement style or add two camera points to enable motion controls.'
      : points.length === 1
        ? 'Add one more camera point to preview and configure this movement.'
        : arcNeedsPoint
          ? 'Arc sweep needs at least three camera points. Add one more point to use it.'
          : '';

  let feedback = '';

  const commitDuration = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const seconds = Number(input.value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      feedback = 'Motion duration must be greater than 0 seconds.';
      input.value = String(durationSeconds);
      return;
    }
    const durationMs = seconds * 1000;
    const nextFirstSegmentMs = points.length >= 2 ? durationMs / (points.length - 1) : durationMs;
    if (currentDwell > 0 && currentDwell >= nextFirstSegmentMs) {
      feedback = `Duration must leave time to move after the ${currentDwell / 1000}s start hold.`;
      input.value = String(durationSeconds);
      return;
    }
    feedback = '';
    onUpdateDuration(durationMs);
  };

  const choosePreset = (preset: NonNullable<ChapterCameraTrack['preset']>) => {
    if (preset === 'arc-sweep' && arcNeedsPoint) {
      feedback = 'Arc sweep needs at least three camera points. Add another point first.';
      return;
    }
    feedback = '';
    onApplyPreset(preset);
  };

  const choosePathType = (pathType: 'linear' | 'spline') => {
    if (points.length < 2) return;
    feedback = '';
    onUpdatePathType(pathType);
  };

  const chooseDwell = (dwellMs: number) => {
    if (points.length < 2) return;
    if (dwellMs > 0 && dwellMs >= firstSegmentMs) {
      feedback = 'The start hold must be shorter than the time to the next camera point.';
      return;
    }
    feedback = '';
    onUpdateDwell(dwellMs);
  };
</script>

<div class="motion-panel">
  <div class="motion-panel__intro">
    <div>
      <strong>Move through this chapter</strong>
      <span>
        {track?.preset === 'custom'
          ? 'Custom keeps the canvas zoom captured for each point. Preview starts at Point 1.'
          : 'Points set the focus; the movement style controls zoom. Preview starts at Point 1.'}
      </span>
    </div>
    <button
      class="motion-panel__preview"
      type="button"
      disabled={points.length < 2}
      on:click={() => (previewing ? onStopPreview() : onPreview())}
    >
      {#if previewing}<Square aria-hidden="true" /> Stop{:else}<Play aria-hidden="true" /> Preview{/if}
    </button>
  </div>

  {#if feedback || requirementMessage}
    <p class="motion-panel__feedback" role="status" aria-live="polite">
      {feedback || requirementMessage}
    </p>
  {/if}

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__section-label">Movement style</div>
    <div class="motion-panel__presets" role="group" aria-label="Motion presets">
      {#each [['ken-burns', 'Ken Burns'], ['hero-reveal', 'Hero reveal'], ['arc-sweep', 'Arc sweep'], ['zoom-in', 'Zoom in'], ['zoom-out', 'Zoom out'], ['pan', 'Pan'], ['drift-zoom', 'Drift + zoom'], ['static', 'Still'], ['custom', 'Custom']] as option}
        <button
          type="button"
          disabled={option[0] === 'arc-sweep' && arcNeedsPoint}
          aria-pressed={track?.preset === option[0]}
          class:motion-panel__preset--active={track?.preset === option[0]}
          on:click={() => choosePreset(option[0] as NonNullable<ChapterCameraTrack['preset']>)}
          >{option[1]}</button
        >
      {/each}
    </div>
  </section>

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__section-label">Path Trajectory</div>
    <div class="motion-panel__presets" role="group" aria-label="Path trajectory">
      <button
        type="button"
        disabled={points.length < 2}
        aria-pressed={track?.pathType === 'spline'}
        class:motion-panel__preset--active={Boolean(track) &&
          (track?.pathType ?? 'linear') === 'spline'}
        on:click={() => choosePathType('spline')}>Curved Spline</button
      >
      <button
        type="button"
        disabled={points.length < 2}
        aria-pressed={track?.pathType === 'linear'}
        class:motion-panel__preset--active={Boolean(track) &&
          (track?.pathType ?? 'linear') === 'linear'}
        on:click={() => choosePathType('linear')}>Straight Linear</button
      >
    </div>
  </section>

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__heading">
      <span class="motion-panel__icon"><Clock3 aria-hidden="true" /></span>
      <span>
        <strong>Start Hold Time (Dwell)</strong>
        <small>Hold stationary on the initial view before movement starts.</small>
      </span>
    </div>
    <div class="motion-panel__presets" role="group" aria-label="Initial dwell time">
      {#each [[0, '0s (None)'], [1000, '1.0s'], [1500, '1.5s'], [2000, '2.0s'], [3000, '3.0s']] as option}
        <button
          type="button"
          disabled={points.length < 2 || (option[0] > 0 && option[0] >= firstSegmentMs)}
          aria-pressed={points.length >= 2 && currentDwell === option[0]}
          class:motion-panel__preset--active={points.length >= 2 && currentDwell === option[0]}
          on:click={() => chooseDwell(option[0])}>{option[1]}</button
        >
      {/each}
    </div>
  </section>

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__section-label">Easing</div>
    <div class="motion-panel__presets" role="group" aria-label="Motion easing">
      {#each [['linear', 'Linear'], ['ease-in', 'Ease in'], ['ease-out', 'Ease out'], ['ease-in-out', 'Ease in/out']] as option}
        <button
          type="button"
          disabled={points.length < 2}
          aria-pressed={Boolean(track) && (track?.easing ?? 'ease-in-out') === option[0]}
          class:motion-panel__preset--active={Boolean(track) &&
            (track?.easing ?? 'ease-in-out') === option[0]}
          on:click={() => {
            feedback = '';
            onUpdateEasing(option[0] as NonNullable<ChapterCameraTrack['easing']>);
          }}>{option[1]}</button
        >
      {/each}
    </div>
  </section>

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__heading">
      <span class="motion-panel__icon"><Clock3 aria-hidden="true" /></span>
      <span>
        <strong>Chapter motion duration</strong>
        <small>All positions are spaced automatically across this duration.</small>
      </span>
    </div>
    <label class="chapter-overlay__label">
      Duration (seconds)
      <input
        class="chapter-overlay__input"
        type="number"
        min="0.1"
        step="0.1"
        data-testid="motion-duration"
        value={durationSeconds}
        on:change={commitDuration}
      />
    </label>
  </section>
</div>

<style>
  .motion-panel {
    display: grid;
    gap: 12px;
  }
  .motion-panel__intro {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .motion-panel__intro > div {
    display: grid;
    gap: 3px;
  }
  .motion-panel__intro strong {
    font-size: 14px;
  }
  .motion-panel__intro span {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    line-height: 1.4;
  }
  .motion-panel__preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 9px;
    padding: 9px 11px;
    background: var(--accent, var(--story-builder-accent, #e07a3f));
    color: white;
    font-weight: 700;
    cursor: pointer;
  }
  .motion-panel__preview:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .motion-panel__feedback {
    margin: 0;
    border: 1px solid color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 38%, transparent);
    border-radius: 9px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 9%, transparent);
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    line-height: 1.45;
  }
  .motion-panel__preview :global(svg) {
    width: 14px;
    height: 14px;
  }
  .motion-panel__section {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .motion-panel__section + .motion-panel__section {
    padding-top: 12px;
    border-top: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
  .motion-panel__section-label {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .motion-panel__presets {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .motion-panel__presets button {
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 9px;
    padding: 9px 5px;
    background: transparent;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
    cursor: pointer;
  }
  .motion-panel__presets button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }
  .motion-panel__presets .motion-panel__preset--active {
    border-color: var(--accent, var(--story-builder-accent, #e07a3f));
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 12%, transparent);
    color: var(--viewer-text, #e8edf4);
  }
  .motion-panel__heading {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .motion-panel__heading > span:last-child {
    display: grid;
    gap: 2px;
  }
  .motion-panel__heading strong {
    font-size: 13px;
  }
  .motion-panel__heading small {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 11px;
  }
  .motion-panel__icon {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: var(--accent, var(--story-builder-accent, #e07a3f));
    background: color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 14%, transparent);
  }
  .motion-panel input {
    min-width: 0;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 8px;
    background: var(--viewer-panel, #121922);
    color: inherit;
  }
</style>
