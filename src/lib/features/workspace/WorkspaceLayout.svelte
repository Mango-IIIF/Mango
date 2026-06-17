<script lang="ts">
  import { get } from 'svelte/store';
  import { manifestsStore } from '../../state/manifests';
  import type { ViewerConfig } from '../../core/types/config';
  import type { ViewerPlugin } from '../../core/types/plugin';
  import type { WorkspaceLayoutPreset } from '../../core/types/workspace';
  import GridContainer from './GridContainer.svelte';
  import SettingsPopover from './SettingsPopover.svelte';
  import { WorkspaceStore } from './workspaceStore.svelte';
  import { setLocale, t } from '../../i18n';

  interface Props {
    manifestId?: string;
    config?: ViewerConfig | undefined;
    plugins?: ViewerPlugin[];
  }

  let { manifestId = '', config = undefined, plugins = [] }: Props = $props();

  const createInitialWorkspace = () => new WorkspaceStore(manifestId);
  const initialLocale = () => (config?.language ?? 'en').toLowerCase();
  const workspace = createInitialWorkspace();
  let theme = $state<'dark' | 'light'>('dark');
  let locale = $state(initialLocale());
  let activeLayout = $state<WorkspaceLayoutPreset>('1x1');

  const handleLayoutChange = (layout: WorkspaceLayoutPreset) => {
    activeLayout = layout;
    workspace.setLayoutPreset(layout);
  };

  const activeManifestEntry = $derived.by(() => {
    const active = workspace.activeWindow;
    if (!active?.manifestId) return null;
    return get(manifestsStore)[active.manifestId] ?? null;
  });

  const activeManifestTitle = $derived(
    activeManifestEntry?.label ??
      workspace.activeWindow?.manifestId ??
      'No manifest loaded',
  );
  const activeCanvasCount = $derived(activeManifestEntry?.canvases?.length ?? 0);
  const activeCanvasIndex = $derived((workspace.activeWindow?.canvasIndex ?? 0) + 1);

  $effect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.workspaceTheme = theme;
  });
  $effect(() => {
    setLocale(locale);
  });
</script>

<div class="workspace" data-theme={theme} data-locale={locale}>
  <aside class="workspace__sidebar">
    <div class="workspace__card">
      <div class="workspace__label">{$t('workspace.activeViewport')}</div>
      <div class="workspace__value">{workspace.activeWindowId ?? 'none'}</div>
      <div class="workspace__hint">{$t('workspace.activeViewportHint')}</div>
    </div>

    <div class="workspace__card">
      <div class="workspace__label">{$t('viewer.panels.metadata.title')}</div>
      <div class="workspace__value">{activeManifestTitle}</div>
      <div class="workspace__hint">
        {$t('workspace.canvasPosition', {
          current: activeCanvasIndex,
          total: Math.max(1, activeCanvasCount),
        })}
      </div>
    </div>

    <div class="workspace__card">
      <div class="workspace__label">{$t('viewer.panels.search.title')}</div>
      <div class="workspace__hint">{$t('workspace.searchHint')}</div>
    </div>

    <div class="workspace__card">
      <div class="workspace__label">{$t('viewer.panels.annotations.title')}</div>
      <div class="workspace__hint">{$t('workspace.annotationsHint')}</div>
    </div>

    <div class="workspace__settings">
      <SettingsPopover
        {activeLayout}
        {theme}
        {locale}
        onlayoutchange={handleLayoutChange}
        onthemechange={(next) => (theme = next)}
        onlocalechange={(next) => {
          locale = next;
          setLocale(next);
        }}
      />
    </div>
  </aside>

  <main class="workspace__main">
    <GridContainer
      node={workspace.layout}
      activeWindowId={workspace.activeWindowId}
      onfocuswindow={(id) => workspace.setActiveWindow(id)}
      onmovewindow={(detail) => workspace.moveWindow(detail.id, detail.direction)}
      onclosewindow={(id) => workspace.closeWindow(id)}
      onloadmanifest={(detail) => {
        workspace.setWindowManifest(detail.id, detail.manifestId);
        workspace.setActiveWindow(detail.id);
      }}
    />
  </main>
</div>

<style>
  .workspace {
    --panel-bg: rgba(12, 22, 34, 0.9);
    --panel-border: rgba(255, 255, 255, 0.12);
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 12px;
    width: 100%;
    height: 100%;
    min-height: 0;
    color: #e4edf8;
  }

  .workspace[data-theme='light'] {
    --panel-bg: rgba(255, 255, 255, 0.86);
    --panel-border: rgba(20, 28, 38, 0.15);
    color: #1d2a37;
  }

  .workspace__sidebar {
    border-radius: 14px;
    border: 1px solid var(--panel-border);
    background: var(--panel-bg);
    backdrop-filter: blur(8px);
    padding: 12px;
    display: grid;
    gap: 10px;
    align-content: start;
    min-height: 0;
    overflow: auto;
  }

  .workspace__card {
    border-radius: 12px;
    border: 1px solid var(--panel-border);
    background: rgba(255, 255, 255, 0.04);
    padding: 10px;
    display: grid;
    gap: 6px;
  }

  .workspace__label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.76;
  }

  .workspace__value {
    font-size: 13px;
    font-weight: 600;
    word-break: break-word;
  }

  .workspace__hint {
    font-size: 12px;
    opacity: 0.76;
  }

  .workspace__settings {
    margin-top: auto;
  }

  .workspace__main {
    min-width: 0;
    min-height: 0;
    height: 100%;
  }

  @container mango-viewer (max-width: 980px) {
    .workspace {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }

    .workspace__sidebar {
      grid-auto-flow: column;
      grid-auto-columns: minmax(220px, 1fr);
      align-content: stretch;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .workspace__settings {
      margin-top: 0;
    }
  }
</style>
