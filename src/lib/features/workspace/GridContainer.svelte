<script lang="ts">
  import type { WorkspaceNode } from '../../core/types/workspace';
  import WorkspaceWindow from './WorkspaceWindow.svelte';
  import GridContainer from './GridContainer.svelte';

  interface Props {
    node: WorkspaceNode;
    startIndex?: number;
    activeWindowId?: string | null;
    onfocuswindow?: ((id: string) => void) | undefined;
    onmovewindow?:
      | ((detail: { id: string; direction: 'left' | 'right' | 'up' | 'down' }) => void)
      | undefined;
    onclosewindow?: ((id: string) => void) | undefined;
    onloadmanifest?: ((detail: { id: string; manifestId: string }) => void) | undefined;
  }

  let {
    node,
    startIndex = 1,
    activeWindowId = null,
    onfocuswindow = undefined,
    onmovewindow = undefined,
    onclosewindow = undefined,
    onloadmanifest = undefined,
  }: Props = $props();

  const countWindows = (target: WorkspaceNode): number => {
    if (target.type === 'window') return 1;
    return target.children.reduce((count, child) => count + countWindows(child), 0);
  };
</script>

{#if node.type === 'row'}
  <div class="workspace-grid workspace-grid--row">
    {#each node.children as child, index (`row-${index}`)}
      {@const paneStartIndex =
        startIndex +
        node.children
          .slice(0, index)
          .reduce((count, sibling) => count + countWindows(sibling), 0)}
      <div class="workspace-grid__pane">
        <GridContainer
          node={child}
          startIndex={paneStartIndex}
          {activeWindowId}
          {onfocuswindow}
          {onmovewindow}
          {onclosewindow}
          {onloadmanifest}
        />
      </div>
    {/each}
  </div>
{:else if node.type === 'column'}
  <div class="workspace-grid workspace-grid--column">
    {#each node.children as child, index (`col-${index}`)}
      {@const paneStartIndex =
        startIndex +
        node.children
          .slice(0, index)
          .reduce((count, sibling) => count + countWindows(sibling), 0)}
      <div class="workspace-grid__pane">
        <GridContainer
          node={child}
          startIndex={paneStartIndex}
          {activeWindowId}
          {onfocuswindow}
          {onmovewindow}
          {onclosewindow}
          {onloadmanifest}
        />
      </div>
    {/each}
  </div>
{:else}
  <WorkspaceWindow
    windowNode={node}
    windowNumber={startIndex}
    active={node.id === activeWindowId}
    {onfocuswindow}
    {onmovewindow}
    {onclosewindow}
    {onloadmanifest}
  />
{/if}

<style>
  .workspace-grid {
    display: flex;
    gap: 10px;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .workspace-grid--row {
    flex-direction: column;
  }

  .workspace-grid--column {
    flex-direction: row;
  }

  .workspace-grid__pane {
    flex: 1 1 0%;
    display: flex;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
</style>
