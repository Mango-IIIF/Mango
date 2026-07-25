<script lang="ts">
  import type { Readable } from 'svelte/store';
  import type { StoryState } from '../../core/types/story';
  import StoryMainSidebar from './MainSidebar.svelte';

  export let story: Readable<StoryState>;
  export let selectedChapterId: Readable<string | null>;
  export let error: Readable<string | null>;
  export let validationErrors: Readable<string[]>;
  export let modelPoseDebug: Readable<string | null>;
  export let showDebug = false;
  export let language = 'en';
  export let onAddChapter: () => void;
  export let onSelectChapter: (chapterId: string) => void;
  export let onDeleteChapter: (chapterId: string) => void;
  export let onDuplicateChapter: (chapterId: string) => void;
  export let onReorderChapter:
    | ((chapterId: string, targetChapterId: string, position?: 'before' | 'after') => void)
    | undefined = undefined;

  let errorMessage: string | null = null;
  let isDisabled = false;
  $: errorMessage = $error;
  // Keep chapter list interactive while overlays are open so users can switch chapters.
  $: isDisabled = false;
</script>

<StoryMainSidebar
  {story}
  {selectedChapterId}
  {modelPoseDebug}
  {showDebug}
  {language}
  {errorMessage}
  {validationErrors}
  disabled={isDisabled}
  {onAddChapter}
  {onSelectChapter}
  {onDeleteChapter}
  {onDuplicateChapter}
  {onReorderChapter}
/>
