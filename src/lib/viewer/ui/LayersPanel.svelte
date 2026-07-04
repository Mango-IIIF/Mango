<script lang="ts">
  import { getContext } from 'svelte';
  import { t } from '../../i18n';

  interface Props {
    onclose?: (() => void) | undefined;
  }

  let { onclose = undefined }: Props = $props();

  const viewer = getContext<any>('viewer-context');
  const { mediaSources } = viewer.derived;
  const { layerOpacities } = viewer.state;
  const controller = viewer.controller;

  const getOpacity = (id: string): number => {
    if ($layerOpacities[id] !== undefined) return $layerOpacities[id];
    // Default: base layer (first in list) is 1.0 (100% visible), others are 0.0 (0% visible)
    return $mediaSources[0]?.id === id ? 1.0 : 0.0;
  };
</script>

<section class="panel panel--layers" aria-label={$t('viewer.panels.layers.label') ?? 'Layers panel'}>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.panels.layers.title') ?? 'Layers'}</div>
    <button
      class="panel__close"
      type="button"
      aria-label={$t('viewer.panels.layers.close') ?? 'Close layers'}
      onclick={() => onclose?.()}
    >
      {$t('common.closeGlyph') ?? 'x'}
    </button>
  </div>
  <div class="panel__body">
    <div class="layers__list">
      {#each $mediaSources as layer, index (layer.id)}
        {@const opacity = getOpacity(layer.id)}
        <div class="layers__item">
          <div class="layers__info">
            <span class="layers__name">
              {layer.label || (index === 0 ? 'Base Image' : `Layer ${index + 1}`)}
            </span>
            <span class="layers__value">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            class="layers__slider"
            type="range"
            min="0"
            max="100"
            value={Math.round(opacity * 100)}
            oninput={(event) =>
              controller.updateLayerOpacity(
                layer.id,
                Number((event.currentTarget as HTMLInputElement).value) / 100,
              )
            }
          />
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .layers__list {
    display: grid;
    gap: 12px;
  }

  .layers__item {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.03);
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .layers__item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.06);
  }

  .layers__info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .layers__name {
    font-weight: 700;
    color: var(--viewer-text, #e8edf4);
  }

  .layers__value {
    font-weight: 600;
    color: var(--viewer-accent-3, #ffbf4d);
    font-variant-numeric: tabular-nums;
  }

  .layers__slider {
    width: 100%;
    accent-color: var(--viewer-accent-3, #ffbf4d);
    cursor: pointer;
    background: rgba(255, 255, 255, 0.1);
    height: 4px;
    border-radius: 2px;
    outline: none;
    transition: opacity 0.2s ease;
  }

  .layers__slider::-webkit-slider-runnable-track {
    background: transparent;
  }

  .layers__slider::-moz-range-track {
    background: transparent;
  }
</style>
