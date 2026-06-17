<script lang="ts" module>
  import type { RendererCapabilities } from '../core/types/renderer';
  
  /**
   * AudioRenderer capabilities
   * Does not support visual features but is interactive (play/pause controls)
   */
  export const capabilities: RendererCapabilities = {
    supportsZoom: false,
    supportsFilters: false,
    supportsPan: false,
    supportsViewBox: false,
    supportsRotation: false,
    isInteractive: true,
  };
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '../i18n';
  import OSDViewer from './OSDViewer.svelte';
  import type { ResolvedAnnotation } from '../iiif/annotationResolver';
  import type { MediaSource, TileSource } from '../iiif/mediaResolver';

  interface Props {
    source?: MediaSource | null;
    annotations?: ResolvedAnnotation[];
    highlightIds?: string[];
    accompanyingSource?: MediaSource | null;
    startTime?: number | null;
    onmediaplay?: ((payload: { time: number }) => void) | undefined;
    onmediapause?: ((payload: { time: number }) => void) | undefined;
    onmediatimeupdate?: ((payload: { time: number; duration?: number }) => void) | undefined;
    onmediaseek?: ((payload: { from: number; to: number }) => void) | undefined;
  }

  let {
    source = null,
    annotations = [],
    highlightIds = [],
    accompanyingSource = null,
    startTime = null,
    onmediaplay = undefined,
    onmediapause = undefined,
    onmediatimeupdate = undefined,
    onmediaseek = undefined
  }: Props = $props();

  let player: HTMLAudioElement | null = $state(null);
  let lastTime = $state(0);
  let raf: number | null = null;
  let pendingSeek: number | null = $state(null);
  let startAppliedKey = $state('');
  let sourceKey = $state('');
  let accompanyingTileSource: TileSource | null = $derived(
    accompanyingSource
      ? accompanyingSource.src.endsWith('info.json')
        ? accompanyingSource.src
        : { type: 'image', url: accompanyingSource.src }
      : null,
  );

  const cues = () =>
    annotations.filter((annotation) => annotation.time && annotation.time.start != null);

  const applySeek = (time: number) => {
    if (!player) return;
    const next = clampTime(time);
    const from = player.currentTime;
    player.currentTime = next;
    onmediaseek?.({ from, to: next });
  };

  const clampTime = (time: number) => {
    if (!player) return time;
    const duration = Number.isFinite(player.duration) ? player.duration : null;
    if (duration != null) {
      return Math.min(Math.max(0, time), duration);
    }
    return Math.max(0, time);
  };

  export const start = (): void => {
    if (!player) return;
    const target = startTime != null ? startTime : 0;
    applySeek(target);
    player.play?.();
  };

  export const play = (): void => {
    player?.play?.();
  };

  export const pause = (): void => {
    player?.pause?.();
  };

  export const stop = (): void => {
    if (!player) return;
    player.pause();
    player.currentTime = 0;
  };

  export const seekBy = (delta: number): void => {
    if (!player) return;
    applySeek(clampTime(player.currentTime + delta));
  };

  export const seekTo = (time: number): void => {
    if (!player) return;
    if (Number.isFinite(player.duration)) {
      applySeek(time);
    } else {
      pendingSeek = time;
    }
  };

  const tick = () => {
    if (!player) return;
    const time = player.currentTime;
    if (Math.abs(time - lastTime) > 0.2) {
      lastTime = time;
      onmediatimeupdate?.({ time, duration: player.duration });
    }
    raf = requestAnimationFrame(tick);
  };

  const handlePlay = () => {
    if (!player) return;
    onmediaplay?.({ time: player.currentTime });
    if (!raf) {
      raf = requestAnimationFrame(tick);
    }
  };

  const handlePause = () => {
    if (!player) return;
    onmediapause?.({ time: player.currentTime });
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  };

  const handleLoadedMetadata = () => {
    if (!player) return;
    if (pendingSeek != null) {
      const next = pendingSeek;
      pendingSeek = null;
      applySeek(next);
      return;
    }
    if (startTime != null && source) {
      const key = `${source.src}:${startTime}`;
      if (startAppliedKey !== key) {
        startAppliedKey = key;
        applySeek(startTime);
      }
    }
  };

  $effect(() => {
    if (source?.src && source.src !== sourceKey) {
      sourceKey = source.src;
      pendingSeek = null;
      startAppliedKey = '';
    }
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
  });
</script>

<div class:media--with-accompanying={Boolean(accompanyingTileSource)} class="media media--audio">
  {#if accompanyingTileSource}
    <div class="media__accompanying" aria-label={$t('renderers.audio.accompanyingLabel')}>
      <OSDViewer
        tileSource={accompanyingTileSource}
        annotations={[]}
        highlightIds={[]}
        activeAnnotationId={null}
        hoverAnnotationId={null}
      />
    </div>
  {/if}

  {#if source}
    <audio
      class="media__player"
      bind:this={player}
      src={source.src}
      controls
      onplay={handlePlay}
      onpause={handlePause}
      onloadedmetadata={handleLoadedMetadata}
      onseeked={() => {
        if (player) {
          const from = lastTime;
          lastTime = player.currentTime;
          onmediaseek?.({ from, to: player.currentTime });
        }
      }}
    ></audio>
  {:else}
    <div class="media__placeholder">{$t('renderers.audio.noSource')}</div>
  {/if}

  {#if source && cues().length > 0}
    <div class="media__cues">
      <div class="media__cues-title">{$t('renderers.audio.cuesTitle')}</div>
      <ul class="media__cues-list">
        {#each cues() as cue}
          <li>
            <button
              class:media__cues-button--hit={highlightIds.includes(cue.id)}
              class="media__cues-button"
              type="button"
              onclick={() => applySeek(cue.time?.start ?? 0)}
            >
              {cue.text || $t('renderers.audio.cueFallback')} ({cue.time?.start}s)
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .media {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .media--with-accompanying {
    grid-template-rows: minmax(0, 1fr) auto auto;
  }

  .media__accompanying {
    border-radius: 16px;
    overflow: hidden;
    background: var(--viewer-stage, #111720);
    min-height: 286px;
  }

  .media__player {
    width: 100%;
  }

  .media__placeholder {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }

  .media__cues {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(10, 14, 19, 0.6);
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    font-size: 12px;
    max-height: 160px;
    overflow: auto;
  }

  .media__cues-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--viewer-muted, #9aa6b2);
    margin-bottom: 6px;
  }

  .media__cues-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  .media__cues-button {
    width: 100%;
    text-align: left;
    border: none;
    border-radius: 10px;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--viewer-text, #e8edf4);
    font-size: 12px;
    cursor: pointer;
  }

  .media__cues-button--hit {
    background: rgba(42, 199, 255, 0.25);
  }
</style>
