<script lang="ts">
  import { t } from '../../../i18n';
  import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';

  interface Props {
    annotations?: ResolvedAnnotation[];
    activeId?: string | null;
    onselect?: ((detail: { id: string }) => void) | undefined;
  }

  let { annotations = [], activeId = null, onselect = undefined }: Props = $props();
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
    <h3>{$t('viewer.panels.annotations.title')}</h3>
    <input placeholder={$t('viewer.panels.annotations.editor.searchPlaceholder')} bind:value={query} />
  </div>
  <div class="annotation-table__wrap">
    <table>
      <thead>
        <tr>
          <th>{$t('viewer.panels.annotations.editor.id')}</th>
          <th>{$t('viewer.panels.annotations.editor.label')}</th>
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
            <td>{item.label || item.text || '-'}</td>
            <td>{$t(`viewer.panels.annotations.editor.tools.${typeOf(item)}`) !== `viewer.panels.annotations.editor.tools.${typeOf(item)}` ? $t(`viewer.panels.annotations.editor.tools.${typeOf(item)}`) : typeOf(item)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
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
