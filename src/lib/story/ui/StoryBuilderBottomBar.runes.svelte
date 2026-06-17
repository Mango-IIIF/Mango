<script lang="ts">
  /**
   * Story Builder Bottom Bar - Svelte 5 Runes Version
   * 
   * This component demonstrates the pattern for converting from Svelte stores to runes.
   * 
   * Changes from legacy version:
   * - Accepts store object instead of Writable
   * - Uses $derived instead of $: reactive statement
   * - Props use $props() rune for better type safety
   */
  import StoryBottomAuthoringBar from './BottomAuthoringBar.svelte';

  type Props = {
    // Accept the store object (or use a simple string | null for simpler cases)
    selectedChapterId: string | null;
    onAddChapter: () => void;
    onUpdateChapter: () => void;
  };

  let { selectedChapterId, onAddChapter, onUpdateChapter }: Props = $props();

  // Use $derived for computed values
  let hasSelectedChapter = $derived(Boolean(selectedChapterId));
</script>

<StoryBottomAuthoringBar
  {hasSelectedChapter}
  {onAddChapter}
  {onUpdateChapter}
/>
