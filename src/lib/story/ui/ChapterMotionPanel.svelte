<script lang="ts">
  import { Camera, Clock3, Eye, MousePointer2, Play, Square, Trash2 } from '@lucide/svelte';
  import type { ChapterCameraTrack } from '../../core/types/story';

  export let track: ChapterCameraTrack | undefined;
  export let previewing = false;
  export let onPositionPoint: (keyframeId?: string) => void;
  export let onDeletePoint: (keyframeId: string) => void;
  export let onGoToPoint: (keyframeId: string) => void;
  export let onUpdateDuration: (durationMs: number) => void;
  export let onApplyPreset: (preset: NonNullable<ChapterCameraTrack['preset']>) => void;
  export let onPreview: () => void;
  export let onStopPreview: () => void;

  $: durationSeconds = (track?.durationMs ?? 5000) / 1000;
  $: points = [...(track?.keyframes ?? [])].sort((a, b) => a.timeMs - b.timeMs);

  const commitDuration = (event: Event) => {
    const seconds = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(seconds) && seconds > 0) onUpdateDuration(seconds * 1000);
  };

  const describePoint = (point: ChapterCameraTrack['keyframes'][number]): string => {
    if (point.focus) {
      return `Focal point · x ${Math.round(point.focus.x)}, y ${Math.round(point.focus.y)}`;
    }
    if (point.viewBox) {
      return `Canvas view · x ${Math.round(point.viewBox.x)}, y ${Math.round(point.viewBox.y)}, ${Math.round(point.viewBox.w)} × ${Math.round(point.viewBox.h)}`;
    }
    if (point.model) return '3D camera pose';
    if (point.layerOpacities) return `${Object.keys(point.layerOpacities).length} layer states`;
    return 'Camera state';
  };
</script>

<div class="motion-panel">
  <div class="motion-panel__intro">
    <div>
      <strong>Move through this chapter</strong>
      <span>Start with a style or place camera points directly in the viewer.</span>
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

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__section-label">Movement style</div>
    <div class="motion-panel__presets" role="group" aria-label="Motion presets">
      {#each [
        ['static', 'Still'],
        ['zoom-in', 'Zoom in'],
        ['zoom-out', 'Zoom out'],
        ['pan', 'Pan'],
        ['drift-zoom', 'Drift + zoom'],
        ['custom', 'Custom'],
      ] as option}
        <button
          type="button"
          class:motion-panel__preset--active={(track?.preset ?? 'custom') === option[0]}
          on:click={() => onApplyPreset(option[0] as NonNullable<ChapterCameraTrack['preset']>)}
        >{option[1]}</button>
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

  <section class="chapter-overlay__section chapter-overlay__section--card motion-panel__section">
    <div class="motion-panel__heading">
      <span class="motion-panel__icon"><Camera aria-hidden="true" /></span>
      <span>
        <strong>Camera points</strong>
        <small>Add a pin, drag it onto the artwork, then confirm its position.</small>
      </span>
    </div>

    {#if points.length}
      <ol class="motion-panel__points">
        {#each points as point, index (point.id)}
          <li class="motion-panel__point">
            <div class="motion-panel__point-number" aria-hidden="true">{index + 1}</div>
            <div class="motion-panel__point-main">
              <button
                class="motion-panel__point-goto"
                type="button"
                aria-label={`Go to camera point ${index + 1}`}
                on:click={() => onGoToPoint(point.id)}
              >
                <strong>Point {index + 1}</strong>
                <span>{describePoint(point)}</span>
              </button>
              <span class="motion-panel__point-time">
                {index === 0
                  ? 'Start'
                  : index === points.length - 1
                    ? `End · ${durationSeconds.toFixed(1)}s`
                    : `${(point.timeMs / 1000).toFixed(1)}s`}
              </span>
            </div>
            <div class="motion-panel__point-actions">
              <button
                type="button"
                title="Set this point in the viewer"
                aria-label={`Set point ${index + 1} in the viewer`}
                on:click={() => onPositionPoint(point.id)}
              ><Eye aria-hidden="true" /></button>
              <button
                type="button"
                title="Delete point"
                aria-label={`Delete point ${index + 1}`}
                on:click={() => onDeletePoint(point.id)}
              ><Trash2 aria-hidden="true" /></button>
            </div>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="chapter-overlay__hint">
        Add at least two positions to create movement. Timing is calculated from their order and the duration above.
      </p>
    {/if}

    <div class="motion-panel__capture">
      <button
        class="chapter-overlay__button chapter-overlay__button--accent"
        type="button"
        data-testid="motion-add-point"
        on:click={() => onPositionPoint()}
      >
        <MousePointer2 aria-hidden="true" />
        {points.length ? 'Add another point' : 'Add first point'}
      </button>
    </div>
  </section>
</div>

<style>
  .motion-panel { display: grid; gap: 12px; }
  .motion-panel__intro { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .motion-panel__intro > div { display: grid; gap: 3px; }
  .motion-panel__intro strong { font-size: 14px; }
  .motion-panel__intro span { color: var(--viewer-muted, #9aa6b2); font-size: 11px; line-height: 1.4; }
  .motion-panel__preview {
    display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 9px; padding: 9px 11px;
    background: var(--accent, #e07a3f); color: white; font-weight: 700; cursor: pointer;
  }
  .motion-panel__preview:disabled { opacity: .4; cursor: not-allowed; }
  .motion-panel__preview :global(svg) { width: 14px; height: 14px; }
  .motion-panel__section { padding: 0; border: 0; border-radius: 0; background: transparent; }
  .motion-panel__section + .motion-panel__section { padding-top: 12px; border-top: 1px solid var(--viewer-panel-border, rgba(255,255,255,.08)); }
  .motion-panel__section-label { color: var(--viewer-muted, #9aa6b2); font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .motion-panel__presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .motion-panel__presets button {
    border: 1px solid var(--viewer-panel-border, rgba(255,255,255,.1)); border-radius: 9px; padding: 9px 5px;
    background: transparent; color: var(--viewer-muted, #9aa6b2); font-size: 11px; cursor: pointer;
  }
  .motion-panel__presets .motion-panel__preset--active {
    border-color: var(--accent, #e07a3f); background: color-mix(in srgb, var(--accent, #e07a3f) 12%, transparent); color: var(--viewer-text, #e8edf4);
  }
  .motion-panel__heading { display: flex; gap: 10px; align-items: center; }
  .motion-panel__heading > span:last-child { display: grid; gap: 2px; }
  .motion-panel__heading strong { font-size: 13px; }
  .motion-panel__heading small { color: var(--viewer-muted, #9aa6b2); font-size: 11px; }
  .motion-panel__icon {
    width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px;
    color: var(--accent, #e07a3f); background: color-mix(in srgb, var(--accent, #e07a3f) 14%, transparent);
  }
  .motion-panel__icon :global(svg) { width: 17px; height: 17px; }
  .motion-panel__points { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .motion-panel__point {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 9px; align-items: start;
    padding: 10px; border: 1px solid var(--viewer-panel-border, rgba(255,255,255,.08)); border-radius: 10px;
  }
  .motion-panel__point-number {
    width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%;
    background: var(--viewer-panel-strong, #1b242e); font-size: 11px; font-weight: 700;
  }
  .motion-panel__point-main { display: grid; gap: 4px; min-width: 0; }
  .motion-panel__point-goto {
    display: grid; gap: 3px; width: 100%; border: 0; padding: 2px 4px; border-radius: 6px;
    background: transparent; color: inherit; text-align: left; cursor: pointer;
  }
  .motion-panel__point-goto:hover, .motion-panel__point-goto:focus-visible {
    background: color-mix(in srgb, var(--accent, #e07a3f) 10%, transparent);
  }
  .motion-panel__point-goto span { color: var(--viewer-muted, #9aa6b2); font-size: 10px; }
  .motion-panel__point-time { color: var(--viewer-muted, #9aa6b2); font-size: 10px; font-weight: 700; }
  .motion-panel input {
    min-width: 0; border: 1px solid var(--viewer-panel-border, rgba(255,255,255,.1)); border-radius: 8px;
    padding: 8px; background: var(--viewer-panel, #121922); color: inherit;
  }
  .motion-panel__point-actions { display: flex; gap: 4px; }
  .motion-panel__point-actions button {
    width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--viewer-panel-border, rgba(255,255,255,.1));
    border-radius: 8px; background: transparent; color: var(--viewer-muted, #9aa6b2); cursor: pointer;
  }
  .motion-panel__point-actions :global(svg) { width: 14px; height: 14px; }
  .motion-panel__capture { display: flex; justify-content: flex-end; }
  .motion-panel__capture :global(svg) { width: 15px; height: 15px; }
  @media (max-width: 430px) { .motion-panel__capture button { width: 100%; } }
</style>
