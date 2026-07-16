<script lang="ts">
  import '@mango-iiif/collection-navigator';
  import type {
    CollectionSelection,
    CollectionTreeElement,
    CollectionTreeMessages,
  } from '@mango-iiif/collection-navigator';
  import { getContext } from 'svelte';
  import { t } from '../../i18n';
  import type { ViewerDerivedStores } from '../state/viewerDerived';
  import type { ViewerStateStores } from '../state/viewerState';

  interface Props {
    onclose?: () => void;
    onselect?: (selection: CollectionSelection) => void;
  }

  let { onclose, onselect }: Props = $props();
  const viewer = getContext<{
    derived: Pick<ViewerDerivedStores, 'collectionEntry' | 'canvases' | 'uiLocale'>;
    state: Pick<ViewerStateStores, 'manifestId' | 'selectedCanvasIndex'>;
  }>('viewer-context');
  const collectionEntry = viewer.derived.collectionEntry;
  const canvases = viewer.derived.canvases;
  const uiLocale = viewer.derived.uiLocale;
  const manifestId = viewer.state.manifestId;
  const selectedCanvasIndex = viewer.state.selectedCanvasIndex;
  let tree: CollectionTreeElement | undefined = $state();
  let loadedCollectionId = '';
  let treeReady = $state(0);
  let revealRequest = 0;
  let error = $state('');

  const collectionMessages = (): Partial<CollectionTreeMessages> => ({
    viewBy: $t('viewer.panels.collection.messages.viewBy'),
    hierarchy: $t('viewer.panels.collection.messages.hierarchy'),
    date: $t('viewer.panels.collection.messages.date'),
    loadingDateMetadata: $t('viewer.panels.collection.messages.loadingDateMetadata'),
    loadNextDates: $t('viewer.panels.collection.messages.loadNextDates'),
    loadMissingDate: $t('viewer.panels.collection.messages.loadMissingDate'),
    loadMissingDates: $t('viewer.panels.collection.messages.loadMissingDates'),
    dateNotLoaded: $t('viewer.panels.collection.messages.dateNotLoaded'),
    oneDateNotLoaded: $t('viewer.panels.collection.messages.oneDateNotLoaded'),
    datesNotLoaded: $t('viewer.panels.collection.messages.datesNotLoaded'),
    undated: $t('viewer.panels.collection.messages.undated'),
    expand: $t('viewer.panels.collection.messages.expand'),
    collapse: $t('viewer.panels.collection.messages.collapse'),
    retry: $t('viewer.panels.collection.messages.retry'),
    loadingStructure: $t('viewer.panels.collection.messages.loadingStructure'),
    noResource: $t('viewer.panels.collection.messages.noResource'),
    noNavigableItems: $t('viewer.panels.collection.messages.noNavigableItems'),
    navigationLabel: $t('viewer.panels.collection.messages.navigationLabel'),
  });

  $effect(() => {
    const element = tree;
    if (!element) return;

    const handleSelection = (event: Event) => {
      onselect?.((event as CustomEvent<CollectionSelection>).detail);
    };
    element.addEventListener('iiif-collection-select', handleSelection);
    return () => element.removeEventListener('iiif-collection-select', handleSelection);
  });

  $effect(() => {
    const entry = $collectionEntry;
    const element = tree;
    if (!element || !entry?.json) return;

    element.locale = $uiLocale;
    element.messages = collectionMessages();
    if (entry.id === loadedCollectionId) return;

    loadedCollectionId = entry.id;
    error = '';
    void element
      .load(entry.json as Record<string, unknown>)
      .then(() => {
        treeReady += 1;
      })
      .catch((cause: unknown) => {
        error = cause instanceof Error ? cause.message : String(cause);
      });
  });

  $effect(() => {
    const element = tree;
    const collection = $collectionEntry;
    const currentManifestId = $manifestId;
    const canvasId = $canvases[$selectedCanvasIndex]?.id;
    treeReady;

    const request = ++revealRequest;
    if (!element || !collection?.json || !currentManifestId || currentManifestId === collection.id) {
      element?.clearSelection();
      return;
    }

    void element
      .revealSelection(
        { manifestId: currentManifestId, ...(canvasId ? { canvasId } : {}) },
        { resolve: true, scroll: true },
      )
      .then((result) => {
        if (request === revealRequest && result === null) element.clearSelection();
      });
  });
</script>

<section class="panel panel--collection" aria-label={$t('viewer.panels.collection.label')}>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.panels.collection.title')}</div>
    <button
      class="panel__close"
      type="button"
      aria-label={$t('viewer.panels.collection.close')}
      onclick={() => onclose?.()}>{$t('common.closeGlyph')}</button
    >
  </div>

  {#if error}
    <div class="panel__empty" role="alert">
      {$t('viewer.panels.collection.error')}: {error}
    </div>
  {/if}

  <mango-collection-tree bind:this={tree}></mango-collection-tree>
</section>

<style>
  .panel--collection {
    min-height: 0;
  }

  mango-collection-tree {
    display: block;
    min-height: 0;
    --mango-collection-accent: var(--viewer-accent, #e07a3f);
    --mango-collection-background: var(--viewer-panel, #121922);
    --mango-collection-surface: var(--viewer-panel-strong, #1b242e);
    --mango-collection-text: var(--viewer-text, #e8edf4);
    --mango-collection-muted: var(--viewer-muted, rgba(255, 255, 255, 0.65));
    --mango-collection-border: var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    --mango-collection-radius: 10px;
    --mango-collection-max-height: none;
  }
</style>
