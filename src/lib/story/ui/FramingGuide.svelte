<script lang="ts">
  import { t } from '../../i18n';

  /** Canonical width/height every framing in this story is stored at. */
  export let aspect: number | null = null;
  /** Stage size in CSS pixels. */
  export let stageWidth = 0;
  export let stageHeight = 0;

  let guideStyle = '';
  let matchesStage = true;

  // The stage is whatever shape the editor layout leaves it, but captures are
  // stored at the story's canonical aspect. Drawing that aspect over the stage
  // shows authors the region their framing will actually keep, so they are not
  // composing against a shape the story never uses.
  $: {
    const validAspect = Number.isFinite(aspect) && (aspect ?? 0) > 0;
    if (!validAspect || stageWidth <= 0 || stageHeight <= 0) {
      guideStyle = '';
      matchesStage = true;
    } else {
      const stageAspect = stageWidth / stageHeight;
      const target = aspect as number;
      matchesStage = Math.abs(stageAspect - target) <= target * 0.01;

      const width = stageAspect > target ? stageHeight * target : stageWidth;
      const height = stageAspect > target ? stageHeight : stageWidth / target;
      guideStyle = `width:${width}px;height:${height}px;`;
    }
  }
</script>

{#if guideStyle && !matchesStage}
  <div class="framing-guide" data-testid="framing-guide" aria-hidden="true">
    <div class="framing-guide__frame" style={guideStyle}>
      <span class="framing-guide__label">{$t('storyBuilder.framing.guide')}</span>
    </div>
  </div>
{/if}

<style>
  .framing-guide {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    z-index: 6;
  }

  .framing-guide__frame {
    position: relative;
    border: 1px dashed
      color-mix(in srgb, var(--accent, var(--story-builder-accent, #e07a3f)) 70%, transparent);
    border-radius: 2px;
    box-shadow: 0 0 0 100vmax color-mix(in srgb, #05080c 38%, transparent);
  }

  .framing-guide__label {
    position: absolute;
    top: 6px;
    left: 8px;
    padding: 2px 6px;
    border-radius: 5px;
    background: color-mix(in srgb, #05080c 72%, transparent);
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
</style>
