<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Width divided by height for the authored story output. */
    aspect?: number | null;
    /** Fill the available workspace instead of previewing output shape. */
    fluid?: boolean;
    /** Optional editor-only name shown outside the picture. */
    label?: string;
    children?: Snippet;
  }

  let {
    aspect = 16 / 9,
    fluid = false,
    label = '',
    children = undefined,
  }: Props = $props();

  let safeAspect = $derived(
    Number.isFinite(aspect) && (aspect ?? 0) > 0 ? (aspect as number) : 16 / 9,
  );
</script>

<div
  class="story-stage"
  class:story-stage--labelled={Boolean(label)}
  class:story-stage--fluid={fluid}
  data-testid="story-stage"
  data-story-aspect={safeAspect}
  style={`--story-stage-aspect:${safeAspect}`}
>
  {#if label}
    <div class="story-stage__label" data-testid="story-stage-label">{label}</div>
  {/if}
  <div class="story-stage__well">
    <div class="story-stage__surface" data-testid="story-stage-surface">
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
</div>

<style>
  /*
   * The well may change size when chrome opens, but the surface cannot change
   * shape. Container units let CSS choose the largest rectangle of the story's
   * aspect that fits both available dimensions, giving us letter/pillarboxing
   * without observing layout or writing camera data from a resize callback.
   */
  .story-stage {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .story-stage--labelled {
    grid-template-rows: auto minmax(0, 1fr);
  }

  .story-stage__label {
    justify-self: center;
    box-sizing: border-box;
    max-width: calc(100% - 24px);
    margin: 0 0 7px;
    padding: 4px 9px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    background: color-mix(in srgb, var(--viewer-panel, #101820) 92%, transparent);
    color: var(--viewer-muted, #a9b4c2);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .story-stage__well {
    container-name: mango-story-stage;
    container-type: size;
    display: grid;
    place-items: center;
    align-self: stretch;
    justify-self: stretch;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--viewer-stage-tail, #050a10);
  }

  .story-stage__surface {
    position: relative;
    width: min(100cqw, calc(100cqh * var(--story-stage-aspect)));
    height: min(100cqh, calc(100cqw / var(--story-stage-aspect)));
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--viewer-stage, #071019);
    box-shadow: 0 0 0 1px var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
  }

  /* Interactive workspaces use the whole available canvas. Fixed-aspect
     previews can leave this off when showing the authored output shape. */
  .story-stage--fluid .story-stage__surface {
    width: 100%;
    height: 100%;
  }

  .story-stage__surface :global(.stage),
  .story-stage__surface :global(.stage__story-slot),
  .story-stage__surface :global(.stage__presentation-frame),
  .story-stage__surface :global(.stage__media) {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    box-sizing: border-box;
    border: 0;
    border-radius: 0;
  }
</style>
