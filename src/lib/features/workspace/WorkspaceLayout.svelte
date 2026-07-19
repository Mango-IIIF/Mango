<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { Info, MessageSquareText, Monitor, Search, Trash2, X } from "@lucide/svelte";
  import iiifIcon from "./iiif_bw.svg";
  import { fetchManifest, manifestsStore } from "../../state/manifests";
  import type { ViewerConfig } from "../../core/types/config";
  import type { ViewerPlugin } from "../../core/types/plugin";
  import type { WorkspaceLayoutPreset } from "../../core/types/workspace";
  import GridContainer from "./GridContainer.svelte";
  import SettingsPopover from "./SettingsPopover.svelte";
  import { WorkspaceStore } from "./workspaceStore.svelte";
  import { setLocale, t } from "../../i18n";

  interface Props {
    manifestId?: string;
    config?: ViewerConfig | undefined;
    plugins?: ViewerPlugin[];
  }

  type SidebarTool =
    "viewport" | "metadata" | "search" | "annotations" | "iiif";
  type SavedManifest = { id: string; label: string };

  const STORAGE_KEY = "mango-workspace-manifests:v1";
  const SEEDED_MANIFESTS: SavedManifest[] = [
    {
      id: "https://iiif.wellcomecollection.org/presentation/v2/b18035723",
      label: "Wellcome Collection — B18035723",
    },
    {
      id: "https://iiif.io/api/cookbook/recipe/0001-mvm-image/manifest.json",
      label: "IIIF Cookbook — Single image",
    },
    {
      id: "https://iiif.io/api/cookbook/recipe/0002-mvm-audio/manifest.json",
      label: "IIIF Cookbook — Audio",
    },
    {
      id: "https://iiif.io/api/cookbook/recipe/0003-mvm-video/manifest.json",
      label: "IIIF Cookbook — Video",
    },
  ];

  let { manifestId = "", config = undefined, plugins = [] }: Props = $props();

  const createInitialWorkspace = () => new WorkspaceStore(manifestId);
  const initialLocale = () => (config?.language ?? "en").toLowerCase();
  const workspace = createInitialWorkspace();
  let theme = $state<"dark" | "light">("dark");
  let locale = $state(initialLocale());
  let activeLayout = $state<WorkspaceLayoutPreset>("1x1");
  let activeTool = $state<SidebarTool>("viewport");
  let manifestUrl = $state("");
  let selectedWindowId = $state(workspace.activeWindowId ?? "");
  let savedManifests = $state<SavedManifest[]>([]);
  let loadError = $state("");
  let isLoading = $state(false);

  const isMultiView = $derived(workspace.windows.length > 1);
  const iiifPanelOpen = $derived(activeTool === "iiif");
  const drawerOpen = $derived(activeTool !== "iiif");

  const handleLayoutChange = (layout: WorkspaceLayoutPreset) => {
    activeLayout = layout;
    workspace.setLayoutPreset(layout);
    selectedWindowId =
      workspace.activeWindowId ?? workspace.windows[0]?.id ?? "";
    if (
      layout !== "1x1" &&
      ["metadata", "search", "annotations"].includes(activeTool)
    ) {
      activeTool = "viewport";
    }
  };

  const activeManifestEntry = $derived.by(() => {
    const active = workspace.activeWindow;
    if (!active?.manifestId) return null;
    return get(manifestsStore)[active.manifestId] ?? null;
  });

  const activeManifestTitle = $derived(
    activeManifestEntry?.label ??
      workspace.activeWindow?.manifestId ??
      "No manifest loaded",
  );
  const activeCanvasCount = $derived(
    activeManifestEntry?.canvases?.length ?? 0,
  );
  const activeCanvasIndex = $derived(
    (workspace.activeWindow?.canvasIndex ?? 0) + 1,
  );
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
      // The viewer still works when storage is unavailable or full.
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
    if (manifestUrl === id) manifestUrl = "";
    storeSavedManifests();
  };

  const loadManifest = async (replaceAll = false) => {
    const id = manifestUrl.trim();
    if (!id || isLoading) return;
    loadError = "";
    isLoading = true;
    await fetchManifest(id);
    const entry = get(manifestsStore)[id];
    isLoading = false;
    if (entry?.error) {
      loadError = $t("workspace.manifestManager.loadError", { error: entry.error });
      return;
    }

    persistManifest(id, entry?.label ?? id);
    if (replaceAll) {
      workspace.windows.forEach((windowNode) =>
        workspace.setWindowManifest(windowNode.id, id),
      );
    } else {
      const targetId = isMultiView
        ? selectedWindowId || workspace.activeWindowId
        : workspace.activeWindowId;
      if (targetId) {
        workspace.setWindowManifest(targetId, id);
        workspace.setActiveWindow(targetId);
        selectedWindowId = targetId;
      }
    }
    activeTool = "viewport";
  };

  const selectManifest = (manifest: SavedManifest) => {
    manifestUrl = manifest.id;
    loadError = "";
  };

  const activateTool = (tool: SidebarTool) => {
    if (isMultiView && ["metadata", "search", "annotations"].includes(tool))
      return;
    activeTool = activeTool === tool && tool !== "viewport" ? "viewport" : tool;
    if (tool === "iiif") {
      selectedWindowId =
        workspace.activeWindowId ?? workspace.windows[0]?.id ?? "";
    }
  };

  onMount(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        savedManifests = stored.filter(
          (item): item is SavedManifest =>
            typeof item?.id === "string" && typeof item?.label === "string",
        );
      }
    } catch {
      savedManifests = [];
    }
  });

  $effect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.workspaceTheme = theme;
  });
  $effect(() => setLocale(locale));
</script>

<div class="workspace" data-theme={theme} data-locale={locale}>
  <aside class="workspace-rail" aria-label={$t("workspace.sidebar.workspaceTools")}>
    <div class="workspace-rail__top">
      <button
        class="workspace-rail__button"
        class:workspace-rail__button--active={activeTool === "viewport"}
        type="button"
        aria-label={$t("workspace.activeViewport")}
        title={$t("workspace.activeViewport")}
        onclick={() => activateTool("viewport")}><Monitor size={20} /></button
      >
      <button
        class="workspace-rail__button"
        class:workspace-rail__button--active={activeTool === "metadata"}
        type="button"
        aria-label={$t("viewer.panels.metadata.title")}
        title={isMultiView
          ? $t("workspace.unavailableMultiView")
          : $t("viewer.panels.metadata.title")}
        disabled={isMultiView}
        onclick={() => activateTool("metadata")}><Info size={20} /></button
      >
      <button
        class="workspace-rail__button"
        class:workspace-rail__button--active={activeTool === "search"}
        type="button"
        aria-label={$t("viewer.panels.search.title")}
        title={isMultiView
          ? $t("workspace.unavailableMultiView")
          : $t("viewer.panels.search.title")}
        disabled={isMultiView}
        onclick={() => activateTool("search")}><Search size={20} /></button
      >
      <button
        class="workspace-rail__button"
        class:workspace-rail__button--active={activeTool === "annotations"}
        type="button"
        aria-label={$t("viewer.panels.annotations.title")}
        title={isMultiView
          ? $t("workspace.unavailableMultiView")
          : $t("viewer.panels.annotations.title")}
        disabled={isMultiView}
        onclick={() => activateTool("annotations")}
        ><MessageSquareText size={20} /></button
      >
    </div>

    <div class="workspace-rail__bottom">
      <button
        class="workspace-rail__button workspace-rail__button--iiif"
        class:workspace-rail__button--active={iiifPanelOpen}
        type="button"
        aria-label={$t("workspace.sidebar.manageIiif")}
        title={$t("workspace.sidebar.manageIiif")}
        onclick={() => activateTool("iiif")}
        ><img src={iiifIcon} alt="" /></button
      >
      <SettingsPopover
        {activeLayout}
        {theme}
        {locale}
        placement="right"
        onlayoutchange={handleLayoutChange}
        onthemechange={(next) => (theme = next)}
        onlocalechange={(next) => {
          locale = next;
          setLocale(next);
        }}
      />
    </div>
  </aside>

  {#if drawerOpen}
    <aside class="workspace-drawer" aria-label={$t("workspace.details")}>
      <div class="workspace-drawer__header">
        <div>
          <span class="workspace-drawer__eyebrow">{$t("workspace.eyebrow")}</span>
          <h2>
            {activeTool === "viewport"
              ? $t("workspace.activeViewport")
              : activeTool === "metadata"
                ? $t("viewer.panels.metadata.title")
                : activeTool === "search"
                  ? $t("viewer.panels.search.title")
                  : $t("viewer.panels.annotations.title")}
          </h2>
        </div>
      </div>

      {#if activeTool === "viewport"}
        <div class="workspace-drawer__section">
          <span class="workspace-drawer__label">{$t("workspace.selectedWindow")}</span>
          <strong>{workspace.activeWindowId ?? $t("workspace.none")}</strong>
          <p>{activeManifestTitle}</p>
          <span class="workspace-drawer__muted">
            {$t("workspace.canvasPosition", {
              current: activeCanvasIndex,
              total: Math.max(1, activeCanvasCount),
            })}
          </span>
        </div>
        {#if isMultiView}
          <p class="workspace-drawer__notice">
            {$t("workspace.singleViewOnly")}
          </p>
        {/if}
      {:else if activeTool === "metadata"}
        <div class="workspace-drawer__section">
          <span class="workspace-drawer__label">{$t("workspace.manifest")}</span>
          <strong>{activeManifestTitle}</strong>
          <span class="workspace-drawer__muted"
            >{workspace.activeWindow?.manifestId}</span
          >
        </div>
      {:else if activeTool === "search"}
        <div class="workspace-drawer__section">
          <p>{$t("workspace.searchHint")}</p>
        </div>
      {:else}
        <div class="workspace-drawer__section">
          <p>{$t("workspace.annotationsHint")}</p>
        </div>
      {/if}
    </aside>
  {/if}

  <main class="workspace__main">
    <GridContainer
      node={workspace.layout}
      activeWindowId={workspace.activeWindowId}
      onfocuswindow={(id) => {
        workspace.setActiveWindow(id);
        selectedWindowId = id;
      }}
      onmovewindow={(detail) =>
        workspace.moveWindow(detail.id, detail.direction)}
      onclosewindow={(id) => workspace.closeWindow(id)}
      onloadmanifest={(detail) => {
        workspace.setWindowManifest(detail.id, detail.manifestId);
        workspace.setActiveWindow(detail.id);
        selectedWindowId = detail.id;
      }}
      oncanvaschange={(detail) =>
        workspace.setWindowCanvasIndex(detail.id, detail.canvasIndex)}
      onresizesplit={(detail) =>
        workspace.updateSplitSizes(detail.targetId, detail.sizes)}
      onopenmanifestmanager={(id) => {
        workspace.setActiveWindow(id);
        selectedWindowId = id;
        activeTool = 'iiif';
      }}
    />
  </main>

  {#if iiifPanelOpen}
    <section class="manifest-manager" aria-label={$t("workspace.manifestManager.ariaLabel")}>
      <header class="manifest-manager__header">
        <div>
          <span class="manifest-manager__eyebrow">{$t("workspace.manifestManager.eyebrow")}</span>
          <h2>{$t("workspace.manifestManager.title")}</h2>
        </div>
        <button
          class="manifest-manager__close"
          type="button"
          aria-label={$t("workspace.manifestManager.close")}
          onclick={() => (activeTool = "viewport")}><X size={17} /></button
        >
      </header>

      <div class="manifest-manager__content">
        <form
          class="manifest-manager__form"
          onsubmit={(event) => {
            event.preventDefault();
            void loadManifest(false);
          }}
        >
          <label for="workspace-manifest-url">{$t("workspace.manifestManager.url")}</label>
          <div class="manifest-manager__input-row">
            <input
              id="workspace-manifest-url"
              type="url"
              bind:value={manifestUrl}
              placeholder={$t("workspace.manifestManager.urlPlaceholder")}
              required
            />
          </div>

          {#if isMultiView}
            <label for="workspace-target-window">{$t("workspace.manifestManager.targetWindow")}</label>
            <select id="workspace-target-window" bind:value={selectedWindowId}>
              {#each workspace.windows as windowNode, index (windowNode.id)}
                <option value={windowNode.id}>
                  {$t("workspace.manifestManager.window", { number: index + 1 })}{windowNode.id === workspace.activeWindowId
                    ? ` — ${$t("workspace.manifestManager.active")}`
                    : ""}
                </option>
              {/each}
            </select>
          {/if}

          {#if loadError}<p class="manifest-manager__error" role="alert">
              {loadError}
            </p>{/if}

          <div class="manifest-manager__actions">
            <button
              class="manifest-manager__primary"
              type="submit"
              disabled={isLoading}
            >
              {isLoading
                ? $t("workspace.manifestManager.loading")
                : isMultiView
                  ? $t("workspace.manifestManager.loadSelected")
                  : $t("workspace.manifestManager.load")}
            </button>
            {#if isMultiView}
              <button
                class="manifest-manager__secondary"
                type="button"
                disabled={isLoading || !manifestUrl.trim()}
                onclick={() => void loadManifest(true)}
                >{$t("workspace.manifestManager.replaceAll")}</button
              >
            {/if}
          </div>
        </form>

        <div class="manifest-manager__library">
          <div class="manifest-manager__library-heading">
            <h3>{$t("workspace.manifestManager.library")}</h3>
            <span>{$t("workspace.manifestManager.resourceCount", { count: availableManifests.length })}</span>
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
                  onclick={() => selectManifest(manifest)}
                >
                  <img src={iiifIcon} alt="" />
                  <span>
                    <strong>{manifest.label}</strong>
                    <small>{manifest.id}</small>
                  </span>
                </button>
                {#if !isSeededManifest(manifest.id)}
                  <button
                    class="manifest-card__remove"
                    type="button"
                    aria-label={$t("workspace.manifestManager.removeAria", { label: manifest.label })}
                    title={$t("workspace.manifestManager.remove")}
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
  {/if}
</div>

<style>
  .workspace {
    --panel-bg: rgba(12, 22, 34, 0.94);
    --panel-border: rgba(255, 255, 255, 0.12);
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    color: #e4edf8;
    background: #07111d;
    overflow: hidden;
  }

  .workspace[data-theme="light"] {
    --panel-bg: rgba(255, 255, 255, 0.96);
    --panel-border: rgba(20, 28, 38, 0.15);
    color: #1d2a37;
    background: #eaf0f6;
  }

  .workspace-rail {
    position: relative;
    z-index: 30;
    flex: 0 0 58px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 10px 8px;
    border-right: 1px solid var(--panel-border);
    background: var(--panel-bg);
  }

  .workspace-rail__top,
  .workspace-rail__bottom {
    display: grid;
    gap: 8px;
  }

  .workspace-rail__button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 10px;
    color: inherit;
    background: transparent;
    cursor: pointer;
  }

  .workspace-rail__button:hover:not(:disabled),
  .workspace-rail__button--active {
    border-color: rgba(42, 199, 255, 0.45);
    background: rgba(42, 199, 255, 0.16);
    color: #75dbff;
  }

  .workspace-rail__button:disabled {
    cursor: not-allowed;
    opacity: 0.28;
  }

  .workspace-rail__button--iiif img {
    width: 22px;
    height: 22px;
    filter: invert(1);
  }

  .workspace[data-theme="light"] .workspace-rail__button--iiif img,
  .workspace[data-theme="light"] .manifest-card img {
    filter: none;
  }

  .workspace-drawer {
    flex: 0 0 280px;
    min-width: 0;
    padding: 18px;
    border-right: 1px solid var(--panel-border);
    background: var(--panel-bg);
    overflow: auto;
  }

  .workspace-drawer__header h2,
  .manifest-manager h2,
  .manifest-manager h3 {
    margin: 0;
  }

  .workspace-drawer__eyebrow,
  .manifest-manager__eyebrow,
  .workspace-drawer__label {
    display: block;
    margin-bottom: 5px;
    font-size: 10px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    opacity: 0.62;
  }

  .workspace-drawer__header h2 {
    font-size: 18px;
  }

  .workspace-drawer__section {
    display: grid;
    gap: 9px;
    margin-top: 24px;
    padding: 14px;
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.035);
    overflow-wrap: anywhere;
  }

  .workspace-drawer__section p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
  }

  .workspace-drawer__muted,
  .workspace-drawer__notice {
    font-size: 12px;
    opacity: 0.64;
  }

  .workspace-drawer__notice {
    padding: 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    line-height: 1.45;
  }

  .workspace__main {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    height: 100%;
    padding: 10px;
  }

  .manifest-manager {
    position: absolute;
    z-index: 20;
    inset: 0 0 0 58px;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: color-mix(in srgb, #07111d 96%, transparent);
    backdrop-filter: blur(16px);
    overflow: hidden;
  }

  .workspace[data-theme="light"] .manifest-manager {
    background: color-mix(in srgb, #f4f7fb 97%, transparent);
  }

  .manifest-manager__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 28px 34px 22px;
    border-bottom: 1px solid var(--panel-border);
  }

  .manifest-manager__header h2 {
    font-size: 26px;
  }

  .manifest-manager__close {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
    cursor: pointer;
  }

  .manifest-manager__content {
    display: grid;
    grid-template-columns: minmax(280px, 0.8fr) minmax(360px, 1.2fr);
    gap: 34px;
    padding: 30px 34px;
    overflow: auto;
  }

  .manifest-manager__form {
    align-self: start;
    display: grid;
    gap: 10px;
    padding: 22px;
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.035);
  }

  .manifest-manager__form label {
    margin-top: 5px;
    font-size: 12px;
    font-weight: 650;
  }

  .manifest-manager input,
  .manifest-manager select {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 11px 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.2);
    color: inherit;
  }

  .workspace[data-theme="light"] .manifest-manager input,
  .workspace[data-theme="light"] .manifest-manager select {
    border-color: rgba(20, 28, 38, 0.2);
    background: rgba(255, 255, 255, 0.8);
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
    border: 1px solid var(--panel-border);
    background: rgba(255, 255, 255, 0.06);
    color: inherit;
  }

  .manifest-manager button:disabled {
    cursor: default;
    opacity: 0.48;
  }

  .manifest-manager__error {
    margin: 4px 0;
    color: #ff9292;
    font-size: 12px;
  }

  .manifest-manager__library {
    min-width: 0;
  }

  .manifest-manager__library-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .manifest-manager__library-heading span {
    font-size: 11px;
    opacity: 0.58;
  }

  .manifest-manager__list {
    display: grid;
    gap: 8px;
  }

  .manifest-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    padding: 0;
    border: 1px solid var(--panel-border);
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
    grid-template-columns: 34px minmax(0, 1fr);
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
    outline: 2px solid #2ac7ff;
    outline-offset: -3px;
  }

  .manifest-card__remove {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    margin-right: 12px;
    padding: 0;
    border: 1px solid var(--panel-border);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.05);
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
  }

  .manifest-card__remove:hover {
    border-color: rgba(255, 112, 112, 0.62);
    background: rgba(255, 92, 92, 0.12);
    color: #ff9b9b;
    opacity: 1;
  }

  .manifest-card img {
    width: 28px;
    height: 28px;
    filter: invert(1);
    opacity: 0.82;
  }

  .manifest-card span,
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

  @container mango-viewer (max-width: 820px) {
    .workspace-drawer {
      display: none;
    }

    .manifest-manager__content {
      grid-template-columns: minmax(0, 1fr);
      padding: 20px;
    }

    .manifest-manager__header {
      padding: 22px 20px 18px;
    }
  }
</style>
