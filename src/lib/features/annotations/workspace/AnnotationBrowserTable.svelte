<script lang="ts">
  import { t } from '../../../core/i18n';
  import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';
  import type { LayerItem } from './LeftSidebar.svelte';
  import { searchTextFor } from '../canonical';

  interface Props {
    annotations?: ResolvedAnnotation[];
    activeId?: string | null;
    layers?: LayerItem[];
    onselect?: ((detail: { id: string }) => void) | undefined;
    /** Collapsed, only the toolbar shows, so the stage keeps the height. */
    open?: boolean;
    ontoggle?: (() => void) | undefined;
  }

  let {
    annotations = [],
    activeId = null,
    layers = [],
    onselect = undefined,
    open = true,
    ontoggle = undefined,
  }: Props = $props();

  let query = $state('');
  /** Explicit list filter. Independent of which layers are drawn on the stage. */
  let layerFilter = $state('');
  let sortBy = $state<'document' | 'label' | 'type' | 'layer'>('document');

  /*
   * How many rows are put in the DOM at once.
   *
   * A page with ten thousand annotations produces ten thousand rows, and the
   * table is inside a fixed-height panel that can only show a dozen. Growing
   * the window as the user reaches the bottom keeps the first paint cheap
   * without hiding anything: the count below always says how many matched.
   */
  const PAGE_SIZE = 200;
  let windowSize = $state(PAGE_SIZE);

  const typeOf = (item: ResolvedAnnotation): string =>
    item.shapeType === 'rect' || !item.shapeType
      ? item.polygon
        ? 'polygon'
        : item.point
          ? 'point'
          : 'rect'
      : item.shapeType;

  const layerOf = (item: ResolvedAnnotation): string => item.targetStyleClass?.trim() ?? '';

  const layerName = (id: string): string => {
    const layer = layers.find((entry) => entry.id === id);
    if (!layer) return id;
    const key = `viewer.panels.annotations.editor.layers.${layer.id}`;
    const translated = $t(key);
    return translated === key ? layer.name : translated;
  };

  const rowName = (item: ResolvedAnnotation): string => {
    const content = item.label?.trim() || item.text?.trim();
    const shapeType = typeOf(item);
    const toolType = shapeType === 'rect' ? 'rectangle' : shapeType;
    const typeKey = `viewer.panels.annotations.editor.tools.${toolType}`;
    const translatedType = $t(typeKey);
    const type = translatedType === typeKey ? toolType : translatedType;
    return content ? `${type}: ${content}` : `${type}: ${item.id}`;
  };

  const matched = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const wanted = layerFilter.trim();
    const rows = annotations.filter((item) => {
      if (wanted && layerOf(item) !== wanted) return false;
      if (!q) return true;
      // Searches tags and HTML bodies too, not just the display text — a tag is
      // often the only thing an annotation says.
      return `${item.id} ${searchTextFor(item)}`.toLowerCase().includes(q);
    });

    if (sortBy === 'document') return rows;
    const key = (item: ResolvedAnnotation): string =>
      sortBy === 'label'
        ? (item.label || item.text || item.id).toLowerCase()
        : sortBy === 'type'
          ? typeOf(item)
          : layerOf(item);
    // Copied before sorting: the incoming array is the caller's state.
    return [...rows].sort((a, b) => key(a).localeCompare(key(b)));
  });

  const visible = $derived(matched.slice(0, windowSize));

  // A new search starts at the top of its own results rather than however far
  // down the previous one had been scrolled.
  $effect(() => {
    void query;
    void layerFilter;
    void sortBy;
    windowSize = PAGE_SIZE;
  });

  const handleScroll = (event: Event) => {
    const element = event.currentTarget as HTMLElement;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 240 && windowSize < matched.length) {
      windowSize = Math.min(windowSize + PAGE_SIZE, matched.length);
    }
  };
</script>

<section class="annotation-table">
  <div class="annotation-table__toolbar">
    <button
      type="button"
      class="annotation-table__toggle"
      aria-expanded={open}
      aria-label={open
        ? $t('viewer.panels.annotations.editor.hideList')
        : $t('viewer.panels.annotations.editor.showList')}
      title={open
        ? $t('viewer.panels.annotations.editor.hideList')
        : $t('viewer.panels.annotations.editor.showList')}
      onclick={() => ontoggle?.()}
    >
      {open ? '▾' : '▸'}
    </button>
    <input
      class="annotation-table__search"
      value={query}
      oninput={(event) => (query = event.currentTarget.value)}
      placeholder={$t('viewer.panels.annotations.editor.searchPlaceholder')}
      aria-label={$t('viewer.panels.annotations.editor.searchPlaceholder')}
      type="search"
    />
    {#if layers.length > 0}
      <select
        class="annotation-table__filter"
        value={layerFilter}
        onchange={(event) => (layerFilter = event.currentTarget.value)}
        aria-label={$t('viewer.panels.annotations.editor.filterByLayer')}
      >
        <option value="">{$t('viewer.panels.annotations.editor.allLayers')}</option>
        {#each layers as layer (layer.id)}
          <option value={layer.id}>{layerName(layer.id)}</option>
        {/each}
      </select>
    {/if}
    <select
      class="annotation-table__filter"
      value={sortBy}
      onchange={(event) => (sortBy = event.currentTarget.value as typeof sortBy)}
      aria-label={$t('viewer.panels.annotations.editor.sortBy')}
    >
      <option value="document">{$t('viewer.panels.annotations.editor.sort.document')}</option>
      <option value="label">{$t('viewer.panels.annotations.editor.sort.label')}</option>
      <option value="type">{$t('viewer.panels.annotations.editor.sort.type')}</option>
      <option value="layer">{$t('viewer.panels.annotations.editor.sort.layer')}</option>
    </select>
  </div>

  {#if open}
    <div class="annotation-table__wrap" onscroll={handleScroll}>
      <table>
        <thead>
          <tr>
            <th>{$t('viewer.panels.annotations.editor.id')}</th>
            <th>{$t('viewer.panels.annotations.editor.label')}</th>
            <th>{$t('viewer.panels.annotations.editor.text')}</th>
            <th>{$t('viewer.panels.annotations.editor.type')}</th>
            <th>{$t('viewer.panels.annotations.editor.layer')}</th>
          </tr>
        </thead>
        <tbody>
          {#each visible as item (item.id)}
            <!--
              The row is selectable, so the first cell holds a real button rather
              than the row carrying a click handler. A `tr` with `onclick` cannot
              be reached by keyboard and is announced as a table row, which leaves
              the list unusable for anyone not using a pointer — and the list is
              the only way to reach an annotation on a hidden layer.
            -->
            <tr class:active={item.id === activeId}>
              <td>
                <button
                  type="button"
                  class="annotation-table__select"
                  aria-pressed={item.id === activeId}
                  aria-label={$t('viewer.panels.annotations.editor.selectAnnotation', {
                    annotation: rowName(item),
                  })}
                  title={item.id}
                  onclick={() => onselect?.({ id: item.id })}
                >
                  {item.id}
                </button>
              </td>
              <td title={item.label || undefined}>{item.label || '-'}</td>
              <td title={item.text || undefined}>{item.text || '-'}</td>
              <td
                >{$t(`viewer.panels.annotations.editor.tools.${typeOf(item)}`) !==
                `viewer.panels.annotations.editor.tools.${typeOf(item)}`
                  ? $t(`viewer.panels.annotations.editor.tools.${typeOf(item)}`)
                  : typeOf(item)}</td
              >
              <td>{layerOf(item) ? layerName(layerOf(item)) : '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="annotation-table__count" aria-live="polite">
      {$t('viewer.panels.annotations.editor.listCount', {
        shown: visible.length,
        total: annotations.length,
      })}
    </p>
  {/if}
</section>

<style>
  .annotation-table {
    display: grid;
    gap: 8px;
    min-height: 0;
  }
  .annotation-table__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .annotation-table__toggle {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--viewer-text);
    min-height: 32px;
    min-width: 32px;
    cursor: pointer;
  }
  .annotation-table__search {
    flex: 1;
    min-width: 120px;
  }
  .annotation-table__search,
  .annotation-table__filter {
    border-radius: 8px;
    border: 1px solid var(--viewer-panel-border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--viewer-text);
    padding: 6px 8px;
    font: inherit;
    font-size: 12px;
    min-height: 32px;
    box-sizing: border-box;
  }
  .annotation-table__wrap {
    overflow: auto;
    max-height: 220px;
    min-height: 0;
  }
  .annotation-table__count {
    margin: 0;
    font-size: 11px;
    color: var(--viewer-muted);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th,
  td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    text-align: left;
  }
  tr.active {
    background: rgba(42, 199, 255, 0.14);
  }
  .annotation-table__select {
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    /* Full-row target, so the pointer affordance survives moving the handler
       onto the button. */
    width: 100%;
    min-height: 24px;
    overflow-wrap: anywhere;
  }
  /* Inside a scrolling table, an outline drawn on the inside edge cannot be
     clipped away by the container the way an outset one can. */
  .annotation-table__select:focus-visible {
    outline: 2px solid var(--viewer-focus, #2ac7ff);
    outline-offset: -2px;
    border-radius: 4px;
  }
  tr.active .annotation-table__select {
    font-weight: 600;
  }
</style>
