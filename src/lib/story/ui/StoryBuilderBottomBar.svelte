<script lang="ts">
  import type { Writable } from 'svelte/store';
  import StoryBottomAuthoringBar from './BottomAuthoringBar.svelte';

  export let selectedChapterId: Writable<string | null>;
  export let onAddChapter: () => void;
  export let onUpdateChapter: () => void;

  let hasSelectedChapter = false;
  $: hasSelectedChapter = Boolean($selectedChapterId);
</script>

<StoryBottomAuthoringBar
  {hasSelectedChapter}
  onAddChapter={onAddChapter}
  onUpdateChapter={onUpdateChapter}
/>
