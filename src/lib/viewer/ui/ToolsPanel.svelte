<script lang="ts">
  import { getViewerContext } from '../context';
  import { t } from '../../i18n';
  import PanelCloseButton from './PanelCloseButton.svelte';

  interface Props {
    redesigned?: boolean;
    onclose?: () => void;
  }

  let { redesigned = false, onclose = undefined }: Props = $props();

  const viewer = getViewerContext();
  const { mediaType } = viewer.derived;
  const { imageFilters } = viewer.state;
  const controller = viewer.controller;
</script>

<section class="panel panel--tools" aria-label={$t('viewer.panels.tools.label')}>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.panels.tools.title')}</div>
    <PanelCloseButton
      lucide={redesigned}
      label={$t('viewer.panels.tools.close')}
      {onclose}
    />
  </div>
  <div class="panel__body">
    {#if $mediaType !== 'image'}
      <div class="tools__note">
        {$t('viewer.panels.tools.note')}
      </div>
    {/if}
    <div class="tools__group">
      <label class="tools__label" for="brightness-slider">
        <span>{$t('viewer.panels.tools.brightness')}</span>
        <span class="tools__value">{$imageFilters.brightness}%</span>
      </label>
      <input
        id="brightness-slider"
        class="tools__slider"
        type="range"
        min="0"
        max="200"
        value={$imageFilters.brightness}
        disabled={$mediaType !== 'image'}
        oninput={(event) =>
          controller.updateImageFilter(
            'brightness',
            Number((event.currentTarget as HTMLInputElement).value),
          )
        }
      />
    </div>

    <div class="tools__group">
      <label class="tools__label" for="contrast-slider">
        <span>{$t('viewer.panels.tools.contrast')}</span>
        <span class="tools__value">{$imageFilters.contrast}%</span>
      </label>
      <input
        id="contrast-slider"
        class="tools__slider"
        type="range"
        min="0"
        max="200"
        value={$imageFilters.contrast}
        disabled={$mediaType !== 'image'}
        oninput={(event) =>
          controller.updateImageFilter(
            'contrast',
            Number((event.currentTarget as HTMLInputElement).value),
          )
        }
      />
    </div>

    <div class="tools__group">
      <label class="tools__label" for="saturation-slider">
        <span>{$t('viewer.panels.tools.saturation')}</span>
        <span class="tools__value">{$imageFilters.saturation}%</span>
      </label>
      <input
        id="saturation-slider"
        class="tools__slider"
        type="range"
        min="0"
        max="200"
        value={$imageFilters.saturation}
        disabled={$mediaType !== 'image'}
        oninput={(event) =>
          controller.updateImageFilter(
            'saturation',
            Number((event.currentTarget as HTMLInputElement).value),
          )
        }
      />
    </div>

    <div class="tools__divider">{$t('viewer.panels.tools.effects')}</div>

    <label class="tools__toggle">
      <span>{$t('viewer.panels.tools.invert')}</span>
      <input
        type="checkbox"
        checked={$imageFilters.invert}
        disabled={$mediaType !== 'image'}
        onchange={(event) =>
          controller.updateImageFilter(
            'invert',
            (event.currentTarget as HTMLInputElement).checked,
          )
        }
      />
    </label>

    <label class="tools__toggle">
      <span>{$t('viewer.panels.tools.grayscale')}</span>
      <input
        type="checkbox"
        checked={$imageFilters.grayscale}
        disabled={$mediaType !== 'image'}
        onchange={(event) =>
          controller.updateImageFilter(
            'grayscale',
            (event.currentTarget as HTMLInputElement).checked,
          )
        }
      />
    </label>

    <button
      class="tools__reset"
      type="button"
      disabled={$mediaType !== 'image'}
      onclick={() => controller.resetImageFilters()}
    >
      {$t('viewer.panels.tools.reset')}
    </button>
  </div>
</section>

<style>
  .tools__note {
    font-size: 12px;
    color: var(--viewer-muted);
    margin-bottom: 10px;
  }

  .tools__group {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }

  .tools__label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--viewer-muted);
  }

  .tools__value {
    font-weight: 600;
    color: var(--viewer-text);
  }

  .tools__slider {
    width: 100%;
    accent-color: var(--viewer-accent-2);
  }

  .tools__slider:disabled {
    opacity: 0.5;
  }

  .tools__divider {
    margin: 4px 0 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--viewer-muted);
  }

  .tools__toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    font-size: 12px;
    color: var(--viewer-text);
    margin-bottom: 8px;
  }

  .tools__toggle input {
    accent-color: var(--viewer-accent-tools);
  }

  .tools__reset {
    margin-top: 8px;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 999px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--viewer-text);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .tools__reset:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
