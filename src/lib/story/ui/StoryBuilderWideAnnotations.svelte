<script lang="ts">
  import { MessageSquareText, Shapes, Trash2 } from '@lucide/svelte';
  import type { Readable } from 'svelte/store';
  import type { ChapterDrawingAnnotation, StoryState } from '../../core/types/story';

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let onDeleteDrawing: (annotationId: string) => void;
  export let onDeleteText: (language: string) => void;
  export let onEditDrawing: (annotationId: string) => void;
  export let onEditText: (language: string) => void;

  const typeLabel = (annotation: ChapterDrawingAnnotation): string =>
    annotation.type === 'freehand'
      ? 'Freehand'
      : annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1);

  $: chapter = $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: items = [
    ...Object.entries(chapter?.annotations ?? {}).flatMap(([language, annotation]) =>
      annotation.text?.trim()
        ? [
            {
              key: `text-${language}`,
              kind: 'text' as const,
              language,
              title: 'Text box',
              detail: annotation.text,
            },
          ]
        : [],
    ),
    ...(chapter?.drawingAnnotations ?? []).map((annotation) => ({
      key: annotation.id,
      kind: 'drawing' as const,
      annotation,
      title: typeLabel(annotation),
      detail: annotation.text ?? 'Drawing annotation',
    })),
  ];
  $: total = items.length;
</script>

<section class="story-wide-annotations" aria-labelledby="story-wide-annotations-title">
  <header class="story-wide-annotations__header">
    <span class="story-wide-annotations__header-icon"><Shapes aria-hidden="true" /></span>
    <strong id="story-wide-annotations-title">
      Chapter annotations <span>{total}</span>
    </strong>
  </header>

  {#if total > 0}
    <div class="story-wide-annotations__items" aria-label="Chapter annotations">
      {#each items as item, index (item.key)}
        <article class="story-wide-annotations__item">
          <button
            class="story-wide-annotations__item-select"
            type="button"
            aria-label={`Edit ${item.title} annotation ${index + 1}`}
            on:click={() =>
              item.kind === 'text'
                ? onEditText(item.language)
                : onEditDrawing(item.annotation.id)}
          >
            {#if item.kind === 'text'}
              <span class="story-wide-annotations__item-icon"
                ><MessageSquareText aria-hidden="true" /></span
              >
            {:else}
              <span class="story-wide-annotations__item-index">{index + 1}</span>
            {/if}
            <span class="story-wide-annotations__item-copy">
              <strong>{item.title}</strong>
              <small>{item.kind === 'text' ? item.language.toUpperCase() : 'Annotation'}</small>
              <span>{item.detail}</span>
            </span>
          </button>
          <button
            class="story-wide-annotations__item-delete"
            type="button"
            aria-label={`Delete ${item.title} annotation ${index + 1}`}
            on:click={() =>
              item.kind === 'text'
                ? onDeleteText(item.language)
                : onDeleteDrawing(item.annotation.id)}
            ><Trash2 aria-hidden="true" /></button
          >
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .story-wide-annotations {
    display: grid;
    gap: 10px;
    padding: 11px 13px;
    box-sizing: border-box;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    background: color-mix(in srgb, var(--viewer-panel, #121922) 92%, transparent);
    color: var(--viewer-text, #e8edf4);
  }
  .story-wide-annotations__header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .story-wide-annotations__header-icon {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: var(--accent, #e07a3f);
    background: color-mix(in srgb, var(--accent, #e07a3f) 14%, transparent);
  }
  .story-wide-annotations__header-icon :global(svg) {
    width: 13px;
    height: 13px;
  }
  .story-wide-annotations__header strong {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
  }
  .story-wide-annotations__header strong > span {
    min-width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
  }
  .story-wide-annotations__item small {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .story-wide-annotations__items {
    display: flex;
    align-items: stretch;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .story-wide-annotations__item {
    flex: 0 0 min(250px, 72vw);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-radius: 9px;
    background: rgba(5, 10, 16, 0.2);
  }
  .story-wide-annotations__item-select {
    min-width: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 6px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .story-wide-annotations__item-select:hover,
  .story-wide-annotations__item-select:focus-visible {
    background: rgba(255, 255, 255, 0.06);
    outline: none;
  }
  .story-wide-annotations__item-icon,
  .story-wide-annotations__item-index {
    width: 27px;
    height: 27px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent, #e07a3f) 12%, transparent);
    color: var(--accent, #e07a3f);
    font-size: 9px;
    font-weight: 850;
  }
  .story-wide-annotations__item-icon :global(svg) {
    width: 14px;
    height: 14px;
  }
  .story-wide-annotations__item-copy {
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .story-wide-annotations__item-copy strong {
    font-size: 10px;
  }
  .story-wide-annotations__item-copy > span {
    overflow: hidden;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .story-wide-annotations__item-delete {
    width: 27px;
    height: 27px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--viewer-muted, #9aa6b2);
    cursor: pointer;
  }
  .story-wide-annotations__item-delete:hover,
  .story-wide-annotations__item-delete:focus-visible {
    color: #ff9d9d;
    background: rgba(255, 80, 80, 0.1);
  }
  .story-wide-annotations__item-delete :global(svg) {
    width: 13px;
    height: 13px;
  }
</style>
