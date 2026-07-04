<script lang="ts" module>
  import type { RendererCapabilities } from '../core/types/renderer';
  
  /**
   * VideoRenderer capabilities
   * Does not support zoom, filters, or rotation but is interactive
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
  import type { ResolvedAnnotation } from '../iiif/annotationResolver';
  import type { MediaSource } from '../iiif/mediaResolver';
  import type { MediaTextTrack } from '../iiif/avResolver';

  interface Props {
    source?: MediaSource | null;
    annotations?: ResolvedAnnotation[];
    highlightIds?: string[];
    captionTracks?: MediaTextTrack[];
    startTime?: number | null;
    endTime?: number | null;
    onmediaplay?: (payload: { time: number }) => void;
    onmediapause?: (payload: { time: number }) => void;
    onmediatimeupdate?: (payload: { time: number; duration?: number }) => void;
    onmediaseek?: (payload: { from: number; to: number }) => void;
    onmediasegmentend?: () => void;
  }

  let {
    source = null,
    annotations = [],
    highlightIds = [],
    captionTracks = [],
    startTime = $bindable(null),
    endTime = $bindable(null),
    onmediaplay = undefined,
    onmediapause = undefined,
    onmediatimeupdate = undefined,
    onmediaseek = undefined,
    onmediasegmentend = undefined,
  }: Props = $props();

  let player: HTMLVideoElement | null = $state(null);
  let lastTime = $state(0);
  let raf: number | null = null;
  let pendingSeek: number | null = $state(null);
  let startAppliedKey = $state('');
  let sourceKey = $state('');
  let segmentMonitoring = $state(false);

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

  export const setMediaSegment = (start: number, end: number): void => {
    startTime = start;
    endTime = end;
    seekTo(start);
  };

  const tick = () => {
    if (!player) return;
    const time = player.currentTime;
    
    // Check if we've reached the segment end time
    if (segmentMonitoring && endTime != null && time >= endTime) {
      segmentMonitoring = false;
      player.pause();
      onmediasegmentend?.();
      return; // Don't continue ticking after segment end
    }
    
    if (Math.abs(time - lastTime) > 0.2) {
      lastTime = time;
      onmediatimeupdate?.({ time, duration: player.duration });
    }
    raf = requestAnimationFrame(tick);
  };

  const handlePlay = () => {
    if (!player) return;
    onmediaplay?.({ time: player.currentTime });
    // Enable segment monitoring when playback starts if endTime is set
    if (endTime != null) {
      segmentMonitoring = true;
    }
    if (!raf) {
      raf = requestAnimationFrame(tick);
    }
  };

  const handlePause = () => {
    if (!player) return;
    onmediapause?.({ time: player.currentTime });
    segmentMonitoring = false;
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
      segmentMonitoring = false;
    }
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
  });
</script>

<div class="media media--video">
  {#if source}
    <video
      class="media__player"
      bind:this={player}
      src={source.src}
      poster={source.poster}
      controls
      playsinline
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
    >
      <track
        kind="captions"
        srclang="en"
        label="Captions not provided"
        src="data:text/vtt,WEBVTT"
        default={captionTracks.length === 0}
      />
      {#if captionTracks.length > 0}
        {#each captionTracks as track}
          <track
            kind={track.kind ?? 'captions'}
            src={track.src}
            srclang={track.language}
            label={track.label}
            default={track.default}
          />
        {/each}
      {/if}
    </video>
  {:else}
    <div class="media__placeholder">{$t('renderers.video.noSource')}</div>
  {/if}

  {#if source && cues().length > 0}
    <div class="media__cues">
      <div class="media__cues-title">{$t('renderers.video.cuesTitle')}</div>
      <ul class="media__cues-list">
        {#each cues() as cue}
          <li>
            <button
              class:media__cues-button--hit={highlightIds.includes(cue.id)}
              class="media__cues-button"
              type="button"
              onclick={() => applySeek(cue.time?.start ?? 0)}
            >
              {cue.text || $t('renderers.video.cueFallback')} ({cue.time?.start}s)
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

  .media__player {
    width: 100%;
    height: 65vh;
    border-radius: 16px;
    background: var(--viewer-stage, #111720);
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
