<script lang="ts">
  import {
    AudioLines,
    Clock3,
    Film,
    Blend,
    FileText,
    Frame,
    Layers3,
    Move3d,
    MessageSquareMore,
    ScrollText,
  } from '@lucide/svelte';
  import type { ChapterTaskEvaluation, ChapterTaskId } from '../chapterTasks';
  import ChapterTaskCard from './ChapterTaskCard.svelte';
  import { t } from '../../i18n';

  export let tasks: ChapterTaskEvaluation[];
  export let onOpenTask: (task: ChapterTaskId) => void;

  const icons = {
    details: {
      icon: FileText,
    },
    position: {
      icon: Frame,
    },
    focus: {
      icon: MessageSquareMore,
    },
    motion: {
      icon: Move3d,
    },
    'audio-timing': {
      icon: AudioLines,
    },
    'transition-timing': {
      icon: Clock3,
    },
    'media-timing': {
      icon: Film,
    },
    layers: {
      icon: Layers3,
    },
    comparison: {
      icon: Blend,
    },
    source: {
      icon: ScrollText,
    },
  } as const;
</script>

<section class="chapter-dashboard" aria-labelledby="chapter-dashboard-title">
  <div class="chapter-dashboard__intro">
    <h2 id="chapter-dashboard-title">{$t('storyBuilder.tasks.title')}</h2>
    <p>{$t('storyBuilder.tasks.description')}</p>
  </div>
  <div class="chapter-dashboard__grid">
    {#each tasks as task (task.id)}
      {@const definition = icons[task.id]}
      <ChapterTaskCard
        id={task.id}
        title={$t(`storyBuilder.tasks.items.${task.id}.title`)}
        description={$t(`storyBuilder.tasks.items.${task.id}.description`)}
        icon={definition.icon}
        availability={task.availability}
        status={task.status}
        advanced={task.id === 'source'}
        onOpen={onOpenTask}
      />
    {/each}
  </div>
</section>

<style>
  .chapter-dashboard {
    display: grid;
    gap: 14px;
  }
  .chapter-dashboard__intro h2 {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .chapter-dashboard__intro p {
    margin: 0;
    color: var(--viewer-muted, #9aa6b2);
    font-size: 12px;
    line-height: 1.45;
  }
  .chapter-dashboard__grid {
    display: flex;
    flex-direction: column;
    margin-inline: -14px;
    border-top: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    border-bottom: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
  }
</style>
