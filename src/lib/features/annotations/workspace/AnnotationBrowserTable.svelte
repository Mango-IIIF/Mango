<script lang="ts">
  import { t } from '../../../i18n';
  import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';

  interface Props {
    annotations?: ResolvedAnnotation[];
    activeId?: string | null;
    onselect?: ((detail: { id: string }) => void) | undefined;
    /** Collapsed, only the toolbar shows, so the stage keeps the height. */
    open?: boolean;
    ontoggle?: (() => void) | undefined;
  }

  let {
    annotations = [],
    activeId = null,
    onselect = undefined,
    open = true,
    ontoggle = undefined,
  }: Props = $props();
  let query = $state('');

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return annotations;
    return annotations.filter(
      (item) =>
        (item.label ?? '').toLowerCase().includes(q) ||
        (item.text ?? '').toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    );
  });

  const typeOf = (item: ResolvedAnnotation) =>
    item.polygon ? 'polygon' : item.point ? 'point' : 'rect';
</script>

<section class="annotation-table">
  <div class="annotation-table__toolbar">
    <button
      type="button"
      class="annotation-table__disclosure"
      aria-expanded={open}
      aria-label={open
        ? $t('viewer.panels.annotations.editor.hideList')
        : $t('viewer.panels.annotations.editor.showList')}
      title={open
        ? $t('viewer.panels.annotations.editor.hideList')
        : $t('viewer.panels.annotations.editor.showList')}
      onclick={() => ontoggle?.()}
    >
      <span class="annotation-table__chevron" class:is-open={open}>›</span>
      <h3>{$t('viewer.panels.annotations.title')}</h3>
      <span class="annotation-table__count">{annotations.length}</span>
    </button>
    {#if open}
      <input placeholder={$t('viewer.panels.annotations.editor.searchPlaceholder')} bind:value={query} />
    {/if}
  </div>
  {#if open}
  <div class="annotation-table__wrap">
    <table>
      <thead>
        <tr>
          <th>{$t('viewer.panels.annotations.editor.id')}</th>
          <th>{$t('viewer.panels.annotations.editor.label')}</th>
          <th>{$t('viewer.panels.annotations.editor.text')}</th>
          <th>{$t('viewer.panels.annotations.editor.type')}</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as item}
          <tr
            class:active={item.id === activeId}
            onclick={() => onselect?.({ id: item.id })}
          >
            <td>{item.id}</td>
            <td>{item.label || '-'}</td>
            <td>{item.text || '-'}</td>
            <td>{$t(`viewer.panels.annotations.editor.tools.${typeOf(item)}`) !== `viewer.panels.annotations.editor.tools.${typeOf(item)}` ? $t(`viewer.panels.annotations.editor.tools.${typeOf(item)}`) : typeOf(item)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
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
    justify-content: space-between;
    gap: 10px;
  }
  .annotation-table__toolbar h3 {
    margin: 0;
    font-size: 14px;
  }
  .annotation-table__disclosure {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .annotation-table__chevron {
    display: inline-block;
    font-size: 15px;
    line-height: 1;
    color: var(--viewer-muted, #9aa6b2);
    transition: transform 140ms ease;
  }
  .annotation-table__chevron.is-open {
    transform: rotate(90deg);
  }
  .annotation-table__count {
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--viewer-muted, #9aa6b2);
  }
  .annotation-table__toolbar input {
    min-width: 220px;
    border-radius: 10px;
    border: 1px solid var(--viewer-panel-border);
    background: rgba(255, 255, 255, 0.06);
    color: var(--viewer-text);
    padding: 8px 10px;
  }
  .annotation-table__wrap {
    overflow: auto;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 12px;
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
  tr {
    cursor: pointer;
  }
  tr.active {
    background: rgba(42, 199, 255, 0.14);
  }
</style>
