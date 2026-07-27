<script lang="ts">
  import type { Component } from 'svelte';
  import { AlertCircle, CheckCircle2, ChevronRight, Circle, CircleDot } from '@lucide/svelte';
  import type {
    ChapterTaskId,
    CompletionState,
    TaskAvailability,
    TaskStatus,
  } from '../chapterTasks';

  export let id: ChapterTaskId;
  export let title: string;
  export let description: string;
  export let icon: Component;
  export let availability: TaskAvailability;
  export let status: TaskStatus;
  export let advanced = false;
  export let onOpen: (id: ChapterTaskId) => void;

  const statusLabels: Record<CompletionState, string> = {
    empty: 'Not configured',
    partial: 'Partially configured',
    complete: 'Configured',
    attention: 'Needs attention',
  };

  const statusIcons: Record<CompletionState, Component> = {
    empty: Circle,
    partial: CircleDot,
    complete: CheckCircle2,
    attention: AlertCircle,
  };

  $: disabled = availability.state !== 'available';
  $: statusLabel = statusLabels[status.completion];
  $: StatusIcon = statusIcons[status.completion];
  $: translationLabel =
    status.languageTotal !== undefined
      ? `${status.translated ?? 0}/${status.languageTotal} languages`
      : '';
  $: accessibleLabel = [title, advanced ? 'Advanced' : '', statusLabel, translationLabel]
    .filter(Boolean)
    .join(', ');
</script>

{#if availability.state !== 'hidden'}
  <article
    class="chapter-task-card"
    class:chapter-task-card--disabled={disabled}
    class:chapter-task-card--attention={status.completion === 'attention'}
    data-task-id={id}
  >
    <button
      type="button"
      class="chapter-task-card__button"
      aria-label={accessibleLabel}
      aria-describedby={`${id}-description ${id}-status`}
      {disabled}
      on:click={() => onOpen(id)}
    >
      <span class="chapter-task-card__icon" aria-hidden="true">
        <svelte:component this={icon} />
      </span>
      <span class="chapter-task-card__content">
        <span class="chapter-task-card__heading">
          <strong>{title}</strong>
          {#if advanced}<span class="chapter-task-card__advanced">Advanced</span>{/if}
        </span>
        <span id={`${id}-description`} class="chapter-task-card__description">{description}</span>
        <span id={`${id}-status`} class="chapter-task-card__status">
          <span class={`chapter-task-card__state chapter-task-card__state--${status.completion}`}>
            <svelte:component this={StatusIcon} aria-hidden="true" />
            {statusLabel}
          </span>
          {#if translationLabel}
            <span class="chapter-task-card__translations">{translationLabel}</span>
          {/if}
        </span>
      </span>
      <span
        class={`chapter-task-card__trail chapter-task-card__trail--${status.completion}`}
        aria-hidden="true"
      >
        <svelte:component this={StatusIcon} />
        <ChevronRight />
      </span>
    </button>
    {#if availability.state === 'disabled'}
      <div class="chapter-task-card__unavailable">
        <span>{availability.reason}</span>
        {#if availability.action}<small>{availability.action}</small>{/if}
      </div>
    {/if}
  </article>
{/if}

<style>
  .chapter-task-card {
    min-width: 0;
    border-bottom: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    background: transparent;
  }

  .chapter-task-card:last-child {
    border-bottom: 0;
  }

  .chapter-task-card--attention {
    box-shadow: inset 2px 0 rgba(255, 157, 92, 0.75);
  }

  .chapter-task-card__button {
    width: 100%;
    min-height: 76px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 13px 16px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .chapter-task-card__button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent, #e07a3f) 9%, transparent);
  }

  .chapter-task-card__button:focus-visible {
    outline: 2px solid var(--accent, #e07a3f);
    outline-offset: -3px;
  }

  .chapter-task-card__button:disabled {
    color: inherit;
    cursor: not-allowed;
  }

  .chapter-task-card__icon {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: var(--viewer-text, #e8edf4);
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }

  .chapter-task-card__icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .chapter-task-card__content,
  .chapter-task-card__heading,
  .chapter-task-card__status,
  .chapter-task-card__state {
    display: flex;
  }

  .chapter-task-card__content {
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .chapter-task-card__heading,
  .chapter-task-card__status {
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
  }

  .chapter-task-card__heading strong {
    font-size: 13px;
  }

  .chapter-task-card__advanced {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .chapter-task-card__description {
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
    line-height: 1.35;
  }

  .chapter-task-card__status {
    flex-wrap: wrap;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 10px;
  }

  .chapter-task-card__state {
    align-items: center;
    gap: 5px;
  }

  .chapter-task-card__state :global(svg) {
    display: none;
  }

  .chapter-task-card__state--complete {
    color: #72cea4;
  }
  .chapter-task-card__state--partial {
    color: #e8b85f;
  }
  .chapter-task-card__state--attention {
    color: #ff9d5c;
  }

  .chapter-task-card__unavailable {
    display: none;
  }

  .chapter-task-card__unavailable small {
    color: color-mix(in srgb, var(--viewer-muted, #9aa6b2) 78%, white);
  }

  .chapter-task-card--disabled {
    opacity: 0.76;
  }

  .chapter-task-card__trail {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--viewer-muted, #9aa6b2);
  }

  .chapter-task-card__trail :global(svg) {
    width: 15px;
    height: 15px;
  }
  .chapter-task-card__trail--complete :global(svg:first-child) {
    color: #55c993;
  }
  .chapter-task-card__trail--partial :global(svg:first-child) {
    color: #e8b85f;
  }
  .chapter-task-card__trail--attention :global(svg:first-child) {
    color: #ff9d5c;
  }
  .chapter-task-card--disabled .chapter-task-card__trail :global(svg:first-child) {
    color: var(--viewer-muted, #9aa6b2);
  }
</style>
