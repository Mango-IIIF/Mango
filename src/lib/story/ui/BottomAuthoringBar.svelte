<script lang="ts">
  export let hasSelectedChapter = false;
  export let onAddChapter: (() => void) | undefined;
  export let onUpdateChapter: (() => void) | undefined;
</script>

<div class="story-authoring-bar" data-testid="story-authoring-bar">
  <button
    class="story-authoring-bar__button"
    type="button"
    data-testid="authoring-add-chapter"
    on:click={() => onAddChapter?.()}
  >
    + Add Chapter
  </button>

  <button
    class="story-authoring-bar__button"
    type="button"
    data-testid="authoring-update-chapter"
    disabled={!hasSelectedChapter}
    on:click={() => onUpdateChapter?.()}
  >
    Update Chapter Position
  </button>
</div>

<style>
  .story-authoring-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border-top: 1px solid
      var(--story-authoring-border, rgba(255, 255, 255, 0.08));
    background: var(--story-authoring-bg, #0b121a);
    color: var(--story-authoring-text, #eef3f8);
  }

  .story-authoring-bar__button {
    border: none;
    border-radius: 12px;
    padding: 10px 14px;
    background: var(--story-authoring-button-bg, rgba(255, 255, 255, 0.08));
    color: var(--story-authoring-text, #eef3f8);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .story-authoring-bar__button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

</style>
