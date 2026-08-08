<script lang="ts">
  import { t } from '../../../i18n';
  import type { ChapterAnnotationTool as Tool } from '../../../core/types/story';
  import { ANNOTATION_TOOLS, annotationToolLabelKey } from '../annotationTools';
  import type { AnnotationLayer } from '../layers';

  /** @deprecated Use `AnnotationLayer`. Kept for one cycle of host imports. */
  export type LayerItem = AnnotationLayer;

  interface Props {
    activeTool?: Tool;
    layers?: LayerItem[];
    /** Layer new annotations are created in. */
    activeLayerId?: string;
    onactivelayerchange?: ((detail: { id: string }) => void) | undefined;
    ontoolchange?: ((detail: { tool: Tool }) => void) | undefined;
    ontogglelayer?: ((detail: { id: string }) => void) | undefined;
    onaddlayer?: (() => void) | undefined;
    onlayercolorchange?: ((detail: { id: string; color: string }) => void) | undefined;
    onlayerrename?: ((detail: { id: string; name: string }) => void) | undefined;
    onlayermove?: ((detail: { id: string; direction: -1 | 1 }) => void) | undefined;
    onlayerarchive?: ((detail: { id: string; archived: boolean }) => void) | undefined;
    canUndo?: boolean;
    canRedo?: boolean;
    onundo?: (() => void) | undefined;
    onredo?: (() => void) | undefined;
    onkeyboardcreate?:
      | ((detail: { tool: 'rectangle' | 'point' }) => void)
      | undefined;
  }

  let {
    activeTool = 'rectangle',
    layers = [
      { id: 'research', name: 'Research Notes', color: '#fb7185', visible: true },
      { id: 'transcription', name: 'Transcription', color: '#60a5fa', visible: true },
      { id: 'highlights', name: 'Highlights', color: '#34d399', visible: true },
      { id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true },
    ],
    activeLayerId = 'mine',
    onactivelayerchange = undefined,
    ontoolchange = undefined,
    ontogglelayer = undefined,
    onaddlayer = undefined,
    onlayercolorchange = undefined,
    onlayerrename = undefined,
    onlayermove = undefined,
    onlayerarchive = undefined,
    canUndo = false,
    canRedo = false,
    onundo = undefined,
    onredo = undefined,
    onkeyboardcreate = undefined,
  }: Props = $props();

  const tools = ANNOTATION_TOOLS;

  /*
   * Archived layers sit below the active ones rather than disappearing. Their
   * annotations still exist and are still reachable from the list, so hiding
   * the layer entirely would leave no way back.
   */
  let showArchived = $state(false);
  const activeLayers = $derived(layers.filter((layer) => !layer.archived));
  const archivedLayers = $derived(layers.filter((layer) => layer.archived));
  let renamingId = $state<string | null>(null);
  let renameDraft = $state('');
  /** Layer whose management actions are open. One at a time. */
  let menuId = $state<string | null>(null);

  const startRename = (layer: AnnotationLayer) => {
    renamingId = layer.id;
    renameDraft = layerName(layer);
    menuId = null;
  };

  const commitRename = () => {
    if (renamingId) onlayerrename?.({ id: renamingId, name: renameDraft });
    renamingId = null;
  };
  const layerName = (layer: LayerItem): string => {
    const key = `viewer.panels.annotations.editor.layers.${layer.id}`;
    const translated = $t(key);
    return translated === key ? layer.name : translated;
  };
</script>

<aside class="left-sidebar">
  <p class="left-sidebar__label">{$t('viewer.panels.annotations.editor.createTitle')}</p>
  <div class="left-sidebar__tools">
    {#each tools as tool}
      <button
        type="button"
        class="left-sidebar__tool"
        class:left-sidebar__tool--active={tool.id === activeTool}
        aria-pressed={tool.id === activeTool}
        onclick={() => {
          if (tool.id === activeTool) {
            if (tool.id !== 'select') {
              ontoolchange?.({ tool: 'select' });
            }
          } else {
            ontoolchange?.({ tool: tool.id });
          }
        }}
      >
        <tool.icon aria-hidden="true" />
        <span>{$t(annotationToolLabelKey(tool.id))}</span>
      </button>
    {/each}
  </div>

  {#if activeTool === 'rectangle' || activeTool === 'point'}
    <button
      type="button"
      class="left-sidebar__keyboard-create"
      onclick={() => onkeyboardcreate?.({ tool: activeTool })}
    >
      {$t('viewer.panels.annotations.editor.createAtViewCentre', {
        type: $t(annotationToolLabelKey(activeTool)),
      })}
    </button>
  {/if}

  <div class="left-sidebar__history">
    <button
      type="button"
      class="left-sidebar__history-button"
      disabled={!canUndo}
      onclick={() => onundo?.()}
      title={$t('viewer.panels.annotations.editor.undo')}
      aria-label={$t('viewer.panels.annotations.editor.undo')}
    >
      ↶
    </button>
    <button
      type="button"
      class="left-sidebar__history-button"
      disabled={!canRedo}
      onclick={() => onredo?.()}
      title={$t('viewer.panels.annotations.editor.redo')}
      aria-label={$t('viewer.panels.annotations.editor.redo')}
    >
      ↷
    </button>
  </div>

  <div class="left-sidebar__layers">
    <div class="left-sidebar__layers-head">
      <p class="left-sidebar__label">{$t('viewer.panels.annotations.editor.layersLabel')}</p>
      <button type="button" class="left-sidebar__plus" aria-label={$t('viewer.panels.annotations.editor.addLayer')} onclick={() => onaddlayer?.()}
        >+</button
      >
    </div>
    {#each activeLayers as layer (layer.id)}
      <div
        class="left-sidebar__layer"
        class:left-sidebar__layer--hidden={!layer.visible}
        class:left-sidebar__layer--active={layer.id === activeLayerId}
      >
        <!--
          Choosing the active layer and hiding a layer are different actions, so
          they are different controls. Overloading one click with both meant a
          layer could not be drawn into without also being made visible, and
          made "which layer am I drawing in?" unanswerable from the panel.
        -->
        <button
          type="button"
          class="left-sidebar__layer-select"
          onclick={() => onactivelayerchange?.({ id: layer.id })}
          aria-pressed={layer.id === activeLayerId}
          title={$t('viewer.panels.annotations.editor.drawInLayer', { layer: layerName(layer) })}
        >
          <span class="left-sidebar__dot" style={`background:${layer.color};`}></span>
          <span class="left-sidebar__layer-name">{layerName(layer)}</span>
          {#if layer.id === activeLayerId}
            <span class="left-sidebar__active-mark" aria-hidden="true">●</span>
          {/if}
        </button>
        <button
          type="button"
          class="left-sidebar__layer-action"
          aria-expanded={menuId === layer.id}
          onclick={() => (menuId = menuId === layer.id ? null : layer.id)}
          title={$t('viewer.panels.annotations.editor.layerOptions', { layer: layerName(layer) })}
          aria-label={$t('viewer.panels.annotations.editor.layerOptions', { layer: layerName(layer) })}
        >
          ⋯
        </button>
        <button
          type="button"
          class="left-sidebar__layer-toggle"
          onclick={() => ontogglelayer?.({ id: layer.id })}
          aria-pressed={layer.visible}
          title={`${layer.visible ? $t('viewer.panels.annotations.editor.hideLayer') : $t('viewer.panels.annotations.editor.showLayer')}: ${layerName(layer)}`}
          aria-label={`${layer.visible ? $t('viewer.panels.annotations.editor.hideLayer') : $t('viewer.panels.annotations.editor.showLayer')}: ${layerName(layer)}`}
        >
          <span class="left-sidebar__eye">
            {#if layer.visible}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="left-sidebar__eye-svg"
                ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle
                  cx="12"
                  cy="12"
                  r="3"
                ></circle></svg
              >
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="left-sidebar__eye-svg"
                ><path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a13.16 13.16 0 0 1 1.66-2.62M14.78 9.22A3 3 0 0 0 12 9a3 3 0 0 0-3 3 3 3 0 0 0 .22 2.78m0 0a3 3 0 0 0 3.78-3.78M22 12s-3 7-10 7a9.74 9.74 0 0 1-5.39-1.61M2 2l20 20"
                ></path></svg
              >
            {/if}
          </span>
        </button>
        <input
          type="color"
          class="left-sidebar__layer-color"
          value={layer.color}
          aria-label={$t('viewer.panels.annotations.editor.setLayerColour', { layer: layerName(layer) })}
          oninput={(event) =>
            onlayercolorchange?.({ id: layer.id, color: event.currentTarget.value })}
        />
      </div>
      {#if menuId === layer.id}
        <div class="left-sidebar__layer-menu">
          <button type="button" onclick={() => startRename(layer)}>
            {$t('viewer.panels.annotations.editor.rename')}
          </button>
          <button
            type="button"
            onclick={() => onlayermove?.({ id: layer.id, direction: -1 })}
            aria-label={$t('viewer.panels.annotations.editor.moveLayerUp')}
          >
            ↑
          </button>
          <button
            type="button"
            onclick={() => onlayermove?.({ id: layer.id, direction: 1 })}
            aria-label={$t('viewer.panels.annotations.editor.moveLayerDown')}
          >
            ↓
          </button>
          <button
            type="button"
            onclick={() => {
              onlayerarchive?.({ id: layer.id, archived: true });
              menuId = null;
            }}
          >
            {$t('viewer.panels.annotations.editor.archive')}
          </button>
        </div>
      {/if}
      {#if renamingId === layer.id}
        <div class="left-sidebar__rename">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            value={renameDraft}
            autofocus
            aria-label={$t('viewer.panels.annotations.editor.renameLayer', {
              layer: layerName(layer),
            })}
            oninput={(event) => (renameDraft = event.currentTarget.value)}
            onkeydown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') renamingId = null;
            }}
            onblur={commitRename}
          />
        </div>
      {/if}
    {/each}

    {#if archivedLayers.length > 0}
      <button
        type="button"
        class="left-sidebar__archived-toggle"
        aria-expanded={showArchived}
        onclick={() => (showArchived = !showArchived)}
      >
        {$t('viewer.panels.annotations.editor.archivedLayers', {
          count: archivedLayers.length,
        })}
      </button>
      {#if showArchived}
        {#each archivedLayers as layer (layer.id)}
          <div class="left-sidebar__layer left-sidebar__layer--archived">
            <span class="left-sidebar__dot" style={`background:${layer.color};`}></span>
            <span class="left-sidebar__layer-name">{layerName(layer)}</span>
            <button
              type="button"
              class="left-sidebar__layer-action"
              onclick={() => onlayerarchive?.({ id: layer.id, archived: false })}
              title={$t('viewer.panels.annotations.editor.restoreLayer', {
                layer: layerName(layer),
              })}
              aria-label={$t('viewer.panels.annotations.editor.restoreLayer', {
                layer: layerName(layer),
              })}
            >
              ↩
            </button>
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</aside>

<style>
  .left-sidebar {
    display: grid;
    /*
     * `minmax(0, 1fr)`, not the implicit track. A grid's default column is
     * sized to its widest item's min-content, so one row of controls that
     * refused to shrink sized the whole sidebar and pushed it out of its rail.
     */
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    align-content: start;
    min-width: 0;
  }
  .left-sidebar__label {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--viewer-muted);
  }
  .left-sidebar__history {
    display: flex;
    gap: 6px;
  }
  .left-sidebar__keyboard-create {
    min-height: 36px;
    border: 1px dashed var(--viewer-panel-border);
    border-radius: 8px;
    padding: 6px 9px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--viewer-text);
    font: inherit;
    font-size: 11px;
    line-height: 1.3;
    cursor: pointer;
  }
  .left-sidebar__history-button {
    flex: 1;
    /* 32px keeps the control at the WCAG 2.2 minimum target size. */
    min-height: 32px;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--viewer-text);
    font-size: 14px;
    cursor: pointer;
  }
  .left-sidebar__history-button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .left-sidebar__layers {
    display: grid;
    /* Same reason as the sidebar itself: an implicit track is sized by its
       widest row, which is how a layer row wider than the rail dragged the
       whole column out with it. */
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }
  /*
   * Three across rather than six stacked rows. The palette held 292px of the
   * sidebar for six buttons; a portrait page only grows when the stage gets
   * taller, so height spent on chrome is the expensive kind.
   */
  .left-sidebar__tools {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .left-sidebar__tool {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--viewer-text);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    cursor: pointer;
    text-align: center;
  }
  .left-sidebar__tool span {
    font-size: 10px;
    line-height: 1.2;
    letter-spacing: 0.01em;
    overflow-wrap: anywhere;
  }
  .left-sidebar__tool--active {
    border-color: rgba(42, 199, 255, 0.75);
    background: rgba(42, 199, 255, 0.16);
  }

  /*
   * Compact the tool picker when the element is narrow: five full-width rows
   * consumed the whole screen on a phone and pushed the canvas below the fold.
   * As wrapping chips the same five tools take two short rows.
   */
  @container mango-viewer (max-width: 1024px) {
    .left-sidebar__tools {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .left-sidebar__tool {
      /* Chips, not tiles: the narrow layout wraps them into short rows, so the
         icon sits beside its label rather than above it. */
      flex: 1 1 auto;
      flex-direction: row;
      min-width: 0;
      min-height: 34px;
      justify-content: center;
      padding: 6px 10px;
    }
    .left-sidebar__tool span {
      font-size: 12px;
    }
  }
  .left-sidebar__layers-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .left-sidebar__plus {
    border: 1px solid var(--viewer-panel-border);
    background: rgba(255, 255, 255, 0.08);
    color: var(--viewer-text);
    width: 26px;
    height: 26px;
    border-radius: 8px;
  }
  .left-sidebar__layer {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    min-height: 38px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    /* Lets the flex row shrink to its track rather than to its content. */
    min-width: 0;
  }
  /* Fixed-size controls are not what gets sacrificed when the rail narrows —
     the layer name truncates instead. */
  .left-sidebar__layer-color,
  .left-sidebar__layer-action,
  .left-sidebar__layer-toggle {
    flex: 0 0 auto;
  }
  .left-sidebar__layer--hidden {
    opacity: 0.62;
  }
  .left-sidebar__layer-select {
    flex: 1 1 auto;
    /* Lets the name truncate rather than forcing the row wider than the rail. */
    min-width: 0;
    overflow: hidden;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--viewer-text);
    min-height: 32px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
    cursor: pointer;
    text-align: left;
  }
  .left-sidebar__layer-toggle {
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--viewer-text);
    /*
     * 32px so the control meets the WCAG 2.2 minimum target size once its 2px
     * of surrounding spacing is counted.
     */
    min-height: 32px;
    min-width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  /*
   * The active layer is marked with a dot as well as a background tint. A tint
   * alone disappears in forced-colours mode and for anyone who cannot separate
   * it from the layer's own swatch.
   */
  .left-sidebar__layer--active {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }
  .left-sidebar__layer-action {
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--viewer-muted);
    /* 28px plus the row's own spacing clears the WCAG 2.2 target size. */
    min-height: 28px;
    min-width: 28px;
    cursor: pointer;
    font-size: 12px;
  }
  .left-sidebar__layer-action:hover {
    color: var(--viewer-text);
    background: rgba(255, 255, 255, 0.08);
  }
  .left-sidebar__layer-menu {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 4px 4px;
  }
  .left-sidebar__layer-menu button {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--viewer-text);
    min-height: 28px;
    min-width: 28px;
    padding: 0 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .left-sidebar__rename {
    padding: 4px;
  }
  .left-sidebar__rename input {
    width: 100%;
    box-sizing: border-box;
    border-radius: 6px;
    border: 1px solid var(--viewer-panel-border);
    background: rgba(255, 255, 255, 0.06);
    color: var(--viewer-text);
    padding: 6px 8px;
    font: inherit;
    font-size: 12px;
    min-height: 32px;
  }
  .left-sidebar__archived-toggle {
    border: none;
    background: none;
    color: var(--viewer-muted);
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    padding: 6px 4px;
    text-decoration: underline;
  }
  .left-sidebar__layer--archived {
    opacity: 0.65;
  }
  .left-sidebar__active-mark {
    font-size: 9px;
    color: var(--viewer-muted);
    margin-left: auto;
    padding-right: 4px;
  }
  .left-sidebar__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: 0 0 auto;
  }
  .left-sidebar__eye {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .left-sidebar__eye-svg {
    color: var(--viewer-muted);
    display: block;
  }
  .left-sidebar__layer-color,
  .left-sidebar__layer-action,
  .left-sidebar__layer-toggle {
    /* Fixed-size controls must not be the thing that is sacrificed when the
       rail narrows — the name truncates instead. */
    flex: 0 0 auto;
  }
  .left-sidebar__layer-name {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
    line-height: 1.25;
  }
  .left-sidebar__layer-color {
    width: 28px;
    height: 28px;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 8px;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }
</style>
