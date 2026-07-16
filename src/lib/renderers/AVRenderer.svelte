<script lang="ts" module>
  import type { RendererCapabilities } from '../core/types/renderer';

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
  import '@mango-iiif/av/player';
  import type {
    AVPlayerController,
    MangoAVPlayerElement,
  } from '@mango-iiif/av';

  interface Props {
    controller: AVPlayerController;
    onmediaplay?: (payload: { time: number }) => void;
    onmediapause?: (payload: { time: number }) => void;
    onmediatimeupdate?: (payload: { time: number; duration?: number }) => void;
    onmediaseek?: (payload: { from: number; to: number }) => void;
    onmediasegmentend?: () => void;
  }

  let {
    controller,
    onmediaplay,
    onmediapause,
    onmediatimeupdate,
    onmediaseek,
    onmediasegmentend,
  }: Props = $props();

  let playerElement: MangoAVPlayerElement | null = $state(null);
  let segment: { start: number; end: number } | null = null;
  let segmentEnded = false;

  const HIDDEN_NAVIGATION_STYLE_ID = 'mango-av-hidden-navigation';

  const hidePackageNavigation = (element: MangoAVPlayerElement): void => {
    const root = element.shadowRoot;
    if (!root || root.getElementById(HIDDEN_NAVIGATION_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = HIDDEN_NAVIGATION_STYLE_ID;
    style.textContent = `
      button[data-action='previous'],
      button[data-action='next'],
      label:has(input[data-action='auto-advance']) {
        display: none !important;
      }
    `;
    root.append(style);
  };

  $effect(() => {
    const element = playerElement;
    if (!element) return;
    element.controller = controller;
    hidePackageNavigation(element);

    const observer = new MutationObserver(() => hidePackageNavigation(element));
    if (element.shadowRoot) {
      observer.observe(element.shadowRoot, { childList: true, subtree: true });
    }
    return () => observer.disconnect();
  });

  $effect(() => {
    const activeController = controller;
    const unsubscribers = [
      activeController.on('av-play', ({ detail }) => {
        segmentEnded = false;
        onmediaplay?.({ time: detail.time });
      }),
      activeController.on('av-pause', ({ detail }) => {
        onmediapause?.({ time: detail.time });
      }),
      activeController.on('av-timeupdate', ({ detail }) => {
        onmediatimeupdate?.({ time: detail.time, duration: detail.duration });
        if (!segment || segmentEnded || detail.time < segment.end) return;
        segmentEnded = true;
        activeController.pause();
        onmediasegmentend?.();
      }),
      activeController.on('av-seek', ({ detail }) => {
        segmentEnded = false;
        onmediaseek?.({ from: detail.from, to: detail.to });
      }),
      activeController.on('av-canvaschange', () => {
        segment = null;
        segmentEnded = false;
      }),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  });

  export const start = (): void => {
    const startTime = segment?.start ?? controller.source?.segment?.start ?? 0;
    controller.seekTo(startTime);
    void controller.play();
  };

  export const play = (): void => {
    void controller.play();
  };

  export const pause = (): void => controller.pause();

  export const stop = (): void => controller.stop();

  export const seekBy = (delta: number): void => controller.seekBy(delta);

  export const seekTo = (time: number): void => controller.seekTo(time);

  export const setMediaSegment = (start: number, end: number): void => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    segment = { start, end };
    segmentEnded = false;
    controller.seekTo(start);
  };

</script>

<div class="av-renderer">
  <mango-av-player bind:this={playerElement}></mango-av-player>
</div>

<style>
  .av-renderer {
    box-sizing: border-box;
    display: grid;
    min-height: 100%;
    width: 100%;
    place-items: center;
    padding: 12px;
  }

  mango-av-player {
    display: block;
    width: min(100%, 1200px);
    --mango-av-accent: var(--viewer-accent, #e07a3f);
    --mango-av-accent-contrast: #fff;
    --mango-av-background: var(--viewer-stage, #111720);
    --mango-av-surface: var(--viewer-panel, #121922);
    --mango-av-text: var(--viewer-text, #e8edf4);
    --mango-av-muted: var(--viewer-muted, #9aa6b2);
    --mango-av-border: var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    --mango-av-radius: 1rem;
    --media-primary-color: var(--viewer-text, #e8edf4);
    --media-secondary-color: var(--viewer-stage, #111720);
  }
</style>
