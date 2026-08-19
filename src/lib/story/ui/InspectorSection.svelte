<script lang="ts">
  import { AlertCircle, CheckCircle2, ChevronDown, Circle, CircleDot } from '@lucide/svelte';
  import type { Component } from 'svelte';
  import type {
    ChapterTaskId,
    CompletionState,
    TaskAvailability,
    TaskStatus,
  } from '../chapterTasks';
  import { t } from '../../core/i18n';

  /*
   * One section of the chapter inspector.
   *
   * The inspector is a stack of these inside three groups rather than a
   * dashboard that drills into one task at a time: everything about the
   * selected chapter is in reach without a back button. A section that works
   * on the stage — drawing, camera points, narration, media timing — carries
   * an Edit control that opens its tool there, and shows a one-line summary
   * while it is closed.
   */

  export let id: ChapterTaskId;
  export let title: string;
  export let status: TaskStatus | undefined = undefined;
  export let availability: TaskAvailability = { state: 'available' };
  export let collapsed = false;
  export let onToggle: (() => void) | undefined = undefined;
  /** Set for a stage tool: whether its tool is open on the stage right now. */
  export let active: boolean | undefined = undefined;
  export let onActivate: (() => void) | undefined = undefined;
  export let activateLabel = '';

  const statusIcons: Record<CompletionState, Component> = {
    empty: Circle,
    partial: CircleDot,
    complete: CheckCircle2,
    attention: AlertCircle,
  };

  $: disabled = availability.state === 'disabled';
  $: StatusIcon = status ? statusIcons[status.completion] : null;
  $: statusLabel = status
    ? $t(status.labelKey ?? `storyBuilder.tasks.status.${status.completion}`)
    : '';
  $: translationLabel =
    status && status.languageTotal !== undefined
      ? $t('storyBuilder.tasks.languages', {
          translated: status.translated ?? 0,
          total: status.languageTotal,
        })
      : '';
  $: bodyId = `inspector-section-${id}`;
</script>

{#if availability.state !== 'hidden'}
  <section
    class="inspector-section"
    class:inspector-section--active={active}
    class:inspector-section--disabled={disabled}
    class:inspector-section--attention={status?.completion === 'attention'}
    data-task-id={id}
    data-testid={`inspector-section-${id}`}
  >
    <div class="inspector-section__header">
      <button
        class="inspector-section__toggle"
        type="button"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        data-testid={`inspector-toggle-${id}`}
        on:click={() => onToggle?.()}
      >
        <ChevronDown
          class={`inspector-section__chevron${collapsed ? ' inspector-section__chevron--collapsed' : ''}`}
          aria-hidden="true"
        />
        <span class="inspector-section__title">{title}</span>
        {#if status && StatusIcon}
          <span
            class={`inspector-section__status inspector-section__status--${status.completion}`}
          >
            <svelte:component this={StatusIcon} aria-hidden="true" />
            <span>{statusLabel}</span>
            {#if translationLabel}<span class="inspector-section__translations">{translationLabel}</span>{/if}
          </span>
        {/if}
      </button>
      {#if onActivate && !active && !disabled}
        <button
          class="inspector-section__activate"
          type="button"
          data-testid={`inspector-activate-${id}`}
          on:click={() => onActivate?.()}
        >
          {activateLabel || $t('storyBuilder.inspector.edit')}
        </button>
      {:else if active}
        <span class="inspector-section__live">{$t('storyBuilder.inspector.onStage')}</span>
      {/if}
    </div>
    {#if disabled && availability.state === 'disabled'}
      <p class="inspector-section__unavailable">
        {availability.reason}
        {#if availability.action}<small>{availability.action}</small>{/if}
      </p>
    {:else}
      <div class="inspector-section__body" id={bodyId} hidden={collapsed}>
        <slot />
      </div>
    {/if}
  </section>
{/if}

<style>
  .inspector-section {
    display: grid;
    gap: 0;
    border-radius: 12px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    background: var(--viewer-surface, #151d26);
    overflow: hidden;
  }

  .inspector-section--active {
    border-color: color-mix(in srgb, var(--story-builder-accent, #e07a3f) 70%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--story-builder-accent, #e07a3f) 35%, transparent);
  }

  .inspector-section--attention {
    box-shadow: inset 3px 0 color-mix(in srgb, var(--story-builder-accent, #e07a3f) 75%, transparent);
  }

  .inspector-section--disabled {
    opacity: 0.72;
  }

  .inspector-section__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px 0 0;
  }

  .inspector-section__toggle {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 12px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .inspector-section__toggle:hover {
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 4%, transparent);
  }

  .inspector-section__toggle:focus-visible {
    outline: 2px solid var(--accent, var(--story-builder-accent, #e07a3f));
    outline-offset: -3px;
  }

  .inspector-section__toggle :global(.inspector-section__chevron) {
    flex: 0 0 auto;
    width: 15px;
    height: 15px;
    color: var(--viewer-muted, #9aa6b2);
    transition: transform 0.15s ease;
  }

  .inspector-section__toggle :global(.inspector-section__chevron--collapsed) {
    transform: rotate(-90deg);
  }

  .inspector-section__title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--viewer-text, #e8edf4);
  }

  .inspector-section__status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-inline-start: auto;
    font-size: 10px;
    color: var(--viewer-muted, #9aa6b2);
    white-space: nowrap;
  }

  .inspector-section__status :global(svg) {
    width: 12px;
    height: 12px;
  }

  .inspector-section__status--complete {
    color: var(--viewer-success, #72cea4);
  }
  .inspector-section__status--partial {
    color: var(--viewer-warning, #e8b85f);
  }
  .inspector-section__status--attention {
    color: var(--story-builder-accent-hover, #ff9d5c);
  }

  .inspector-section__translations {
    color: var(--viewer-muted, #9aa6b2);
  }

  .inspector-section__activate {
    flex: 0 0 auto;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--story-builder-accent, #e07a3f) 55%, transparent);
    background: color-mix(in srgb, var(--story-builder-accent, #e07a3f) 12%, transparent);
    color: var(--viewer-text, #e8edf4);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .inspector-section__activate:hover {
    background: color-mix(in srgb, var(--story-builder-accent, #e07a3f) 24%, transparent);
  }

  .inspector-section__live {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--story-builder-accent-hover, #ff9d5c);
  }

  .inspector-section__body {
    display: grid;
    gap: 12px;
    padding: 2px 14px 14px;
  }

  .inspector-section__body[hidden] {
    display: none;
  }

  .inspector-section__unavailable {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0 14px 12px;
    font-size: 11px;
    color: var(--viewer-muted, #9aa6b2);
  }

  .inspector-section__unavailable small {
    color: color-mix(in srgb, var(--viewer-muted, #9aa6b2) 78%, white);
  }
</style>
