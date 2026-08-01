<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import {
    ChevronDown,
    FileText,
    Info,
    Link,
    MoreHorizontal,
    Plus,
    Search,
    Sparkles,
    Star,
    X,
  } from '@lucide/svelte';
  import { fetchManifest, manifestsStore } from '../../state/manifests';
  import { resolveCanvasThumbnail } from '../../viewer/iiif/thumbnails';
  import iiifIcon from './iiif_bw.svg';
  import type { WorkspaceStore } from './workspaceStore.svelte';
  import { t } from '../../i18n';

  interface Props {
    workspace?: WorkspaceStore | null;
    onclose?: () => void;
    onsingleload?: (manifestId: string) => void;
  }

  type SavedManifest = { id: string; label: string };
  type Filter = 'all' | 'library' | 'recent' | 'favourites';
  type View = 'browse' | 'add';

  const STORAGE_KEY = 'mango-workspace-manifests:v1';
  const FAVOURITES_STORAGE_KEY = 'mango-workspace-manifest-favourites:v1';
  const SEEDED_MANIFESTS: SavedManifest[] = [
    {
      id: 'https://iiif.wellcomecollection.org/presentation/v2/b18035723',
      label: 'Wellcome Collection — B18035723',
    },
    {
      id: 'https://iiif.io/api/cookbook/recipe/0001-mvm-image/manifest.json',
      label: 'IIIF Cookbook — Single image',
    },
    {
      id: 'https://iiif.io/api/cookbook/recipe/0002-mvm-audio/manifest.json',
      label: 'IIIF Cookbook — Audio',
    },
    {
      id: 'https://iiif.io/api/cookbook/recipe/0003-mvm-video/manifest.json',
      label: 'IIIF Cookbook — Video',
    },
  ];

  let {
    workspace = null,
    onclose = undefined,
    onsingleload = undefined,
  }: Props = $props();

  let view = $state<View>('browse');
  let filter = $state<Filter>('all');
  let query = $state('');
  let source = $state('all');
  let manifestUrl = $state('');
  let selectedWindowId = $state('');
  let savedManifests = $state<SavedManifest[]>([]);
  let favouriteIds = $state<string[]>([]);
  let loadError = $state('');
  let isLoading = $state(false);
  let thumbnails = $state<Record<string, string | null>>({});

  const windows = $derived(workspace?.windows ?? []);
  const isMultiView = $derived(windows.length > 1);
  const availableManifests = $derived([
    ...savedManifests.filter(
      (saved) => !SEEDED_MANIFESTS.some((seeded) => seeded.id === saved.id),
    ),
    ...SEEDED_MANIFESTS,
  ]);
  const sourceOptions = $derived(
    Array.from(new Set(availableManifests.map((manifest) => getSource(manifest.id)))).sort(),
  );
  const visibleManifests = $derived.by(() => {
    const normalisedQuery = query.trim().toLocaleLowerCase();
    return availableManifests.filter((manifest) => {
      const isSeeded = isSeededManifest(manifest.id);
      const isRecent = savedManifests.some((saved) => saved.id === manifest.id);
      if (filter === 'library' && !isSeeded) return false;
      if (filter === 'recent' && !isRecent) return false;
      if (filter === 'favourites' && !favouriteIds.includes(manifest.id)) return false;
      if (source !== 'all' && getSource(manifest.id) !== source) return false;
      return (
        !normalisedQuery ||
        manifest.label.toLocaleLowerCase().includes(normalisedQuery) ||
        manifest.id.toLocaleLowerCase().includes(normalisedQuery) ||
        getSource(manifest.id).toLocaleLowerCase().includes(normalisedQuery)
      );
    });
  });

  function getSource(id: string): string {
    try {
      const hostname = new URL(id).hostname.replace(/^www\./, '');
      if (hostname.includes('wellcomecollection')) return 'Wellcome Collection';
      if (hostname === 'iiif.io') return 'IIIF Cookbook';
      return hostname;
    } catch {
      return $t('workspace.manifestManager.unknownSource');
    }
  }

  const isSeededManifest = (id: string) =>
    SEEDED_MANIFESTS.some((manifest) => manifest.id === id);

  const storeJson = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Loading and favourites remain usable for the session if storage is blocked.
    }
  };

  const persistManifest = (id: string, label: string) => {
    savedManifests = [
      { id, label },
      ...savedManifests.filter((manifest) => manifest.id !== id),
    ];
    storeJson(STORAGE_KEY, savedManifests);
  };

  const toggleFavourite = (id: string) => {
    favouriteIds = favouriteIds.includes(id)
      ? favouriteIds.filter((favouriteId) => favouriteId !== id)
      : [...favouriteIds, id];
    storeJson(FAVOURITES_STORAGE_KEY, favouriteIds);
  };

  const removeManifest = (id: string) => {
    if (isSeededManifest(id)) return;
    savedManifests = savedManifests.filter((manifest) => manifest.id !== id);
    favouriteIds = favouriteIds.filter((favouriteId) => favouriteId !== id);
    const remainingThumbnails = { ...thumbnails };
    delete remainingThumbnails[id];
    thumbnails = remainingThumbnails;
    storeJson(STORAGE_KEY, savedManifests);
    storeJson(FAVOURITES_STORAGE_KEY, favouriteIds);
  };

  const loadManifest = async (replaceAll = false, requestedId = manifestUrl) => {
    const id = requestedId.trim();
    if (!id || isLoading) return;
    loadError = '';
    isLoading = true;
    await fetchManifest(id);
    const entry = get(manifestsStore)[id];
    isLoading = false;
    if (entry?.error) {
      loadError = $t('workspace.manifestManager.loadError', { error: entry.error });
      return;
    }

    persistManifest(id, entry?.label ?? id);
    if (isMultiView && workspace) {
      if (replaceAll) {
        windows.forEach((windowNode) => workspace.setWindowManifest(windowNode.id, id));
      } else {
        const targetId = selectedWindowId || workspace.activeWindowId || windows[0]?.id;
        if (targetId) {
          workspace.setWindowManifest(targetId, id);
          workspace.setActiveWindow(targetId);
        }
      }
    } else if (workspace?.activeWindowId) {
      workspace.setWindowManifest(workspace.activeWindowId, id);
    } else {
      onsingleload?.(id);
    }
    onclose?.();
  };

  const preloadManifestLibrary = async (manifests: SavedManifest[]) => {
    await Promise.all(
      manifests.map(async (manifest) => {
        await fetchManifest(manifest.id);
        const entry = get(manifestsStore)[manifest.id];
        thumbnails = {
          ...thumbnails,
          [manifest.id]: resolveCanvasThumbnail(entry?.manifesto),
        };
      }),
    );
  };

  const readStoredManifests = (): SavedManifest[] => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter(
        (item): item is SavedManifest =>
          typeof item?.id === 'string' && typeof item?.label === 'string',
      );
    } catch {
      return [];
    }
  };

  const readStoredFavourites = (): string[] => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(FAVOURITES_STORAGE_KEY) ?? '[]',
      );
      return Array.isArray(stored)
        ? Array.from(new Set(stored.filter((id): id is string => typeof id === 'string')))
        : [];
    } catch {
      return [];
    }
  };

  onMount(() => {
    selectedWindowId = workspace?.activeWindowId ?? windows[0]?.id ?? '';
    savedManifests = readStoredManifests();
    favouriteIds = readStoredFavourites();
    void preloadManifestLibrary([
      ...SEEDED_MANIFESTS,
      ...savedManifests.filter(
        (saved) => !SEEDED_MANIFESTS.some((seeded) => seeded.id === saved.id),
      ),
    ]);
  });
</script>

<section
  class="manifest-manager"
  class:manifest-manager--add={view === 'add'}
  aria-label={$t('workspace.manifestManager.ariaLabel')}
  data-testid="manifest-manager"
>
  <header class="manifest-manager__header">
    <h2>
      {view === 'browse'
        ? $t('workspace.manifestManager.title')
        : $t('workspace.manifestManager.addTitle')}
    </h2>
    <button
      class="icon-button"
      type="button"
      aria-label={$t('workspace.manifestManager.close')}
      onclick={() => onclose?.()}
    ><X size={20} /></button>
  </header>

  {#if view === 'browse'}
    <div class="manifest-manager__browse">
      <div class="manifest-manager__controls">
        <div class="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            bind:value={query}
            placeholder={$t('workspace.manifestManager.searchPlaceholder')}
            aria-label={$t('workspace.manifestManager.search')}
          />
        </div>

        <div class="filter-row">
          <div class="filter-tabs" aria-label={$t('workspace.manifestManager.filterAria')}>
            {#each ['all', 'library', 'recent', 'favourites'] as option}
              <button
                type="button"
                class:active={filter === option}
                aria-pressed={filter === option}
                onclick={() => (filter = option as Filter)}
              >{$t(`workspace.manifestManager.${option}`)}</button>
            {/each}
          </div>
          <label class="source-filter">
            <span class="sr-only">{$t('workspace.manifestManager.source')}</span>
            <select bind:value={source}>
              <option value="all">{$t('workspace.manifestManager.allSources')}</option>
              {#each sourceOptions as sourceOption}
                <option value={sourceOption}>{sourceOption}</option>
              {/each}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </label>
        </div>
      </div>

      <div class="manifest-manager__results">
        <div class="manifest-manager__hint">
          <Sparkles size={32} aria-hidden="true" />
          <p>
            {$t('workspace.manifestManager.pasteHint')}
            <button type="button" onclick={() => (view = 'add')}
              >{$t('workspace.manifestManager.yourLibrary')}</button>
          </p>
        </div>

        {#if visibleManifests.length > 0}
          <div class="manifest-grid">
            {#each visibleManifests as manifest (manifest.id)}
              {@const entry = $manifestsStore[manifest.id]}
              <article class="manifest-card">
                <button
                  class="manifest-card__load"
                  type="button"
                  disabled={isLoading}
                  aria-label={$t('workspace.manifestManager.openAria', { label: manifest.label })}
                  onclick={() => void loadManifest(false, manifest.id)}
                >
                  <span class="manifest-card__thumbnail">
                    {#if thumbnails[manifest.id]}
                      <img src={thumbnails[manifest.id] ?? ''} alt="" />
                    {:else}
                      <img class="manifest-card__iiif" src={iiifIcon} alt="" />
                    {/if}
                  </span>
                  <span class="manifest-card__details">
                    <strong>{entry?.label ?? manifest.label}</strong>
                    <span class="manifest-card__source">{getSource(manifest.id)}</span>
                    <span class="manifest-card__count">
                      <FileText size={15} aria-hidden="true" />
                      {$t('workspace.manifestManager.itemCount', {
                        count: entry?.canvases?.length ?? 0,
                      })}
                    </span>
                  </span>
                </button>
                <button
                  class="manifest-card__favourite"
                  class:active={favouriteIds.includes(manifest.id)}
                  type="button"
                  aria-pressed={favouriteIds.includes(manifest.id)}
                  aria-label={$t('workspace.manifestManager.favouriteAria', {
                    label: manifest.label,
                  })}
                  onclick={() => toggleFavourite(manifest.id)}
                ><Star size={21} fill={favouriteIds.includes(manifest.id) ? 'currentColor' : 'none'} /></button>
                {#if !isSeededManifest(manifest.id)}
                  <button
                    class="manifest-card__more"
                    type="button"
                    disabled={isLoading}
                    title={$t('workspace.manifestManager.remove')}
                    aria-label={$t('workspace.manifestManager.removeAria', { label: manifest.label })}
                    onclick={() => removeManifest(manifest.id)}
                  ><MoreHorizontal size={20} /></button>
                {/if}
              </article>
            {/each}
          </div>
        {:else}
          <div class="manifest-manager__empty">
            <Star size={28} aria-hidden="true" />
            <p>{$t('workspace.manifestManager.noResults')}</p>
          </div>
        {/if}
      </div>

      <footer class="manifest-manager__footer">
        <button class="primary-button add-button" type="button" onclick={() => (view = 'add')}>
          <Plus size={20} aria-hidden="true" />
          {$t('workspace.manifestManager.addUrl')}
        </button>
      </footer>
    </div>
  {:else}
    <form
      class="manifest-manager__add-form"
      onsubmit={(event) => {
        event.preventDefault();
        void loadManifest(false);
      }}
    >
      <p>{$t('workspace.manifestManager.addDescription')}</p>
      <label class="url-field" for="manifest-manager-url">
        <Link size={18} aria-hidden="true" />
        <input
          id="manifest-manager-url"
          type="url"
          bind:value={manifestUrl}
          placeholder={$t('workspace.manifestManager.urlPlaceholder')}
          required
        />
      </label>

      {#if isMultiView}
        <label class="target-field" for="manifest-manager-window">
          <span>{$t('workspace.manifestManager.targetWindow')}</span>
          <select id="manifest-manager-window" bind:value={selectedWindowId}>
            {#each windows as windowNode, index (windowNode.id)}
              <option value={windowNode.id}>
                {$t('workspace.manifestManager.window', { number: index + 1 })}{windowNode.id === workspace?.activeWindowId ? ` — ${$t('workspace.manifestManager.active')}` : ''}
              </option>
            {/each}
          </select>
        </label>
      {/if}

      {#if loadError}<p class="manifest-manager__error" role="alert">{loadError}</p>{/if}

      <div class="manifest-manager__add-actions">
        <a href="https://iiif.io/get-started/how-iiif-works/" target="_blank" rel="noreferrer">
          {$t('workspace.manifestManager.whatIsIiif')} <Info size={15} aria-hidden="true" />
        </a>
        <div class="manifest-manager__load-buttons">
          {#if isMultiView}
            <button
              class="secondary-button"
              type="button"
              disabled={isLoading || !manifestUrl.trim()}
              onclick={() => void loadManifest(true)}
            >{$t('workspace.manifestManager.replaceAll')}</button>
          {/if}
          <button class="primary-button load-button" type="submit" disabled={isLoading}>
            {isLoading
              ? $t('workspace.manifestManager.loading')
              : $t('workspace.manifestManager.load')}
          </button>
        </div>
      </div>
    </form>
  {/if}
</section>

<style>
  .manifest-manager {
    box-sizing: border-box;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    height: 100%;
    color: var(--viewer-text, #e4edf8);
    background:
      radial-gradient(circle at 68% 20%, rgba(32, 74, 98, 0.2), transparent 42%),
      color-mix(in srgb, var(--viewer-bg, #07111d) 97%, transparent);
    backdrop-filter: blur(20px);
    overflow: hidden;
  }

  .manifest-manager__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 22px 30px 12px;
  }

  h2 {
    margin: 0;
    font-size: 20px;
    line-height: 1.25;
  }

  button,
  input,
  select {
    font: inherit;
  }

  button {
    color: inherit;
  }

  .icon-button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.035);
    cursor: pointer;
  }

  .manifest-manager__browse {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
  }

  .manifest-manager__controls {
    padding: 0 30px 14px;
  }

  .search-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    height: 42px;
    padding: 0 13px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.16));
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.18);
    color: var(--viewer-muted, #a6b2c0);
  }

  .search-field input,
  .url-field input {
    min-width: 0;
    width: 100%;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
  }

  .search-field input::placeholder,
  .url-field input::placeholder {
    color: var(--viewer-muted, #a6b2c0);
    opacity: 0.64;
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 11px;
  }

  .filter-tabs {
    display: flex;
    gap: 9px;
  }

  .filter-tabs button,
  .source-filter {
    position: relative;
    min-height: 34px;
    padding: 0 17px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.14));
    border-radius: 999px;
    background: transparent;
    font-size: 12px;
  }

  .filter-tabs button {
    cursor: pointer;
  }

  .filter-tabs button.active {
    border-color: transparent;
    background: #117aa9;
    color: #fff;
  }

  .source-filter {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    min-width: 128px;
    padding-right: 12px;
  }

  .source-filter select {
    appearance: none;
    min-width: 0;
    padding: 0 24px 0 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .source-filter :global(svg) {
    position: absolute;
    right: 11px;
    pointer-events: none;
  }

  .manifest-manager__results {
    min-height: 0;
    padding: 0 30px 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  .manifest-manager__hint {
    display: none;
    align-items: center;
    gap: 16px;
    padding: 15px 8px 18px;
    color: var(--viewer-muted, #a6b2c0);
    font-size: 13px;
    line-height: 1.5;
  }

  .manifest-manager__hint :global(svg) {
    flex: 0 0 auto;
    color: #27b9f0;
  }

  .manifest-manager__hint p {
    margin: 0;
  }

  .manifest-manager__hint button {
    padding: 0;
    border: 0;
    background: transparent;
    color: #56ccf5;
    cursor: pointer;
  }

  .manifest-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 12px;
  }

  .manifest-card {
    position: relative;
    min-width: 0;
    min-height: 240px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.11));
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.032);
    overflow: hidden;
  }

  .manifest-card:hover {
    border-color: rgba(86, 204, 245, 0.42);
    background: rgba(255, 255, 255, 0.055);
  }

  .manifest-card__load {
    display: block;
    width: 100%;
    height: 100%;
    padding: 12px;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .manifest-card__thumbnail {
    display: grid;
    place-items: center;
    width: 100%;
    height: 122px;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.34);
    overflow: hidden;
  }

  .manifest-card__thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .manifest-card__thumbnail .manifest-card__iiif {
    width: 38px;
    height: 38px;
    object-fit: contain;
    filter: invert(1);
    opacity: 0.64;
  }

  .manifest-card__details {
    display: block;
    min-width: 0;
    padding-top: 12px;
  }

  .manifest-card strong,
  .manifest-card__source,
  .manifest-card__count {
    display: block;
    min-width: 0;
  }

  .manifest-card strong {
    display: -webkit-box;
    min-height: 38px;
    overflow: hidden;
    font-size: 14px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .manifest-card__source {
    margin-top: 6px;
    overflow: hidden;
    color: var(--viewer-muted, #a6b2c0);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .manifest-card__count {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    color: var(--viewer-muted, #a6b2c0);
    font-size: 12px;
  }

  .manifest-card__favourite,
  .manifest-card__more {
    position: absolute;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 0;
    background: rgba(7, 17, 29, 0.58);
    cursor: pointer;
  }

  .manifest-card__favourite {
    top: 12px;
    right: 12px;
    border-radius: 8px;
  }

  .manifest-card__favourite.active {
    color: #55ccf5;
  }

  .manifest-card__more {
    right: 8px;
    bottom: 7px;
    border-radius: 8px;
  }

  .manifest-manager__empty {
    display: grid;
    place-items: center;
    align-content: center;
    min-height: 180px;
    color: var(--viewer-muted, #a6b2c0);
    text-align: center;
  }

  .manifest-manager__empty p {
    margin: 10px 0 0;
  }

  .manifest-manager__footer {
    display: flex;
    justify-content: center;
    padding: 12px 30px max(16px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    background: rgba(7, 17, 29, 0.76);
  }

  .primary-button,
  .secondary-button {
    min-height: 42px;
    padding: 0 22px;
    border-radius: 9px;
    font-weight: 600;
    cursor: pointer;
  }

  .primary-button {
    border: 1px solid #168fc1;
    background: linear-gradient(100deg, #209dcc, #0874a4);
    color: #fff;
  }

  .secondary-button {
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.16));
    background: rgba(255, 255, 255, 0.04);
  }

  .add-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: min(250px, 100%);
  }

  .manifest-manager__add-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-content: start;
    gap: 12px 16px;
    padding: 0 30px 24px;
  }

  .manifest-manager__add-form > p,
  .manifest-manager__error,
  .target-field {
    grid-column: 1 / -1;
  }

  .manifest-manager__add-form > p {
    margin: 0;
    color: var(--viewer-muted, #a6b2c0);
    font-size: 13px;
  }

  .url-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 42px;
    padding: 0 12px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.16));
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.18);
    color: var(--viewer-muted, #a6b2c0);
  }

  .target-field {
    display: grid;
    gap: 6px;
    color: var(--viewer-muted, #a6b2c0);
    font-size: 12px;
  }

  .target-field select {
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.16));
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.18);
    color: inherit;
  }

  .manifest-manager__error {
    margin: 0;
    color: #ff9292;
    font-size: 12px;
  }

  .manifest-manager__add-actions {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 2px;
  }

  .manifest-manager__add-actions a {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #56ccf5;
    font-size: 12px;
    text-decoration: none;
  }

  .manifest-manager__load-buttons {
    display: flex;
    gap: 10px;
  }

  .load-button {
    min-width: 210px;
  }

  button:disabled {
    cursor: default;
    opacity: 0.48;
  }

  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--viewer-accent-2, #2ac7ff);
    outline-offset: 2px;
  }

  .sr-only {
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

  :global(.viewer:is([data-theme='light'], [data-theme='sepia'], [data-theme='ringo'])) .manifest-card__thumbnail .manifest-card__iiif,
  :global(.workspace[data-theme='light']) .manifest-card__thumbnail .manifest-card__iiif {
    filter: none;
  }

  @container mango-viewer (max-width: 700px) {
    .manifest-manager__header {
      padding: 17px 20px 11px;
    }

    h2 {
      font-size: 18px;
    }

    .manifest-manager__controls {
      padding: 0 20px 12px;
    }

    .filter-row {
      overflow-x: auto;
      scrollbar-width: none;
    }

    .filter-tabs {
      flex: 0 0 auto;
    }

    .filter-tabs button {
      padding: 0 15px;
    }

    .source-filter {
      display: none;
    }

    .manifest-manager__results {
      padding: 0 16px 12px;
    }

    .manifest-manager__hint {
      display: flex;
    }

    .manifest-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }

    .manifest-card {
      min-height: 108px;
    }

    .manifest-card__load {
      display: grid;
      grid-template-columns: 94px minmax(0, 1fr);
      align-items: center;
      gap: 14px;
      padding: 10px;
    }

    .manifest-card__thumbnail {
      width: 94px;
      height: 88px;
    }

    .manifest-card__details {
      padding: 0 34px 0 0;
    }

    .manifest-card strong {
      min-height: 0;
    }

    .manifest-card__favourite {
      top: 6px;
      right: 6px;
      background: transparent;
    }

    .manifest-card__more {
      right: 5px;
      bottom: 4px;
      background: transparent;
    }

    .manifest-manager__footer {
      padding: 12px 16px max(14px, env(safe-area-inset-bottom));
    }

    .add-button {
      width: 100%;
    }

    .manifest-manager--add {
      align-content: start;
    }

    .manifest-manager__add-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      padding: 0 18px 18px;
    }

    .manifest-manager__add-actions {
      display: grid;
      gap: 14px;
    }

    .manifest-manager__load-buttons {
      display: grid;
    }

    .load-button,
    .secondary-button {
      width: 100%;
      min-width: 0;
    }
  }

  @media (max-width: 700px) {
    .manifest-manager__header {
      padding: 17px 20px 11px;
    }

    .manifest-manager__controls {
      padding: 0 20px 12px;
    }

    .source-filter {
      display: none;
    }

    .manifest-manager__hint {
      display: flex;
    }

    .manifest-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
