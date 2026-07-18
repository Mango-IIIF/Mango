<script lang="ts">
  /* eslint-disable svelte/no-at-html-tags -- HTML bodies are sanitized before rendering */
  import { getViewerContext } from '../context';
  import { t } from '../../i18n';
  import { sanitizeHtml } from '../util/sanitiseHtml';
  import PanelCloseButton from './PanelCloseButton.svelte';

  interface Props {
    redesigned?: boolean;
    onclose?: (() => void) | undefined;
  }

  let { redesigned = false, onclose = undefined }: Props = $props();

  const viewer = getViewerContext();
  const { overlayAnnotations } = viewer.derived;
  const { activeAnnotationId } = viewer.state;
  const controller = viewer.controller;

  let allowCreateMode = $derived(viewer.canDrawAnnotations);
  let effectiveMode = $derived(viewer.annotationMode);

  const setMode = (mode: 'edit' | 'create') => {
    if (!allowCreateMode) return;
    controller.setAnnotationMode(mode);
  };

  const selectAnnotation = (id: string) => {
    controller.handleAnnotationSelect({ id });
  };
</script>

<section
  class="panel panel--editor"
  aria-label={$t('viewer.panels.annotations.label')}
  data-mode={effectiveMode}
>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.panels.annotations.title')}</div>
    <PanelCloseButton
      lucide={redesigned}
      label={$t('viewer.panels.annotations.close')}
      {onclose}
    />
  </div>
  {#if allowCreateMode}
    <div class="panel__tabs">
      <button
        type="button"
        class="panel__tab"
        class:panel__tab--active={effectiveMode === 'edit'}
        onclick={() => setMode('edit')}
      >
        View List
      </button>
      <button
        type="button"
        class="panel__tab"
        class:panel__tab--active={effectiveMode === 'create'}
        onclick={() => setMode('create')}
      >
        Draw Shape
      </button>
    </div>
  {/if}
  <div class="panel__body">
    {#if $overlayAnnotations.length === 0}
      <div class="panel__empty">
        {#if effectiveMode === 'create'}
          Draw on the image to create a new annotation.
        {:else}
          {$t('viewer.panels.annotations.emptyList')}
        {/if}
      </div>
    {:else}
      <ul class="annotation-list">
        {#each $overlayAnnotations as annotation}
          <li>
            <button
              class="annotation-list__item {annotation.motivation?.includes('tagging') ? 'annotation-list__item--tag' : ''}"
              class:annotation-list__item--active={annotation.id === $activeAnnotationId}
              type="button"
              onclick={() => selectAnnotation(annotation.id)}
            >
              {#if annotation.motivation?.includes('tagging') || annotation.time}
                <div class="annotation-list__header">
                  {#if annotation.motivation?.includes('tagging')}
                    <span class="annotation-list__badge">Tag</span>
                  {/if}
                  {#if annotation.time}
                    <span class="annotation-list__meta">
                      {annotation.time.start}s
                    </span>
                  {/if}
                </div>
              {/if}
              <div class="annotation-list__label">
                {annotation.text || $t('viewer.panels.annotations.fallback')}
              </div>
              {#if annotation.bodies?.length}
                <div class="annotation-list__bodies">
                  {#each annotation.bodies as body}
                    {#if body.type === 'image' && body.src}
                      <figure
                        class="annotation-body annotation-body--image {body.styleClass ?? ''}"
                        style={body.style}
                      >
                        <img
                          src={body.src}
                          alt={
                            annotation.text ||
                            $t('viewer.panels.annotations.fallback')
                          }
                          loading="lazy"
                        />
                      </figure>
                    {:else if body.type === 'html' && body.value}
                      <div
                        class="annotation-body annotation-body--html {body.styleClass ?? ''}"
                        style={body.style}
                      >
                        {@html sanitizeHtml(body.value)}
                      </div>
                    {:else if body.value}
                      <div
                        class="annotation-body annotation-body--text {body.styleClass ?? ''}"
                        style={body.style}
                      >
                        {body.value}
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  .annotation-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .annotation-list__item {
    display: grid;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    font-size: 12px;
    width: 100%;
    appearance: none;
    color: inherit;
    font: inherit;
    text-align: left;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .annotation-list__item--tag {
    border: 1px solid rgba(255, 79, 162, 0.35);
    background: rgba(255, 79, 162, 0.08);
  }

  .annotation-list__item--active {
    border-color: rgba(42, 199, 255, 0.7);
    box-shadow: 0 0 0 1px rgba(42, 199, 255, 0.2);
  }

  .annotation-list__item:focus-visible {
    outline: 2px solid rgba(42, 199, 255, 0.6);
    outline-offset: 2px;
  }

  .annotation-list__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .annotation-list__badge {
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(255, 79, 162, 0.2);
    color: var(--viewer-text);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .annotation-list__label {
    color: var(--viewer-text);
    font-weight: 600;
    line-height: 1.4;
  }

  .annotation-list__meta {
    font-size: 11px;
    color: var(--viewer-muted);
  }

  .annotation-list__bodies {
    display: grid;
    gap: 6px;
  }

  .annotation-body {
    color: var(--viewer-text);
    font-size: 12px;
    line-height: 1.4;
  }

  .annotation-body--image {
    margin: 0;
  }

  .annotation-body--image img {
    width: 100%;
    border-radius: 8px;
    display: block;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  :global(.annotation-body--html p) {
    margin: 0 0 6px;
  }

  :global(.annotation-body--html p:last-child) {
    margin-bottom: 0;
  }

  :global(.annotation-body--html a) {
    color: var(--viewer-accent-2);
  }

  :global(.annotation-body--html img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }
</style>
