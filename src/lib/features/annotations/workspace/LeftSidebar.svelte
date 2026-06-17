<script lang="ts">
  import { t } from '../../../i18n';
  type Tool = 'select' | 'rectangle' | 'polygon' | 'point' | 'freehand' | 'line';
  export interface LayerItem {
    id: string;
    name: string;
    color: string;
    visible: boolean;
  }

  interface Props {
    activeTool?: Tool;
    layers?: LayerItem[];
    ontoolchange?: ((detail: { tool: Tool }) => void) | undefined;
    ontogglelayer?: ((detail: { id: string }) => void) | undefined;
    onaddlayer?: (() => void) | undefined;
    onlayercolorchange?: ((detail: { id: string; color: string }) => void) | undefined;
  }

  let {
    activeTool = 'rectangle',
    layers = [
      { id: 'research', name: 'Research Notes', color: '#facc15', visible: true },
      { id: 'transcription', name: 'Transcription', color: '#60a5fa', visible: true },
      { id: 'highlights', name: 'Highlights', color: '#34d399', visible: true },
      { id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true },
    ],
    ontoolchange = undefined,
    ontogglelayer = undefined,
    onaddlayer = undefined,
    onlayercolorchange = undefined,
  }: Props = $props();

  const tools: Array<{ id: Tool; label: string }> = [
    { id: 'select', label: 'Select / Pan' },
    { id: 'rectangle', label: 'Rectangle' },
    { id: 'polygon', label: 'Polygon' },
    { id: 'point', label: 'Point' },
    { id: 'freehand', label: 'Freehand' },
    { id: 'line', label: 'Line' },
  ];
</script>

<aside class="left-sidebar">
  <p class="left-sidebar__label">{$t('viewer.panels.annotations.editor.createTitle')}</p>
  <div class="left-sidebar__tools">
    {#each tools as tool}
      <button
        type="button"
        class="left-sidebar__tool"
        class:left-sidebar__tool--active={tool.id === activeTool}
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
        <span>{$t(`viewer.panels.annotations.editor.tools.${tool.id}`) !== `viewer.panels.annotations.editor.tools.${tool.id}` ? $t(`viewer.panels.annotations.editor.tools.${tool.id}`) : tool.label}</span>
      </button>
    {/each}
  </div>

  <div class="left-sidebar__layers">
    <div class="left-sidebar__layers-head">
      <p class="left-sidebar__label">{$t('viewer.panels.annotations.editor.layersLabel')}</p>
      <button type="button" class="left-sidebar__plus" onclick={() => onaddlayer?.()}
        >+</button
      >
    </div>
    {#each layers as layer}
      <div class="left-sidebar__layer" class:left-sidebar__layer--hidden={!layer.visible}>
        <button
          type="button"
          class="left-sidebar__layer-toggle"
          onclick={() => ontogglelayer?.({ id: layer.id })}
          aria-pressed={layer.visible}
          title={layer.visible ? $t('viewer.panels.annotations.editor.hideLayer') : $t('viewer.panels.annotations.editor.showLayer')}
        >
          <span class="left-sidebar__dot" style={`background:${layer.color};`}></span>
          <span class="left-sidebar__layer-name">{$t(`viewer.panels.annotations.editor.layers.${layer.id}`) !== `viewer.panels.annotations.editor.layers.${layer.id}` ? $t(`viewer.panels.annotations.editor.layers.${layer.id}`) : layer.name}</span>
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
          aria-label={`Set ${layer.name} color`}
          oninput={(event) =>
            onlayercolorchange?.({ id: layer.id, color: event.currentTarget.value })}
        />
      </div>
    {/each}
  </div>
</aside>

<style>
  .left-sidebar {
    display: grid;
    gap: 12px;
    align-content: start;
  }
  .left-sidebar__label {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--viewer-muted);
  }
  .left-sidebar__tools,
  .left-sidebar__layers {
    display: grid;
    gap: 8px;
  }
  .left-sidebar__tool {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--viewer-text);
    min-height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    cursor: pointer;
    text-align: left;
  }
  .left-sidebar__tool--active {
    border-color: rgba(42, 199, 255, 0.75);
    background: rgba(42, 199, 255, 0.16);
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
  }
  .left-sidebar__layer--hidden {
    opacity: 0.62;
  }
  .left-sidebar__layer-toggle {
    flex: 1;
    min-width: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--viewer-text);
    min-height: 30px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
    cursor: pointer;
    text-align: left;
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
  .left-sidebar__layer-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
