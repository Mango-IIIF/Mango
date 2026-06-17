<script lang="ts">
  import type { Readable } from 'svelte/store';
  import type { Story } from '../../core/types/story';
  import StoryMainSidebar from './MainSidebar.svelte';

  export let story: Readable<Story>;
  export let selectedChapterId: Readable<string | null>;
  export let error: Readable<string | null>;
  export let modelPoseDebug: Readable<string | null>;
  export let showDebug = false;
  export let language = 'en';
  export let onAddChapter: () => void;
  export let onSelectChapter: (chapterId: string) => void;
  export let onDeleteChapter: (chapterId: string) => void;
  export let onReorderChapter:
    | ((chapterId: string, targetChapterId: string, position?: 'before' | 'after') => void)
    | undefined = undefined;
  export let onSaveExport: () => void;
  export let onOpenNarration: () => void;
  export let onPreview: (() => void) | undefined = undefined;
  export let onStopPreview: (() => void) | undefined = undefined;
  export let isPreviewing: Readable<boolean>;
  export let saveState: Readable<{ status: 'idle' | 'saving' | 'success' | 'error'; message?: string }>;

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
  errorMessage={errorMessage}
  disabled={isDisabled}
  onAddChapter={onAddChapter}
  onSelectChapter={onSelectChapter}
  onDeleteChapter={onDeleteChapter}
  onReorderChapter={onReorderChapter}
  onSaveExport={onSaveExport}
  onOpenNarration={onOpenNarration}
  {onPreview}
  {onStopPreview}
  {isPreviewing}
  {saveState}
/>
