<script lang="ts">
  import {
    AudioLines,
    Clock3,
    Film,
    Blend,
    FileText,
    Layers3,
    Move3d,
    MessageSquareMore,
    ScrollText,
  } from '@lucide/svelte';
  import type { ChapterTaskEvaluation, ChapterTaskId } from '../chapterTasks';
  import ChapterTaskCard from './ChapterTaskCard.svelte';

  export let tasks: ChapterTaskEvaluation[];
  export let onOpenTask: (task: ChapterTaskId) => void;

  const definitions = {
    details: {
      title: 'Details',
      description: 'Title, description and translations.',
      icon: FileText,
    },
    focus: {
      title: 'Annotations',
      description: 'Text boxes and drawing annotations.',
      icon: MessageSquareMore,
    },
    motion: {
      title: 'Motion',
      description: 'Timed camera points for in-chapter movement.',
      icon: Move3d,
    },
    'audio-timing': {
      title: 'Narration',
      description: 'Voiceover tracks and chapter narration timing.',
      icon: AudioLines,
    },
    'transition-timing': {
      title: 'Chapter transition time',
      description: 'Set the delay before moving to the next chapter.',
      icon: Clock3,
    },
    'media-timing': {
      title: 'Media timing',
      description: 'Start and end points for this chapter’s source audio or video.',
      icon: Film,
    },
    layers: {
      title: 'Layers',
      description: 'Visibility and opacity for image layers.',
      icon: Layers3,
    },
    comparison: {
      title: 'Comparison',
      description: 'Present compatible sources together.',
      icon: Blend,
    },
    source: {
      title: 'Source',
      description: 'Manifest and Canvas configuration.',
      icon: ScrollText,
    },
  } as const;
</script>

<section class="chapter-dashboard" aria-labelledby="chapter-dashboard-title">
  <div class="chapter-dashboard__intro">
    <h2 id="chapter-dashboard-title">Chapter tools</h2>
    <p>Select a tool to edit this chapter.</p>
  </div>
  <div class="chapter-dashboard__grid">
    {#each tasks as task (task.id)}
      {@const definition = definitions[task.id]}
      <ChapterTaskCard
        id={task.id}
        title={definition.title}
        description={definition.description}
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
