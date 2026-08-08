<script lang="ts">
  interface Props {
    languages?: string[];
    activeLanguage?: string;
    ariaLabel: string;
    noLanguageLabel?: string;
    testIdPrefix?: string;
    onchange?: ((language: string) => void) | undefined;
  }

  let {
    languages = [],
    activeLanguage = '',
    ariaLabel,
    noLanguageLabel = '—',
    testIdPrefix = 'annotation-language',
    onchange = undefined,
  }: Props = $props();
</script>

<div class="annotation-language-tabs" role="tablist" aria-label={ariaLabel}>
  {#each languages as language (language || '__no-language__')}
    <button
      type="button"
      role="tab"
      class:annotation-language-tabs__active={language === activeLanguage}
      aria-selected={language === activeLanguage}
      data-testid={`${testIdPrefix}-${language || 'none'}`}
      onclick={() => onchange?.(language)}
    >
      {language ? language.toUpperCase() : noLanguageLabel}
    </button>
  {/each}
</div>

<style>
  .annotation-language-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  button {
    min-width: 48px;
    min-height: 34px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.1));
    border-radius: 9px;
    padding: 7px 10px;
    background: var(--viewer-panel-strong, rgba(255, 255, 255, 0.04));
    color: var(--viewer-muted, #9aa6b2);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--viewer-accent-2, var(--story-builder-accent, #2ac7ff));
  }

  .annotation-language-tabs__active {
    border-color: var(--viewer-accent-2, var(--story-builder-accent, #e07a3f));
    background: color-mix(
      in srgb,
      var(--viewer-accent-2, var(--story-builder-accent, #e07a3f)) 16%,
      transparent
    );
    color: var(--viewer-text, #fff);
  }
</style>

