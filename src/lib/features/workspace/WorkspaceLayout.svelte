<script lang="ts">
  import { get } from "svelte/store";
  import { Info, MessageSquareText, Monitor, Search } from "@lucide/svelte";
  import { manifestsStore } from "../../state/manifests";
  import type { ViewerConfig } from "../../core/types/config";
  import type { ViewerPlugin } from "../../core/types/plugin";
  import type { WorkspaceLayoutPreset } from "../../core/types/workspace";
  import GridContainer from "./GridContainer.svelte";
  import SettingsPopover from "./SettingsPopover.svelte";
  import { WorkspaceStore } from "./workspaceStore.svelte";
  import ManifestManager from "./ManifestManager.svelte";
  import iiifIcon from "./iiif_bw.svg";
  import { setLocale, t } from "../../i18n";

  interface Props {
    manifestId?: string;
    config?: ViewerConfig | undefined;
    plugins?: ViewerPlugin[];
  }

  type SidebarTool =
    "viewport" | "metadata" | "search" | "annotations" | "iiif";

  let { manifestId = "", config = undefined, plugins: _plugins = [] }: Props = $props();

  const createInitialWorkspace = () => new WorkspaceStore(manifestId);
  const initialLocale = () => (config?.language ?? "en").toLowerCase();
  const workspace = createInitialWorkspace();
  let theme = $state<"dark" | "light">("dark");
  let locale = $state(initialLocale());
  let activeLayout = $state<WorkspaceLayoutPreset>("1x1");
  let activeTool = $state<SidebarTool>("viewport");

  const isMultiView = $derived(workspace.windows.length > 1);
  const iiifPanelOpen = $derived(activeTool === "iiif");
  const drawerOpen = $derived(activeTool !== "iiif");

  const handleLayoutChange = (layout: WorkspaceLayoutPreset) => {
    activeLayout = layout;
    workspace.setLayoutPreset(layout);
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

  const activateTool = (tool: SidebarTool) => {
    if (isMultiView && ["metadata", "search", "annotations"].includes(tool))
      return;
    activeTool = activeTool === tool && tool !== "viewport" ? "viewport" : tool;
  };

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
      }}
      onmovewindow={(detail) =>
        workspace.moveWindow(detail.id, detail.direction)}
      onclosewindow={(id) => workspace.closeWindow(id)}
      onloadmanifest={(detail) => {
        workspace.setWindowManifest(detail.id, detail.manifestId);
        workspace.setActiveWindow(detail.id);
      }}
      oncanvaschange={(detail) =>
        workspace.setWindowCanvasIndex(detail.id, detail.canvasIndex)}
      onresizesplit={(detail) =>
        workspace.updateSplitSizes(detail.targetId, detail.sizes)}
      onopenmanifestmanager={(id) => {
        workspace.setActiveWindow(id);
        activeTool = 'iiif';
      }}
    />
  </main>

  {#if iiifPanelOpen}
    <div class="workspace__manifest-overlay">
      <ManifestManager
        {workspace}
        onclose={() => (activeTool = "viewport")}
      />
    </div>
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

  .workspace[data-theme="light"] .workspace-rail__button--iiif img {
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

  .workspace-drawer__header h2 {
    margin: 0;
  }

  .workspace-drawer__eyebrow,
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

  .workspace__manifest-overlay {
    position: absolute;
    z-index: 20;
    inset: 0 0 0 58px;
    min-width: 0;
  }

  @container mango-viewer (max-width: 820px) {
    .workspace-drawer {
      display: none;
    }
  }
</style>
