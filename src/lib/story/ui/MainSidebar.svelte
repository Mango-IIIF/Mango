<script lang="ts">
  import { readable, type Readable } from 'svelte/store';
  import type { Chapter, StoryState } from '../../core/types/story';
  import { t } from '../../i18n';
  import { fetchManifest, manifestsStore } from '../../state/manifests';
  import { resolveCanvasThumbnail } from '../../viewer/iiif/thumbnails';

  export let story: Readable<StoryState> = readable({
    chapters: [],
  });
  export let selectedChapterId: Readable<string | null> = readable(null);
  export let modelPoseDebug: Readable<string | null> = readable(null);
  export let showDebug = false;
  export let language = 'en';
  export let languages: string[] = ['en'];
  export let sidebarWidth: number | null = null;
  export let disabled = false;
  export let onAddChapter: (() => void) | undefined;
  export let onSelectChapter: ((chapterId: string) => void) | undefined;
  export let onDeleteChapter: ((chapterId: string) => void) | undefined;
  export let onReorderChapter:
    | ((chapterId: string, targetChapterId: string, position?: 'before' | 'after') => void)
    | undefined;
  export let onSaveExport: (() => void) | undefined;
  export let onOpenNarration: (() => void) | undefined;
  export let onPreview: (() => void) | undefined;
  export let onStopPreview: (() => void) | undefined;
  export let isPreviewing: Readable<boolean> = readable(false);
  export let saveState: Readable<{
    status: 'idle' | 'saving' | 'success' | 'error';
    message?: string;
  }> = readable({ status: 'idle' });
  export let errorMessage: string | null = null;

  const labelForChapter = (chapter: Chapter, index: number): string => {
    const title = chapter.title?.[language];
    return title?.trim() ? title.trim() : `Chapter ${index + 1}`;
  };

  const chapterDurationSeconds = (chapter: Chapter): number => {
    const narrationMap = chapter.narrationSegment ?? {};
    const preferredLanguages = [language, ...languages].filter((entry) => entry.trim());
    const preferredNarration = preferredLanguages
      .map((entry) => narrationMap[entry])
      .find((entry) => entry);
    const narrationSegment =
      preferredNarration ??
      (Object.keys(narrationMap).length > 0
        ? narrationMap[Object.keys(narrationMap)[0]]
        : undefined);

    const narrationDuration =
      narrationSegment &&
      Number.isFinite(narrationSegment.start) &&
      Number.isFinite(narrationSegment.end)
        ? Math.max(0, narrationSegment.end - narrationSegment.start)
        : 0;

    const mediaDuration =
      chapter.media &&
      Number.isFinite(chapter.media.start) &&
      Number.isFinite(chapter.media.end)
        ? Math.max(0, chapter.media.end - chapter.media.start)
        : 0;

    if (narrationDuration > 0 || mediaDuration > 0) {
      return narrationDuration + mediaDuration;
    }

    return Math.max(0, (chapter.transitionTimeMs ?? 0) / 1000);
  };

  const formatDuration = (seconds: number): string => {
    const wholeSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const remainingSeconds = wholeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const chapterDurationLabel = (chapter: Chapter): string =>
    formatDuration(chapterDurationSeconds(chapter));

  const resolveChapterThumbnail = (chapter: Chapter, manifestoObject: unknown): string | null => {
    if (!manifestoObject) return null;
    return resolveCanvasThumbnail(manifestoObject, undefined, chapter.canvasIndex);
  };

  let chapterThumbnails: Record<string, string | null> = {};
  $: chapterThumbnails = Object.fromEntries(
    $story.chapters.map((chapter) => [
      chapter.id,
      resolveChapterThumbnail(
        chapter,
        $manifestsStore[chapter.manifest]?.manifesto,
      ),
    ]),
  );

  let activeChapterId: string | null = null;
  $: activeChapterId = $selectedChapterId;

  let poseDebugValue: string | null = null;
  $: poseDebugValue = $modelPoseDebug;

  let saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';
  let saveMessage: string | undefined;
  $: saveStatus = $saveState?.status ?? 'idle';
  $: saveMessage = $saveState?.message;

  let menuChapterId: string | null = null;
  let pendingDeleteChapterId: string | null = null;

  let draggedChapterId: string | null = null;
  let dropTargetChapterId: string | null = null;
  let dropPosition: 'before' | 'after' = 'before';

  let manifestIds: string[] = [];
  $: manifestIds = Array.from(
    new Set(
      $story.chapters
        .map((chapter) => chapter.manifest)
        .filter((manifest): manifest is string => Boolean(manifest?.trim())),
    ),
  );

  $: {
    for (const manifestId of manifestIds) {
      const entry = $manifestsStore[manifestId];
      if (!entry?.json && !entry?.isFetching) {
        void fetchManifest(manifestId);
      }
    }
  }

  const handleSelectChapter = (chapterId: string) => {
    menuChapterId = null;
    onSelectChapter?.(chapterId);
  };

  const toggleMenu = (chapterId: string) => {
    menuChapterId = menuChapterId === chapterId ? null : chapterId;
  };

  const openDeleteModal = (chapterId: string) => {
    menuChapterId = null;
    pendingDeleteChapterId = chapterId;
  };

  const cancelDelete = () => {
    pendingDeleteChapterId = null;
  };

  const confirmDelete = () => {
    if (pendingDeleteChapterId) {
      onDeleteChapter?.(pendingDeleteChapterId);
    }
    pendingDeleteChapterId = null;
  };

  const onModalBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      cancelDelete();
    }
  };

  const onDragStart = (event: DragEvent, chapterId: string) => {
    if (!onReorderChapter) return;
    draggedChapterId = chapterId;
    dropTargetChapterId = null;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', chapterId);
    }
  };

  const onDragOver = (event: DragEvent, targetChapterId: string) => {
    if (!onReorderChapter || !draggedChapterId || draggedChapterId === targetChapterId) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const midpoint = target.getBoundingClientRect().top + target.offsetHeight / 2;
    dropTargetChapterId = targetChapterId;
    dropPosition = event.clientY >= midpoint ? 'after' : 'before';
  };

  const onDrop = (event: DragEvent, targetChapterId: string) => {
    if (!onReorderChapter) return;
    event.preventDefault();
    const sourceChapterId =
      draggedChapterId || event.dataTransfer?.getData('text/plain') || null;

    if (!sourceChapterId || sourceChapterId === targetChapterId) {
      draggedChapterId = null;
      dropTargetChapterId = null;
      return;
    }

    onReorderChapter(sourceChapterId, targetChapterId, dropPosition);
    draggedChapterId = null;
    dropTargetChapterId = null;
  };

  const onDragEnd = () => {
    draggedChapterId = null;
    dropTargetChapterId = null;
  };
</script>

<aside
  class="story-sidebar"
  class:story-sidebar--embedded={sidebarWidth === null}
  class:story-sidebar--disabled={disabled}
  data-testid="story-sidebar"
  style={sidebarWidth !== null
    ? `width: ${sidebarWidth}px; flex: 0 0 ${sidebarWidth}px;`
    : 'width: 100%; flex: 1 1 auto;'}
>
  {#if errorMessage}
    <div class="story-sidebar__error" data-testid="story-sidebar-error">
      {errorMessage}
    </div>
  {/if}

  <div class="story-sidebar__narration" data-testid="narration-status">
    <button
      class="story-sidebar__narration-button story-sidebar__narration-button--full"
      type="button"
      data-testid="open-narration"
      on:click={() => onOpenNarration?.()}
    >
      {$t('storyBuilder.narration.button')}
    </button>
  </div>

  <div class="story-sidebar__divider" aria-hidden="true"></div>

  <section class="story-sidebar__chapters" data-testid="chapter-list">
    <div class="story-sidebar__header">
      <span>{$t('storyBuilder.chapters.title')}</span>
    </div>

    {#if $story.chapters.length === 0}
      <div class="story-sidebar__empty" data-testid="chapter-empty">
        {$t('storyBuilder.chapters.empty')}
      </div>
    {/if}

    <div class="story-sidebar__list">
      {#each $story.chapters as chapter, index (chapter.id)}
        {@const thumbnailSrc = chapterThumbnails[chapter.id]}
        <div
          class="story-sidebar__row"
          class:story-sidebar__row--active={chapter.id === activeChapterId}
          class:story-sidebar__row--draggable={Boolean(onReorderChapter)}
          class:story-sidebar__row--dragging={chapter.id === draggedChapterId}
          class:story-sidebar__row--drop-before={
            chapter.id === dropTargetChapterId && dropPosition === 'before'
          }
          class:story-sidebar__row--drop-after={
            chapter.id === dropTargetChapterId && dropPosition === 'after'
          }
          data-testid="chapter-row-{chapter.id}"
          role="button"
          tabindex="0"
          draggable={Boolean(onReorderChapter)}
          on:click={() => handleSelectChapter(chapter.id)}
          on:keydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleSelectChapter(chapter.id);
            }
          }}
          on:dragstart={(event) => onDragStart(event, chapter.id)}
          on:dragover={(event) => onDragOver(event, chapter.id)}
          on:drop={(event) => onDrop(event, chapter.id)}
          on:dragend={onDragEnd}
        >
          <div class="story-sidebar__thumbnail-wrap">
            {#if thumbnailSrc}
              <img
                class="story-sidebar__thumbnail"
                src={thumbnailSrc}
                alt={labelForChapter(chapter, index)}
                loading="lazy"
              />
            {:else}
              <div class="story-sidebar__thumbnail story-sidebar__thumbnail--placeholder">
                {index + 1}
              </div>
            {/if}
          </div>

          <div class="story-sidebar__row-content">
            <div class="story-sidebar__row-index">{index + 1}</div>
            <div class="story-sidebar__row-title" data-testid="chapter-title-{chapter.id}">
              {labelForChapter(chapter, index)}
            </div>
            <div class="story-sidebar__row-duration">{chapterDurationLabel(chapter)}</div>
          </div>

          <div class="story-sidebar__row-menu">
            <button
              class="story-sidebar__menu-button"
              type="button"
              aria-label="Chapter options"
              data-testid="chapter-menu-{chapter.id}"
              on:click|stopPropagation={() => toggleMenu(chapter.id)}
            >
              ...
            </button>

            {#if menuChapterId === chapter.id}
              <div class="story-sidebar__menu-popover">
                <button
                  class="story-sidebar__menu-action story-sidebar__menu-action--danger"
                  type="button"
                  data-testid="chapter-delete-menu-{chapter.id}"
                  on:click|stopPropagation={() => openDeleteModal(chapter.id)}
                >
                  {$t('storyBuilder.chapters.delete')}
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <div class="story-sidebar__actions">
    <button
      class="story-sidebar__add"
      type="button"
      data-testid="add-chapter"
      on:click={() => onAddChapter?.()}
    >
      {$t('storyBuilder.actions.add')}
    </button>
    <div class="story-sidebar__divider" aria-hidden="true"></div>
    <button
      class="story-sidebar__preview"
      type="button"
      data-testid="preview-story"
      on:click={() => {
        if ($isPreviewing) {
          onStopPreview?.();
        } else {
          onPreview?.();
        }
      }}
      disabled={$story.chapters.length === 0}
    >
      {$isPreviewing ? 'Stop' : 'Preview'}
    </button>
    <div class="story-sidebar__divider" aria-hidden="true"></div>
    <button
      class="story-sidebar__save"
      type="button"
      data-testid="save-export"
      on:click={() => onSaveExport?.()}
      disabled={saveStatus === 'saving'}
    >
      {saveStatus === 'saving' ? $t('storyBuilder.actions.saving') : $t('storyBuilder.actions.save')}
    </button>
    {#if saveStatus === 'error'}
      <div class="story-sidebar__save-status story-sidebar__save-status--error">
        {saveMessage ?? $t('storyBuilder.actions.saveFailed')}
      </div>
    {:else if saveStatus === 'success'}
      <div class="story-sidebar__save-status story-sidebar__save-status--success">
        {saveMessage ?? $t('storyBuilder.actions.saveSuccess')}
      </div>
    {/if}
  </div>

  {#if showDebug}
    <div class="story-sidebar__debug">
      <div class="story-sidebar__label">3D Pose</div>
      <output class="story-sidebar__debug-output" data-testid="pose-debug">
        {poseDebugValue ?? '-'}
      </output>
    </div>
  {/if}

  {#if pendingDeleteChapterId}
    <div
      class="story-sidebar__modal-backdrop"
      role="button"
      tabindex="0"
      on:click={onModalBackdropClick}
      on:keydown={(event) => {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          cancelDelete();
        }
      }}
    >
      <div
        class="story-sidebar__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chapter-delete-title"
        tabindex="-1"
      >
        <div class="story-sidebar__modal-text" id="chapter-delete-title">
          {$t('storyBuilder.chapters.confirmDelete')}
        </div>
        <div class="story-sidebar__modal-actions">
          <button
            class="story-sidebar__modal-button story-sidebar__modal-button--cancel"
            type="button"
            data-testid="chapter-delete-cancel"
            on:click={cancelDelete}
          >
            {$t('storyBuilder.chapters.cancel')}
          </button>
          <button
            class="story-sidebar__modal-button story-sidebar__modal-button--danger"
            type="button"
            data-testid="chapter-delete-confirm"
            on:click={confirmDelete}
          >
            {$t('storyBuilder.chapters.delete')}
          </button>
        </div>
      </div>
    </div>
  {/if}
</aside>

<style>
  :global(.panel-stack--left:has(.story-sidebar)) {
    overflow: hidden !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    height: 100% !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }

  :global(.panel-stack--left:has(.story-sidebar) > .plugin-slot) {
    height: 100% !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 0 !important;
  }

  :global(.panel-stack--left:has(.story-sidebar) .plugin-panel) {
    height: 100% !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }

  :global(.panel-stack--left:has(.story-sidebar) .plugin-panel__panel) {
    height: 100% !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  :global(.panel-stack--left:has(.story-sidebar) .plugin-panel__title) {
    display: none !important;
  }

  :global(.panel-stack--left:has(.story-sidebar) .plugin-panel__body) {
    height: 100% !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .story-sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px 16px 24px;
    background: var(--story-sidebar-bg, var(--viewer-panel, #121922));
    color: var(--story-sidebar-text, var(--viewer-text, #e8edf4));
    border-right: 1px solid
      var(--story-sidebar-border, var(--viewer-panel-border, rgba(255, 255, 255, 0.08)));
    box-sizing: border-box;
    transition: opacity 0.2s ease;
    position: relative;
    overflow: hidden;
    height: 100%;
    max-height: 100%;
    border-radius: 0 18px 18px 0;
  }

  .story-sidebar--embedded {
    border-right: none;
  }

  .story-sidebar--disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .story-sidebar__label {
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--story-sidebar-muted, var(--viewer-muted, rgba(255, 255, 255, 0.6)));
  }

  .story-sidebar__narration {
    display: grid;
    gap: 8px;
    font-size: 12px;
  }

  .story-sidebar__narration-button {
    justify-self: stretch;
    border: none;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--accent, #e07a3f);
    color: #fffaf6;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .story-sidebar__narration-button--full {
    width: 100%;
  }

  .story-sidebar__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--story-sidebar-muted, rgba(255, 255, 255, 0.65));
  }

  .story-sidebar__add {
    border: none;
    border-radius: 10px;
    padding: 6px 10px;
    background: var(--viewer-accent, #ff4fa2);
    color: #1b1f24;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .story-sidebar__empty {
    font-size: 12px;
    color: var(--story-sidebar-muted, rgba(255, 255, 255, 0.6));
  }

  .story-sidebar__chapters {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .story-sidebar__list {
    flex: 1 1 auto;
    overflow-y: auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 6px;
    padding-right: 4px;
  }

  .story-sidebar__row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: start;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: var(--story-sidebar-row-bg, rgba(255, 255, 255, 0.06));
    cursor: pointer;
    position: relative;
  }

  .story-sidebar__row--draggable {
    cursor: grab;
    cursor: -webkit-grab;
  }

  .story-sidebar__row--active {
    border-color: var(--accent, #e07a3f);
  }

  .story-sidebar__row--dragging {
    opacity: 0.65;
    cursor: grabbing;
    cursor: -webkit-grabbing;
  }

  .story-sidebar__row--drop-before::before,
  .story-sidebar__row--drop-after::after {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    height: 2px;
    background: var(--accent, #e07a3f);
  }

  .story-sidebar__row--drop-before::before {
    top: -2px;
  }

  .story-sidebar__row--drop-after::after {
    bottom: -2px;
  }

  .story-sidebar__thumbnail-wrap {
    width: 56px;
    height: 56px;
  }

  .story-sidebar__thumbnail {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    object-fit: cover;
    display: block;
    background: rgba(255, 255, 255, 0.08);
  }

  .story-sidebar__thumbnail--placeholder {
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
  }

  .story-sidebar__row-content {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .story-sidebar__row-index {
    font-size: 12px;
    color: var(--story-sidebar-muted, rgba(255, 255, 255, 0.65));
  }

  .story-sidebar__row-title {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .story-sidebar__row-duration {
    justify-self: start;
    padding: 4px 8px;
    border-radius: 10px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.92);
    background: rgba(255, 255, 255, 0.08);
  }

  .story-sidebar__row-menu {
    position: relative;
    align-self: start;
  }

  .story-sidebar__menu-button {
    border: none;
    background: transparent;
    color: inherit;
    letter-spacing: 0.15em;
    font-weight: 700;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    min-width: 30px;
  }

  .story-sidebar__menu-button:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .story-sidebar__menu-popover {
    position: absolute;
    right: 0;
    top: 32px;
    min-width: 120px;
    padding: 6px;
    border-radius: 10px;
    background: rgba(13, 18, 28, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    z-index: 5;
  }

  .story-sidebar__menu-action {
    width: 100%;
    border: none;
    border-radius: 8px;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
    background: transparent;
    color: inherit;
    font-size: 12px;
  }

  .story-sidebar__menu-action:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .story-sidebar__menu-action--danger {
    color: #ff9aa2;
  }

  .story-sidebar__actions {
    display: grid;
    gap: 10px;
  }

  .story-sidebar__save {
    border: none;
    border-radius: 12px;
    padding: 10px 14px;
    background: var(--accent, #e07a3f);
    color: #fffaf6;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .story-sidebar__save:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .story-sidebar__preview {
    border: none;
    border-radius: 12px;
    padding: 10px 14px;
    background: #4a90e2;
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .story-sidebar__preview:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .story-sidebar__divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.16);
  }

  .story-sidebar__save-status {
    font-size: 12px;
    line-height: 1.4;
  }

  .story-sidebar__save-status--error {
    color: #ff9aa2;
  }

  .story-sidebar__save-status--success {
    color: #c2fbd7;
  }

  .story-sidebar__debug {
    display: grid;
    gap: 6px;
    font-size: 11px;
    color: var(--story-sidebar-muted, rgba(255, 255, 255, 0.6));
    word-break: break-word;
  }

  .story-sidebar__debug-output {
    font-size: 11px;
    color: var(--story-sidebar-text, var(--viewer-text, #e8edf4));
  }

  .story-sidebar__error {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 79, 162, 0.12);
    color: var(--story-sidebar-text, var(--viewer-text, #e8edf4));
    font-size: 12px;
    border: 1px solid rgba(255, 79, 162, 0.3);
  }

  .story-sidebar__modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: grid;
    place-items: center;
    padding: 16px;
    z-index: 15;
  }

  .story-sidebar__modal {
    width: 100%;
    max-width: 280px;
    padding: 14px;
    border-radius: 12px;
    background: #111922;
    border: 1px solid rgba(255, 255, 255, 0.12);
    display: grid;
    gap: 12px;
  }

  .story-sidebar__modal-text {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.94);
  }

  .story-sidebar__modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .story-sidebar__modal-button {
    border: none;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    cursor: pointer;
  }

  .story-sidebar__modal-button--cancel {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.92);
  }

  .story-sidebar__modal-button--danger {
    background: rgba(255, 79, 79, 0.2);
    color: #ffb8b8;
  }
</style>
