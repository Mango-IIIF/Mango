<script lang="ts">
  import { Shapes, Trash2 } from '@lucide/svelte';
  import { readable, type Readable } from 'svelte/store';
  import type { ChapterDrawingAnnotation, StoryState } from '../../core/types/story';
  import { t } from '../../i18n';

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let selectedAnnotationId: Readable<string | null> = readable(null);
  export let language = 'en';
  export let onDeleteDrawing: (annotationId: string) => void;
  export let onEditDrawing: (annotationId: string) => void;

  const typeLabel = (annotation: ChapterDrawingAnnotation): string =>
    $t(`viewer.panels.annotations.editor.tools.${annotation.type}`);
  const labelValue = (annotation: ChapterDrawingAnnotation): string =>
    annotation.label?.[language] ?? annotation.label?.en ?? Object.values(annotation.label ?? {})[0] ?? '';

  $: chapter = $story.chapters.find((entry) => entry.id === $selectedChapterId) ?? null;
  $: items = chapter?.drawingAnnotations ?? [];
</script>

<section class="story-wide-annotations" aria-labelledby="story-wide-annotations-title">
  <header class="story-wide-annotations__header">
    <Shapes aria-hidden="true" />
    <strong id="story-wide-annotations-title">{$t('storyBuilder.annotations.chapter')} <span>{items.length}</span></strong>
  </header>

  {#if items.length > 0}
    <div class="story-wide-annotations__items" aria-label={$t('storyBuilder.annotations.chapter')}>
      {#each items as annotation, index (annotation.id)}
        <article
          class="story-wide-annotations__item"
          class:story-wide-annotations__item--selected={$selectedAnnotationId === annotation.id}
        >
          <button
            class="story-wide-annotations__select"
            type="button"
            aria-label={`${$t('storyBuilder.annotations.editDrawing', { type: typeLabel(annotation), index: index + 1 })}: ${labelValue(annotation) || typeLabel(annotation)}`}
            aria-pressed={$selectedAnnotationId === annotation.id}
            on:click={() => onEditDrawing(annotation.id)}
          >
            <span class="story-wide-annotations__number" style={`--annotation-color:${annotation.color ?? '#e07a3f'}`}>{index + 1}</span>
            <span class="story-wide-annotations__copy">
              <strong title={labelValue(annotation) || undefined}>{labelValue(annotation) || typeLabel(annotation)}</strong>
              <small>{typeLabel(annotation)} · {annotation.fillMode === 'solid' ? $t('storyBuilder.annotations.solid') : $t('storyBuilder.annotations.transparent')}</small>
            </span>
          </button>
          <button
            class="story-wide-annotations__delete"
            type="button"
            aria-label={`${$t('storyBuilder.annotations.deleteDrawing', { type: typeLabel(annotation), index: index + 1 })}: ${labelValue(annotation) || typeLabel(annotation)}`}
            on:click={() => onDeleteDrawing(annotation.id)}
          ><Trash2 aria-hidden="true" /></button>
        </article>
      {/each}
    </div>
  {:else}
    <p class="story-wide-annotations__empty">{$t('storyBuilder.annotations.empty')}</p>
  {/if}
</section>

<style>
  .story-wide-annotations { display:grid; gap:10px; padding:11px 13px; box-sizing:border-box; border:1px solid var(--viewer-panel-border, rgba(255,255,255,.08)); border-radius:16px; background:color-mix(in srgb, var(--viewer-panel, #121922) 92%, transparent); color:var(--viewer-text, #e8edf4); }
  .story-wide-annotations__header { display:flex; align-items:center; gap:8px; font-size:13px; }
  .story-wide-annotations__header > :global(svg) { width:16px; color:var(--accent, var(--story-builder-accent, #e07a3f)); }
  .story-wide-annotations__header strong { display:flex; gap:7px; align-items:center; }
  .story-wide-annotations__header span { min-width:18px; height:18px; display:grid; place-items:center; border-radius:9px; background:color-mix(in srgb, var(--viewer-text, #e8edf4) 8%, transparent); color:var(--viewer-muted, #9aa6b2); font-size:9px; }
  .story-wide-annotations__items { display:flex; gap:8px; overflow-x:auto; overflow-y:hidden; }
  .story-wide-annotations__item { flex:0 0 min(250px,72cqw); display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; padding:3px; border:1px solid var(--viewer-panel-border, rgba(255,255,255,.08)); border-radius:10px; background:var(--viewer-well-bg, rgba(5, 10, 16, 0.2)); }
  .story-wide-annotations__item--selected { border-color:var(--accent, var(--story-builder-accent, #e07a3f)); background:color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 9%, transparent); }
  .story-wide-annotations__select { min-width:0; display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:9px; padding:7px; border:0; border-radius:7px; background:transparent; color:inherit; text-align:left; cursor:pointer; }
  .story-wide-annotations__select:hover, .story-wide-annotations__select:focus-visible { background:color-mix(in srgb, var(--viewer-text, #e8edf4) 6%, transparent); outline:none; }
  .story-wide-annotations__number { width:29px; height:29px; display:grid; place-items:center; border-radius:9px; background:color-mix(in srgb, var(--annotation-color) 18%, transparent); color:var(--annotation-color); font-size:10px; font-weight:800; }
  .story-wide-annotations__copy { min-width:0; display:grid; gap:2px; }
  .story-wide-annotations__copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
  .story-wide-annotations__copy small { color:var(--viewer-muted, #9aa6b2); font-size:9px; text-transform:uppercase; letter-spacing:.05em; }
  .story-wide-annotations__delete { width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:8px; background:transparent; color:var(--viewer-muted, #9aa6b2); cursor:pointer; }
  .story-wide-annotations__delete:hover { background:color-mix(in srgb, var(--viewer-danger, #ffb8b8) 12%, transparent); color:var(--viewer-danger, #ef5f7a); }
  .story-wide-annotations__delete :global(svg) { width:14px; }
  .story-wide-annotations__empty { margin:0; color:var(--viewer-muted, #9aa6b2); font-size:12px; }
</style>
