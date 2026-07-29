<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    currentChapterIndex?: number;
    totalChapters?: number;
    chapterThumbnails?: Array<string | null>;
    chapterDurationSec?: number;
    chapterElapsedSec?: number;
    chapterTitle?: string;
    chapterDescription?: string;
    disabled?: boolean;
    loading?: boolean;
    error?: string | null;
    playState?: 'idle' | 'playing' | 'paused';
    onplay?: () => void;
    onpause?: () => void;
    onstop?: () => void;
    onselectChapter?: (payload: { index: number }) => void;
    onzoomIn?: () => void;
    onzoomOut?: () => void;
    onfit?: () => void;
    onrefresh?: () => void;
    onpreviousChapter?: () => void;
    onnextChapter?: () => void;
    stage?: Snippet;
  }

  let {
    currentChapterIndex = 0,
    totalChapters = 0,
    chapterThumbnails = [],
    chapterDurationSec = 0,
    chapterElapsedSec = 0,
    chapterTitle = '',
    chapterDescription = '',
    disabled = false,
    loading = false,
    error = null,
    playState = 'idle',
    onplay = undefined,
    onpause = undefined,
    onstop: _onstop = undefined,
    onselectChapter = undefined,
    onzoomIn: _onzoomIn = undefined,
    onzoomOut: _onzoomOut = undefined,
    onfit: _onfit = undefined,
    onrefresh: _onrefresh = undefined,
    onpreviousChapter = undefined,
    onnextChapter = undefined,
    stage = undefined,
  }: Props = $props();

  const chapterThumbnailPalette = [
    '#d4b487',
    '#bb9a72',
    '#7f9f80',
    '#b5a089',
    '#d8be99',
    '#d2b48a',
    '#ccb188',
    '#d9c09a',
    '#bfa684',
    '#dac5a3',
    '#d0b896',
    '#cdb08a',
  ];

  const chapterCount = () => Math.max(0, totalChapters);

  const safeActiveIndex = () => {
    const count = chapterCount();
    if (count === 0) return 0;
    return Math.min(Math.max(currentChapterIndex, 0), count - 1);
  };

  const formatTime = (seconds: number) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  let safeChapterDuration = $derived(Math.max(0, chapterDurationSec));
  let safeChapterElapsed = $derived(Math.min(Math.max(0, chapterElapsedSec), safeChapterDuration));
  let timelineProgressPercent = $derived(
    safeChapterDuration > 0 ? (safeChapterElapsed / safeChapterDuration) * 100 : 0,
  );

  const handlePlayToggle = () => {
    if (disabled || loading) return;
    if (playState === 'playing') {
      onpause?.();
      return;
    }
    onplay?.();
  };

  const selectChapter = (index: number) => {
    if (disabled || loading) return;
    const count = chapterCount();
    if (count === 0) return;
    const clamped = Math.min(Math.max(index, 0), count - 1);
    onselectChapter?.({ index: clamped });
  };

  const chapterNumber = (index: number) => index + 1;
  let chapterIndices = $derived(
    Array.from({ length: Math.max(0, totalChapters) }, (_, index) => index),
  );
  let brokenThumbnailUrls = $state(new Set<string>());

  const markThumbnailBroken = (src: string | null | undefined) => {
    if (!src) return;
    brokenThumbnailUrls = new Set([...brokenThumbnailUrls, src]);
  };

  const canRenderThumbnail = (src: string | null | undefined) =>
    Boolean(src) && !brokenThumbnailUrls.has(src ?? '');

  let footerRef = $state<HTMLElement | null>(null);
  let metadataExpanded = $state(false);
  let expandedChapterIndex = $state(-1);
  // Keep the full text reachable on narrow phones as well as tablets. Around
  // 96 characters is where the two-line phone summary commonly starts to
  // clamp, while the control remains unobtrusive for genuinely short copy.
  const hasExpandableMetadata = () => chapterDescription.trim().length > 96;

  $effect(() => {
    if (expandedChapterIndex !== currentChapterIndex) {
      expandedChapterIndex = currentChapterIndex;
      metadataExpanded = false;
    }
  });

  $effect(() => {
    const activeIndex = safeActiveIndex();
    if (!footerRef) return;

    // Select the active chapter element (the buttons are children of the footer)
    const activeBtn = footerRef.children[activeIndex] as HTMLElement | undefined;
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  });
</script>

<div
  class="story-shell"
  class:story-shell--metadata-expanded={metadataExpanded}
  data-testid="story-controls-stage"
>
  <div class="story-shell__body">
    <section class="story-shell__stage-wrap">
      <div class="story-shell__stage-frame">
        {#if stage}
          {@render stage()}
        {/if}
      </div>
    </section>

    <aside class="story-shell__sidebar">
      <div class="story-shell__metadata">
        <p class="story-shell__chapter-label">
          {#if loading}
            <span class="story-shell__loading">
              <span class="story-shell__spinner"></span>
              Loading chapter...
            </span>
          {:else}
            Chapter {safeActiveIndex() + 1} of {chapterCount()}
          {/if}
        </p>
        <h2 class="story-shell__title">{chapterTitle}</h2>
        <div class="story-shell__accent" aria-hidden="true"></div>
        {#if chapterDescription}
          <p
            class="story-shell__description"
            class:story-shell__description--expanded={metadataExpanded}
          >
            {chapterDescription}
          </p>
          {#if hasExpandableMetadata()}
            <button
              type="button"
              class="story-shell__metadata-toggle"
              aria-expanded={metadataExpanded}
              onclick={() => (metadataExpanded = !metadataExpanded)}
            >
              {metadataExpanded ? 'Show less' : 'Show more'}
            </button>
          {/if}
        {/if}
      </div>

      <div class="story-shell__playback">
        <div class="story-shell__transport">
          <button
            type="button"
            class="story-shell__transport-btn"
            disabled={disabled || loading}
            aria-label="Previous chapter"
            onclick={() => onpreviousChapter?.()}
          >
            &#9664;
          </button>
          <button
            type="button"
            class="story-shell__play-btn"
            class:story-shell__play-btn--active={playState === 'playing'}
            data-testid="story-controls-play"
            disabled={disabled || loading}
            aria-label={playState === 'playing' ? 'Pause story' : 'Play story'}
            onclick={handlePlayToggle}
          >
            {#if playState === 'playing'}
              &#10074;&#10074;
            {:else}
              &#9654;
            {/if}
          </button>
          <button
            type="button"
            class="story-shell__transport-btn"
            disabled={disabled || loading}
            aria-label="Next chapter"
            onclick={() => onnextChapter?.()}
          >
            &#9654;
          </button>
        </div>

        <div class="story-shell__timeline">
          <div class="story-shell__timeline-track" aria-hidden="true">
            <div
              class="story-shell__timeline-fill"
              style={`width: ${timelineProgressPercent}%;`}
            ></div>
            <div
              class="story-shell__timeline-thumb"
              style={`left: clamp(6px, ${timelineProgressPercent}%, calc(100% - 6px));`}
            ></div>
          </div>
          <div class="story-shell__timeline-text">
            {formatTime(Math.floor(safeChapterElapsed))} / {formatTime(
              Math.floor(safeChapterDuration),
            )}
          </div>
        </div>
      </div>
    </aside>
  </div>

  <nav
    bind:this={footerRef}
    class="story-shell__footer"
    aria-label="Story chapters"
    data-testid="story-controls-pagination"
  >
    {#each chapterIndices as index}
      <button
        type="button"
        class="story-shell__chapter"
        class:story-shell__chapter--active={index === safeActiveIndex()}
        aria-current={index === safeActiveIndex() ? 'page' : undefined}
        disabled={disabled || loading}
        data-testid={`story-controls-page-${index + 1}`}
        onclick={() => selectChapter(index)}
      >
        <span class="story-shell__chapter-thumb">
          {#if canRenderThumbnail(chapterThumbnails[index])}
            <img
              src={chapterThumbnails[index] ?? ''}
              alt={`Chapter ${chapterNumber(index)} thumbnail`}
              loading="eager"
              onerror={() => markThumbnailBroken(chapterThumbnails[index])}
            />
          {:else}
            <span
              class="story-shell__chapter-fallback"
              style={`background: linear-gradient(140deg, ${chapterThumbnailPalette[index % chapterThumbnailPalette.length]}, #eadac4);`}
              aria-hidden="true"
            ></span>
          {/if}
        </span>
        <span class="story-shell__chapter-number">
          {chapterNumber(index)}
        </span>
        <span
          class="story-shell__dot"
          class:story-shell__dot--active={index === safeActiveIndex()}
          aria-hidden="true"
        ></span>
      </button>
    {/each}
  </nav>

  {#if error}
    <div class="story-shell__error" data-testid="story-controls-error">
      {error}
    </div>
  {/if}
</div>

<style>

  .story-shell {
    --story-bg: #07101e;
    --story-line: rgba(255, 255, 255, 0.14);
    --story-text: #edf5ff;
    --story-muted: #d8dee9;
    --story-accent: #9a57ff;
    --story-accent-2: #4bc6ff;

    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto;
    gap: 0;
    height: 100%;
    min-height: 0;
    min-width: 0;
    padding: 0;
    border-radius: var(--story-shell-radius, 18px);
    background: linear-gradient(180deg, #10161e 0%, #0b1118 100%);
    border: 0;
    overflow: hidden;
  }

  .story-shell__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
    gap: 0;
    min-height: 0;
    overflow: hidden;
  }

  .story-shell__sidebar {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
    border-left: 1px solid var(--story-line);
  }

  .story-shell__chapter-label {
    margin: 0;
    color: #be8dff;
    font-size: 19px;
    font-weight: 600;
  }

  .story-shell__title {
    margin: 10px 0 10px;
    font-size: clamp(32px, 2.6cqw, 58px);
    line-height: 1.03;
    color: var(--story-text);
    font-family: Georgia, 'Times New Roman', serif;
  }

  .story-shell__accent {
    width: 70px;
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--story-accent), #b87fff);
    margin-bottom: 14px;
  }

  .story-shell__description {
    margin: 0 0 18px;
    color: var(--story-muted);
    font-size: clamp(15px, 1.15cqw, 20px);
    line-height: 1.55;
  }

  .story-shell__metadata-toggle {
    margin: 2px 0 0;
    padding: 6px 0;
    border: 0;
    background: transparent;
    color: #be8dff;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .story-shell__metadata-toggle:hover,
  .story-shell__metadata-toggle:focus-visible {
    color: #d8bcff;
    text-decoration: underline;
  }

  .story-shell__playback {
    margin-top: auto;
    padding-top: 24px;
    flex-shrink: 0;
  }

  .story-shell__transport {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .story-shell__transport-btn,
  .story-shell__play-btn {
    border: 1px solid rgba(255, 255, 255, 0.24);
    background: rgba(8, 17, 32, 0.6);
    color: var(--story-text);
    border-radius: 999px;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .story-shell__transport-btn {
    width: 46px;
    height: 46px;
  }

  .story-shell__play-btn {
    width: 66px;
    height: 66px;
    font-size: 19px;
    border-color: rgba(148, 83, 255, 0.88);
    box-shadow:
      0 0 0 6px rgba(115, 62, 222, 0.2),
      0 10px 24px rgba(72, 28, 166, 0.4);
  }

  .story-shell__play-btn--active {
    background: radial-gradient(circle at 32% 25%, #b58aff 0%, #8a44ff 72%);
  }

  .story-shell__timeline {
    margin-top: 12px;
  }

  .story-shell__timeline-track {
    position: relative;
    width: 100%;
    height: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.15);
    overflow: hidden;
  }

  .story-shell__timeline-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 0%;
    border-radius: 999px;
    background: linear-gradient(90deg, #8b45ff 0%, #b276ff 100%);
    transition: width 120ms linear;
  }

  .story-shell__timeline-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: #c69dff;
    box-shadow: 0 0 0 3px rgba(139, 69, 255, 0.26);
    transform: translate(-50%, -50%);
    transition: left 120ms linear;
  }

  .story-shell__timeline-text {
    margin-top: 4px;
    text-align: right;
    font-size: 12px;
    color: #d0dcf0;
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
  }

  .story-shell__stage-wrap {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .story-shell__stage-frame {
    position: relative;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    border-radius: 0;
    overflow: hidden;
    background: transparent;
  }

  .story-shell__stage-frame :global(.stage__story-slot),
  .story-shell__stage-frame :global(.stage) {
    height: 100%;
    min-height: 100%;
    overflow: hidden;
  }

  .story-shell__stage-frame :global(.stage__media) {
    height: 100%;
    min-height: 0;
    border: 0;
    border-radius: 0;
  }

  .story-shell__chapter:hover:not(:disabled),
  .story-shell__transport-btn:hover:not(:disabled),
  .story-shell__play-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }

  .story-shell__chapter:disabled,
  .story-shell__transport-btn:disabled,
  .story-shell__play-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .story-shell__footer {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: clamp(68px, 6cqw, 82px);
    gap: 10px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    touch-action: pan-x;
    -webkit-overflow-scrolling: touch;
    align-items: start;
    min-height: 0;
    padding: 12px 12px 10px;
    border-top: 0;
  }

  .story-shell__footer::-webkit-scrollbar {
    display: none;
  }

  .story-shell__chapter {
    border: none;
    background: transparent;
    color: #c6d4ed;
    cursor: pointer;
    font: inherit;
    display: grid;
    justify-items: center;
    padding: 0 0 4px;
  }

  .story-shell__chapter-thumb {
    display: block;
    width: 100%;
    min-height: 66px;
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    overflow: hidden;
  }

  .story-shell__chapter-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .story-shell__chapter-fallback {
    display: block;
    width: 100%;
    height: 100%;
  }

  .story-shell__chapter-number {
    display: block;
    text-align: center;
    margin-top: 6px;
    font-size: 14px;
    color: #cad7ee;
  }

  .story-shell__chapter--active .story-shell__chapter-thumb {
    border-color: rgba(160, 110, 255, 0.95);
    box-shadow:
      0 0 0 2px rgba(64, 171, 245, 0.84) inset,
      0 0 0 1px rgba(227, 240, 255, 0.42);
  }

  .story-shell__chapter--active .story-shell__chapter-number {
    color: #f0e8ff;
  }

  .story-shell__dot {
    display: block;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    margin-top: 5px;
    background: #8f4dff;
    opacity: 0;
    transition: opacity 140ms ease;
  }

  .story-shell__dot--active {
    opacity: 1;
  }

  .story-shell__error {
    color: #ffb3c1;
    font-size: 13px;
  }

  .story-shell__loading {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .story-shell__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(154, 87, 255, 0.3);
    border-top-color: var(--story-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @container mango-viewer (max-width: 1024px) {
    .story-shell {
      grid-template-rows: minmax(0, 1fr) auto auto;
      overflow: hidden;
    }

    .story-shell__body {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(220px, 1fr) auto;
      height: 100%;
      overflow: hidden;
    }

    .story-shell__stage-wrap {
      flex: none;
      min-height: 0;
    }

    .story-shell__sidebar {
      overflow: hidden;
      border-top: 1px solid var(--story-line);
      border-left: 0;
    }

    .story-shell__playback {
      order: -1;
    }

    .story-shell__title {
      font-size: clamp(32px, 8cqw, 48px);
    }

    .story-shell__description {
      font-size: clamp(15px, 3.2cqw, 20px);
    }
  }

  @container mango-viewer (min-width: 701px) and (max-width: 1024px) {
    .story-shell__sidebar {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto;
      padding: 10px 16px 12px;
    }

    .story-shell__playback {
      grid-column: 1;
      grid-row: 1;
      align-self: auto;
      min-width: 0;
      width: 100%;
      margin-top: 0;
      padding: 0 0 8px;
      border-bottom: 1px solid var(--story-line);
    }

    .story-shell__metadata {
      grid-column: 1;
      grid-row: 2;
      min-width: 0;
      padding-top: 10px;
    }

    .story-shell__title {
      margin: 4px 0 6px;
      font-size: clamp(30px, 4cqw, 36px);
    }

    .story-shell__accent {
      margin-bottom: 8px;
    }

    .story-shell__description {
      display: -webkit-box;
      margin: 0;
      overflow: hidden;
      font-size: clamp(14px, 1.8cqw, 18px);
      line-height: 1.4;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .story-shell__play-btn {
      width: 58px;
      height: 58px;
    }

    .story-shell__transport-btn {
      width: 42px;
      height: 42px;
    }

    .story-shell__timeline {
      margin-top: 8px;
    }

    .story-shell__footer {
      grid-auto-columns: 72px;
      padding: 8px 10px 6px;
    }

  }

  @container mango-viewer (max-width: 700px) {
    .story-shell {
      border-radius: min(var(--story-shell-radius, 18px), 14px);
    }

    .story-shell__footer {
      grid-auto-columns: 64px;
      gap: 10px;
      min-height: 0;
      padding-inline: 10px;
    }

    .story-shell__stage-wrap {
      min-height: 0;
    }

    .story-shell__body {
      grid-template-rows: minmax(180px, 1fr) auto;
    }

    .story-shell__sidebar {
      padding: 10px 12px;
    }

    .story-shell__chapter-label {
      font-size: 15px;
    }

    .story-shell__title {
      margin: 4px 0 6px;
      font-size: clamp(27px, 8cqw, 34px);
    }

    .story-shell__accent {
      height: 3px;
      margin-bottom: 7px;
    }

    .story-shell__description {
      display: -webkit-box;
      margin: 0 0 7px;
      overflow: hidden;
      font-size: 14px;
      line-height: 1.35;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .story-shell__playback {
      order: -1;
      margin-top: 0;
      padding: 3px 0 9px;
      border-bottom: 1px solid var(--story-line);
    }

    .story-shell__metadata {
      padding-top: 8px;
    }

    .story-shell__transport {
      gap: 10px;
    }

    .story-shell__play-btn {
      width: 58px;
      height: 58px;
    }

    .story-shell__timeline {
      margin-top: 8px;
    }
  }

  @container mango-viewer (max-width: 1024px) {
    .story-shell__description--expanded {
      display: block;
      overflow: visible;
      -webkit-line-clamp: unset;
    }

    .story-shell--metadata-expanded {
      grid-template-rows: auto auto auto;
      overflow-y: auto;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
    }

    .story-shell--metadata-expanded .story-shell__body {
      grid-template-rows: minmax(260px, 45cqw) auto;
      height: max-content;
      min-height: max-content;
      overflow: visible;
    }

    .story-shell--metadata-expanded .story-shell__sidebar {
      overflow: visible;
    }
  }

  @container mango-viewer (max-height: 500px) {
    .story-shell__body {
      grid-template-columns: minmax(0, 1fr) minmax(280px, 38%);
      grid-template-rows: minmax(0, 1fr);
    }

    .story-shell__stage-wrap {
      grid-column: 1;
      grid-row: 1;
    }

    .story-shell__sidebar {
      grid-column: 2;
      grid-row: 1;
      display: flex;
      padding: 8px 12px;
      border-top: 0;
      border-left: 1px solid var(--story-line);
    }

    .story-shell__chapter-label {
      font-size: 14px;
    }

    .story-shell__title {
      display: -webkit-box;
      margin: 2px 0 4px;
      overflow: hidden;
      font-size: 26px;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .story-shell__accent {
      height: 3px;
      margin-bottom: 5px;
    }

    .story-shell__description {
      display: -webkit-box;
      margin: 0;
      overflow: hidden;
      font-size: 13px;
      line-height: 1.3;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
    }

    .story-shell__description--expanded {
      display: block;
      overflow: visible;
      -webkit-line-clamp: unset;
    }

    .story-shell__playback {
      grid-column: auto;
      grid-row: auto;
      align-self: auto;
      order: initial;
      margin-top: auto;
      padding-top: 2px;
      border-bottom: 0;
    }

    .story-shell__transport-btn {
      width: 38px;
      height: 38px;
    }

    .story-shell__play-btn {
      width: 50px;
      height: 50px;
    }

    .story-shell__timeline {
      margin-top: 5px;
    }

    .story-shell__footer {
      grid-auto-columns: 56px;
      gap: 8px;
      padding: 6px 10px 4px;
    }

    .story-shell__chapter-thumb {
      min-height: 56px;
      border-radius: 10px;
    }

    .story-shell__chapter-number {
      margin-top: 3px;
      font-size: 12px;
    }

    .story-shell__dot {
      margin-top: 2px;
    }
  }
</style>
