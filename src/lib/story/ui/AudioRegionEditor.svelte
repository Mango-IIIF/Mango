<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import WaveSurfer from "wavesurfer.js";
  import RegionsPlugin, {
    type Region,
  } from "wavesurfer.js/dist/plugins/regions.esm.js";
  import { t, translate } from '../../core/i18n';

  export let url = "";
  export let start = 0;
  export let end = 0;
  export let duration = 0;
  export let disabled = false;
  export let label: string | undefined = undefined;
  export let testId = "audio-region-editor";
  export let onChange: (
    start: number,
    end: number,
    committed: boolean,
  ) => void = () => {};
  export let onReady: (duration: number) => void = () => {};
  export let onPlayStateChange: (playing: boolean) => void = () => {};

  let container: HTMLDivElement;
  let waveSurfer: WaveSurfer | null = null;
  let regions: RegionsPlugin | null = null;
  let region: Region | null = null;
  let loadedUrl = "";
  let readyDuration = 0;
  let loading = false;
  let loadError = "";
  let syncingRegion = false;
  let destroyed = false;
  let regionSyncKey = "";
  let zoomPxPerSec = 0;
  let autoZoomed = false;

  const centerSelection = () => {
    if (!waveSurfer || !region || zoomPxPerSec <= 0) return;
    const visibleDuration = container.clientWidth / zoomPxPerSec;
    const midpoint = region.start + (region.end - region.start) / 2;
    waveSurfer.setScrollTime(Math.max(0, midpoint - visibleDuration / 2));
  };

  const applyZoom = (nextZoom: number, center = true) => {
    if (!waveSurfer || readyDuration <= 0) return;
    zoomPxPerSec = Math.max(0, nextZoom);
    waveSurfer.zoom(zoomPxPerSec);
    if (center && zoomPxPerSec > 0) requestAnimationFrame(centerSelection);
  };

  const zoomToSelection = () => {
    if (!region || readyDuration <= 0) return;
    const selectionDuration = Math.max(0.1, region.end - region.start);
    const targetZoom = Math.max(
      2,
      Math.min(50, container.clientWidth / (selectionDuration * 5)),
    );
    applyZoom(targetZoom);
  };

  const clampSelection = (nextDuration = readyDuration || duration) => {
    const maximum = Math.max(0, nextDuration);
    const safeStart = Math.max(
      0,
      Math.min(Number.isFinite(start) ? start : 0, maximum),
    );
    const fallbackEnd = maximum || safeStart + 0.1;
    const safeEnd = Math.max(
      safeStart + Math.min(0.1, Math.max(0, maximum - safeStart)),
      Math.min(
        Number.isFinite(end) && end > safeStart ? end : fallbackEnd,
        maximum || fallbackEnd,
      ),
    );
    return { start: safeStart, end: safeEnd };
  };

  const createRegion = (nextDuration = readyDuration) => {
    if (!regions || nextDuration <= 0) return;
    readyDuration = nextDuration;
    regions.clearRegions();
    const selection = clampSelection(nextDuration);
    region = regions.addRegion({
      id: "chapter-waveform-selection",
      start: selection.start,
      end: selection.end,
      drag: !disabled,
      resize: !disabled,
      minLength: Math.min(0.1, nextDuration),
      content: translate('storyBuilder.audio.chapterSelection'),
      color: "rgba(224, 122, 63, 0.32)",
    });
    if (
      !autoZoomed &&
      nextDuration > 300 &&
      selection.end - selection.start < nextDuration * 0.04
    ) {
      autoZoomed = true;
      requestAnimationFrame(zoomToSelection);
    }
  };

  const syncRegion = () => {
    if (!region || readyDuration <= 0 || syncingRegion) return;
    const selection = clampSelection(readyDuration);
    if (
      Math.abs(region.start - selection.start) < 0.005 &&
      Math.abs(region.end - selection.end) < 0.005 &&
      region.drag === !disabled &&
      region.resize === !disabled
    ) {
      return;
    }
    syncingRegion = true;
    region.setOptions({
      start: selection.start,
      end: selection.end,
      drag: !disabled,
      resize: !disabled,
    });
    syncingRegion = false;
  };

  const loadMedia = async (nextUrl: string) => {
    if (!waveSurfer || nextUrl === loadedUrl) return;
    loadedUrl = nextUrl;
    region = null;
    regions?.clearRegions();
    readyDuration = 0;
    zoomPxPerSec = 0;
    autoZoomed = false;
    loadError = "";
    if (!nextUrl) {
      loading = false;
      waveSurfer.empty();
      return;
    }
    loading = true;
    try {
      await waveSurfer.load(nextUrl);
    } catch (error) {
      if (destroyed || loadedUrl !== nextUrl) return;
      loading = false;
      loadError =
        error instanceof Error
          ? error.message
          : translate('storyBuilder.audio.loadError');
    }
  };

  export const playSelection = async (): Promise<boolean> => {
    if (!waveSurfer || !region || loading || loadError) return false;
    try {
      await waveSurfer.play(region.start, region.end);
      return true;
    } catch {
      return false;
    }
  };

  export const stop = () => waveSurfer?.pause();
  export const getCurrentTime = () => waveSurfer?.getCurrentTime() ?? 0;

  onMount(() => {
    // WaveSurfer uses matchMedia for pointer capability detection. jsdom and a few
    // embedded webviews omit it, so provide the inert shape the library expects.
    if (typeof globalThis.matchMedia !== "function") {
      globalThis.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof globalThis.matchMedia;
    }
    regions = RegionsPlugin.create();
    waveSurfer = WaveSurfer.create({
      container,
      height: 64,
      waveColor: "rgba(160, 175, 188, 0.55)",
      progressColor: "#e07a3f",
      cursorColor: "#ffb184",
      cursorWidth: 1,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      dragToSeek: true,
      hideScrollbar: false,
      plugins: [regions],
    });

    waveSurfer.on("decode", (nextDuration) => {
      createRegion(nextDuration);
      onReady(nextDuration);
    });
    waveSurfer.on("ready", (nextDuration) => {
      loading = false;
      loadError = "";
      if (!region) {
        createRegion(nextDuration);
        onReady(nextDuration);
      }
    });
    waveSurfer.on("error", (error) => {
      loading = false;
      loadError = error.message || translate('storyBuilder.audio.loadError');
    });
    waveSurfer.on("play", () => onPlayStateChange(true));
    waveSurfer.on("pause", () => onPlayStateChange(false));
    waveSurfer.on("finish", () => onPlayStateChange(false));
    regions.on("region-update", (updatedRegion) => {
      if (!syncingRegion)
        onChange(updatedRegion.start, updatedRegion.end, false);
    });
    regions.on("region-updated", (updatedRegion) => {
      if (!syncingRegion)
        onChange(updatedRegion.start, updatedRegion.end, true);
    });
    void loadMedia(url.trim());
  });

  $: if (waveSurfer && url.trim() !== loadedUrl) void loadMedia(url.trim());
  $: regionSyncKey = `${start}:${end}:${duration}:${disabled ? "1" : "0"}`;
  $: if (region && regionSyncKey) syncRegion();

  onDestroy(() => {
    destroyed = true;
    waveSurfer?.destroy();
    waveSurfer = null;
    regions = null;
    region = null;
  });
</script>

<div class="audio-region" data-testid={testId} aria-label={label ?? $t('storyBuilder.audio.waveformSelection')}>
  {#if readyDuration > 0}
    <div class="audio-region__zoom" aria-label={$t('storyBuilder.audio.zoomControls')}>
      <button type="button" on:click={() => applyZoom(0)}>{$t('storyBuilder.audio.fitMedia')}</button
      >
      <label>
        <span>{$t('storyBuilder.audio.zoom')}</span>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={zoomPxPerSec}
          aria-label={$t('storyBuilder.audio.waveformZoom')}
          on:input={(event) =>
            applyZoom(Number((event.currentTarget as HTMLInputElement).value))}
        />
      </label>
      <button type="button" on:click={zoomToSelection}>{$t('storyBuilder.audio.showSelection')}</button>
    </div>
  {/if}
  <div class="audio-region__wave" bind:this={container}></div>
  {#if !url}
    <span class="audio-region__message"
      >{$t('storyBuilder.audio.addUrl')}</span
    >
  {:else if loading}
    <span class="audio-region__message">{$t('storyBuilder.audio.loading')}</span>
  {:else if loadError}
    <span class="audio-region__message audio-region__message--error"
      >{$t('storyBuilder.audio.unavailable')}</span
    >
  {/if}
</div>

<style>
  .audio-region {
    position: relative;
    min-width: 0;
    min-height: 64px;
    overflow: hidden;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--viewer-well-bg, rgba(5, 10, 16, 0.42));
  }
  .audio-region__wave {
    min-height: 64px;
  }
  .audio-region__zoom {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid
      var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
  }
  .audio-region__zoom label {
    min-width: 130px;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 7px;
  }
  .audio-region__zoom input {
    width: 100%;
    accent-color: var(--accent, var(--story-builder-accent, #e07a3f));
  }
  .audio-region__zoom button {
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    border-radius: 6px;
    padding: 5px 7px;
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 4%, transparent);
    color: var(--viewer-text, #e8edf4);
    font: inherit;
    cursor: pointer;
  }
  .audio-region__wave :global(::part(region)) {
    border-right: 2px solid var(--story-builder-accent-hover, #ffb184);
    border-left: 2px solid var(--story-builder-accent-hover, #ffb184);
    background: color-mix(in srgb, var(--story-builder-accent, #e07a3f) 32%, transparent) !important;
    z-index: 4 !important;
  }
  .audio-region__wave :global(::part(region-content)) {
    padding: 3px 6px;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
    pointer-events: none;
  }
  .audio-region__wave :global(::part(region-handle-left)),
  .audio-region__wave :global(::part(region-handle-right)) {
    width: 8px !important;
    border-color: var(--story-builder-accent-hover, #ffb184) !important;
  }
  .audio-region__message {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 8px;
    color: var(--viewer-muted, #9aa6b2);
    background: var(--viewer-well-bg, rgba(5, 10, 16, 0.4));
    font-size: 10px;
    pointer-events: none;
  }
  .audio-region__message--error {
    color: var(--viewer-danger, #f2b4a9);
  }
</style>
