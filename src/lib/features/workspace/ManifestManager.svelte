<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { Trash2, X } from '@lucide/svelte';
  import { fetchManifest, manifestsStore } from '../../state/manifests';
  import { resolveCanvasThumbnail } from '../../viewer/iiif/thumbnails';
  import iiifIcon from './iiif_bw.svg';
  import type { WorkspaceStore } from './workspaceStore.svelte';
  import { t } from '../../i18n';

  interface Props {
    workspace?: WorkspaceStore | null;
    singleManifestId?: string;
    onclose?: () => void;
    onsingleload?: (manifestId: string) => void;
  }

  type SavedManifest = { id: string; label: string };

  const STORAGE_KEY = 'mango-workspace-manifests:v1';
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
    singleManifestId = '',
    onclose = undefined,
    onsingleload = undefined,
  }: Props = $props();

  let manifestUrl = $state('');
  let selectedWindowId = $state('');
  let savedManifests = $state<SavedManifest[]>([]);
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

  const isSeededManifest = (id: string) =>
    SEEDED_MANIFESTS.some((manifest) => manifest.id === id);

  const storeSavedManifests = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedManifests));
    } catch {
      // Loading remains available when storage is blocked or full.
    }
  };

  const persistManifest = (id: string, label: string) => {
    if (SEEDED_MANIFESTS.some((manifest) => manifest.id === id)) return;
    savedManifests = [
      { id, label },
      ...savedManifests.filter((manifest) => manifest.id !== id),
    ];
    storeSavedManifests();
  };

  const removeManifest = (id: string) => {
    if (isSeededManifest(id)) return;
    savedManifests = savedManifests.filter((manifest) => manifest.id !== id);
    if (manifestUrl === id) manifestUrl = '';
    const remainingThumbnails = { ...thumbnails };
    delete remainingThumbnails[id];
    thumbnails = remainingThumbnails;
    storeSavedManifests();
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

  onMount(() => {
    selectedWindowId = workspace?.activeWindowId ?? windows[0]?.id ?? '';
    manifestUrl = singleManifestId;
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(stored)) {
        savedManifests = stored.filter(
          (item): item is SavedManifest =>
            typeof item?.id === 'string' && typeof item?.label === 'string',
        );
      }
    } catch {
      savedManifests = [];
    }
    void preloadManifestLibrary([
      ...SEEDED_MANIFESTS,
      ...savedManifests.filter(
        (saved) => !SEEDED_MANIFESTS.some((seeded) => seeded.id === saved.id),
      ),
    ]);
  });
</script>

<section class="manifest-manager" aria-label={$t('workspace.manifestManager.ariaLabel')}>
  <header class="manifest-manager__header">
    <div>
      <span class="manifest-manager__eyebrow">{$t('workspace.manifestManager.eyebrow')}</span>
      <h2>{$t('workspace.manifestManager.title')}</h2>
    </div>
    <button type="button" aria-label={$t('workspace.manifestManager.close')} onclick={() => onclose?.()}>
      <X size={17} />
    </button>
  </header>

  <div class="manifest-manager__content">
    <form
      class="manifest-manager__form"
      onsubmit={(event) => {
        event.preventDefault();
        void loadManifest(false);
      }}
    >
      <label for="manifest-manager-url">{$t('workspace.manifestManager.url')}</label>
      <input
        id="manifest-manager-url"
        type="url"
        bind:value={manifestUrl}
        placeholder={$t('workspace.manifestManager.urlPlaceholder')}
        required
      />

      {#if isMultiView}
        <label for="manifest-manager-window">{$t('workspace.manifestManager.targetWindow')}</label>
        <select id="manifest-manager-window" bind:value={selectedWindowId}>
          {#each windows as windowNode, index (windowNode.id)}
            <option value={windowNode.id}>
              {$t('workspace.manifestManager.window', { number: index + 1 })}{windowNode.id === workspace?.activeWindowId ? ` — ${$t('workspace.manifestManager.active')}` : ''}
            </option>
          {/each}
        </select>
      {/if}

      {#if loadError}<p class="manifest-manager__error" role="alert">{loadError}</p>{/if}

      <div class="manifest-manager__actions">
        <button class="manifest-manager__primary" type="submit" disabled={isLoading}>
          {isLoading
            ? $t('workspace.manifestManager.loading')
            : isMultiView
              ? $t('workspace.manifestManager.loadSelected')
              : $t('workspace.manifestManager.load')}
        </button>
        {#if isMultiView}
          <button
            class="manifest-manager__secondary"
            type="button"
            disabled={isLoading || !manifestUrl.trim()}
            onclick={() => void loadManifest(true)}
          >{$t('workspace.manifestManager.replaceAll')}</button>
        {/if}
      </div>
    </form>

    <div class="manifest-manager__library">
      <div class="manifest-manager__library-heading">
        <h3>{$t('workspace.manifestManager.library')}</h3>
        <span>{$t('workspace.manifestManager.resourceCount', { count: availableManifests.length })}</span>
      </div>
      <div class="manifest-manager__list">
        {#each availableManifests as manifest (manifest.id)}
          <div
            class="manifest-card"
            class:manifest-card--selected={manifest.id === manifestUrl}
          >
            <button
              class="manifest-card__select"
              type="button"
              disabled={isLoading}
              onclick={() => {
                manifestUrl = manifest.id;
                loadError = '';
                void loadManifest(false, manifest.id);
              }}
            >
              <span class="manifest-card__thumbnail">
                {#if thumbnails[manifest.id]}
                  <img src={thumbnails[manifest.id] ?? ''} alt="" />
                {:else}
                  <img class="manifest-card__iiif" src={iiifIcon} alt="" />
                {/if}
              </span>
              <span class="manifest-card__text">
                <strong>{manifest.label}</strong>
                <small>{manifest.id}</small>
              </span>
            </button>
            {#if !isSeededManifest(manifest.id)}
              <button
                class="manifest-card__remove"
                type="button"
                aria-label={$t('workspace.manifestManager.removeAria', { label: manifest.label })}
                title={$t('workspace.manifestManager.remove')}
                disabled={isLoading}
                onclick={() => removeManifest(manifest.id)}
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .manifest-manager {
    box-sizing: border-box;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    height: 100%;
    color: var(--viewer-text, #e4edf8);
    background: color-mix(in srgb, var(--viewer-bg, #07111d) 96%, transparent);
    backdrop-filter: blur(16px);
    overflow: hidden;
  }

  .manifest-manager__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 28px 34px 22px;
    border-bottom: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
  }

  h2,
  h3 {
    margin: 0;
  }

  h2 {
    font-size: 26px;
  }

  .manifest-manager__eyebrow {
    display: block;
    margin-bottom: 5px;
    font-size: 10px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    opacity: 0.62;
  }

  .manifest-manager__header button {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    cursor: pointer;
  }

  .manifest-manager__content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: 22px;
    padding: 30px 34px;
    min-height: 0;
    overflow: hidden;
  }

  .manifest-manager__form {
    display: grid;
    gap: 10px;
    padding: 22px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.035);
  }

  label {
    margin-top: 5px;
    font-size: 12px;
    font-weight: 650;
  }

  input,
  select {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 11px 12px;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.18));
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.2);
    color: inherit;
  }

  .manifest-manager__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 8px;
  }

  .manifest-manager__primary,
  .manifest-manager__secondary {
    min-height: 40px;
    padding: 0 15px;
    border-radius: 9px;
    font-weight: 650;
    cursor: pointer;
  }

  .manifest-manager__primary {
    border: 1px solid #43ccff;
    background: #26bcef;
    color: #03121b;
  }

  .manifest-manager__secondary {
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
  }

  button:disabled {
    cursor: default;
    opacity: 0.48;
  }

  .manifest-manager__error {
    margin: 4px 0;
    color: #ff9292;
    font-size: 12px;
  }

  .manifest-manager__library-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .manifest-manager__library {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    overflow: hidden;
  }

  .manifest-manager__library-heading span {
    font-size: 11px;
    opacity: 0.58;
  }

  .manifest-manager__list {
    display: grid;
    align-content: start;
    gap: 8px;
    min-height: 0;
    padding-right: 6px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--viewer-panel-border, rgba(255, 255, 255, 0.18)) transparent;
  }

  .manifest-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    padding: 0;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.12));
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.035);
    color: inherit;
    overflow: hidden;
  }

  .manifest-card:hover,
  .manifest-card--selected {
    border-color: rgba(42, 199, 255, 0.64);
    background: rgba(42, 199, 255, 0.1);
  }

  .manifest-card__select {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    min-width: 0;
    padding: 13px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .manifest-card__select:focus-visible,
  .manifest-card__remove:focus-visible {
    outline: 2px solid var(--viewer-accent-2, #2ac7ff);
    outline-offset: -3px;
  }

  .manifest-card__select:disabled,
  .manifest-card__remove:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .manifest-card__remove {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    margin-right: 12px;
    padding: 0;
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.14));
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--viewer-muted, #9aa6b2);
    cursor: pointer;
  }

  .manifest-card__remove:hover:not(:disabled) {
    border-color: rgba(255, 112, 112, 0.62);
    background: rgba(255, 92, 92, 0.12);
    color: #ff9b9b;
  }

  .manifest-card__thumbnail {
    display: grid;
    place-items: center;
    width: 72px;
    height: 52px;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.22);
    overflow: hidden;
  }

  .manifest-card__thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .manifest-card__thumbnail .manifest-card__iiif {
    width: 28px;
    height: 28px;
    object-fit: contain;
    filter: invert(1);
    opacity: 0.82;
  }

  .manifest-card__text,
  .manifest-card strong,
  .manifest-card small {
    display: block;
    min-width: 0;
  }

  .manifest-card strong {
    font-size: 13px;
  }

  .manifest-card small {
    margin-top: 4px;
    overflow: hidden;
    color: inherit;
    font-size: 10px;
    opacity: 0.55;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.viewer:is([data-theme='light'], [data-theme='sepia'])) .manifest-card__thumbnail .manifest-card__iiif {
    filter: none;
  }

  @media (max-width: 820px) {
    .manifest-manager__content {
      padding: 20px;
    }

    .manifest-manager__header {
      padding: 22px 20px 18px;
    }
  }
</style>
