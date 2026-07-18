<script lang="ts">
  import { getContext } from 'svelte';
  import { t } from '../../i18n';
  import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
  import PanelCloseButton from './PanelCloseButton.svelte';

  interface Props {
    redesigned?: boolean;
    onclose?: () => void;
  }

  let { redesigned = false, onclose = undefined }: Props = $props();

  const viewer = getContext<any>('viewer-context');
  const { searchHits } = viewer.derived;
  const { searchQuery, selectedSearchResultId } = viewer.state;
  const controller = viewer.controller;

  const handleInput = (event: Event) => {
    controller.setSearchQuery((event.currentTarget as HTMLInputElement).value);
  };

  const clearSearch = () => {
    controller.setSearchQuery('');
  };

  const handleResultClick = (annotation: ResolvedAnnotation) => {
    controller.handleSearchResultClick(annotation);
  };
</script>

<section class="panel" aria-label={$t('viewer.panels.search.label')}>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.panels.search.title')}</div>
    <PanelCloseButton
      lucide={redesigned}
      label={$t('viewer.panels.search.close')}
      {onclose}
    />
  </div>
  <div class="panel__body">
    <div class="search">
      <label class="search__label" for="search-input">
        {$t('viewer.panels.search.labelText')}
      </label>
      <div class="search__row">
        <input
          id="search-input"
          class="search__input"
          type="search"
          value={$searchQuery}
          placeholder={$t('viewer.panels.search.placeholder')}
          oninput={handleInput}
        />
        <button class="search__clear" type="button" onclick={clearSearch}>
          {$t('viewer.panels.search.clear')}
        </button>
      </div>
    </div>
    <div class="panel__hint">{$t('viewer.panels.search.hint')}</div>
    {#if $searchQuery}
      <div class="search__count">
        {$t(
          $searchHits.length === 1
            ? 'viewer.panels.search.matchCount_one'
            : 'viewer.panels.search.matchCount_other',
          { count: $searchHits.length },
        )}
      </div>
      {#if $searchHits.length === 0}
        <div class="panel__empty">
          {$t('viewer.panels.search.noMatches')}
        </div>
      {:else}
        <ul class="search-list">
          {#each $searchHits as hit}
            <li
              class="search-list__item"
              class:search-list__item--selected={$selectedSearchResultId === hit.id}
            >
              <button
                class="search-list__button"
                type="button"
                onclick={() => handleResultClick(hit)}
              >
                {hit.text || $t('viewer.panels.search.hitFallback')}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <div class="panel__empty">
        {$t('viewer.panels.search.empty')}
      </div>
    {/if}
  </div>
</section>

<style>
  .search {
    display: grid;
    gap: 8px;
  }

  .search__label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--viewer-muted);
  }

  .search__row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .search__input {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 12px;
    background: var(--viewer-search-input-bg, rgba(10, 14, 19, 0.8));
    color: var(--viewer-text);
  }

  .search__input::placeholder {
    color: var(--viewer-muted);
  }

  .search__clear {
    border: none;
    border-radius: 10px;
    padding: 8px 12px;
    background: var(--viewer-search-clear-bg, rgba(255, 255, 255, 0.1));
    color: var(--viewer-text);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .search__count {
    margin-top: 6px;
    font-size: 12px;
    color: var(--viewer-muted);
  }

  .search-list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  .search-list__item {
    padding: 0;
    border-radius: 10px;
    background: var(--viewer-search-item-bg, rgba(255, 255, 255, 0.06));
    font-size: 12px;
    border: 2px solid transparent;
    transition: border-color 0.2s;
  }

  .search-list__item--selected {
    border-color: var(--viewer-accent-3, #ff8c00);
  }

  .search-list__button {
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--viewer-text);
    text-align: left;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .search-list__button:hover {
    background: var(--viewer-search-item-hover-bg, rgba(255, 255, 255, 0.1));
  }

  .search-list__button:focus {
    outline: 2px solid var(--viewer-search-focus, #007bff);
    outline-offset: -2px;
  }

  @media (max-width: 900px) {
    .search__row {
      grid-template-columns: 1fr;
    }
  }
</style>
