<script lang="ts">
  import { onDestroy } from "svelte";
  import type { WorkspaceNode } from "../../core/types/workspace";
  import WorkspaceWindow from "./WorkspaceWindow.svelte";
  import GridContainer from "./GridContainer.svelte";
  import { getSplitNodeId } from "./workspaceStore.svelte";
  import { t } from "../../i18n";

  interface Props {
    node: WorkspaceNode;
    startIndex?: number;
    activeWindowId?: string | null;
    onfocuswindow?: ((id: string) => void) | undefined;
    onmovewindow?:
      | ((detail: {
          id: string;
          direction: "left" | "right" | "up" | "down";
        }) => void)
      | undefined;
    onclosewindow?: ((id: string) => void) | undefined;
    onloadmanifest?:
      ((detail: { id: string; manifestId: string }) => void) | undefined;
    oncanvaschange?:
      ((detail: { id: string; canvasIndex: number }) => void) | undefined;
    onresizesplit?:
      ((detail: { targetId: string; sizes: number[] }) => void) | undefined;
    onopenmanifestmanager?: ((id: string) => void) | undefined;
  }

  let {
    node,
    startIndex = 1,
    activeWindowId = null,
    onfocuswindow = undefined,
    onmovewindow = undefined,
    onclosewindow = undefined,
    onloadmanifest = undefined,
    oncanvaschange = undefined,
    onresizesplit = undefined,
    onopenmanifestmanager = undefined,
  }: Props = $props();

  let gridElement: HTMLDivElement | null = $state(null);
  let stopDragging: (() => void) | null = null;

  const countWindows = (target: WorkspaceNode): number => {
    if (target.type === "window") return 1;
    return target.children.reduce(
      (count, child) => count + countWindows(child),
      0,
    );
  };

  const sizesForNode = (target: WorkspaceNode): number[] => {
    if (target.type === "window") return [];
    if (target.sizes?.length === target.children.length) return target.sizes;
    return target.children.map(() => 100 / target.children.length);
  };

  const beginResize = (event: PointerEvent, splitterIndex: number) => {
    if (node.type === "window" || !gridElement) return;
    event.preventDefault();
    event.stopPropagation();

    const startSizes = [...sizesForNode(node)];
    const rect = gridElement.getBoundingClientRect();
    const dimension = node.type === "column" ? rect.width : rect.height;
    const startPosition =
      node.type === "column" ? event.clientX : event.clientY;
    const pairTotal =
      (startSizes[splitterIndex] ?? 0) + (startSizes[splitterIndex + 1] ?? 0);
    const minimum = Math.min(12, pairTotal / 3);
    const targetId = getSplitNodeId(node);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentPosition =
        node.type === "column" ? moveEvent.clientX : moveEvent.clientY;
      const delta =
        dimension > 0
          ? ((currentPosition - startPosition) / dimension) * 100
          : 0;
      const first = Math.max(
        minimum,
        Math.min(pairTotal - minimum, (startSizes[splitterIndex] ?? 0) + delta),
      );
      const nextSizes = [...startSizes];
      nextSizes[splitterIndex] = first;
      nextSizes[splitterIndex + 1] = pairTotal - first;
      onresizesplit?.({ targetId, sizes: nextSizes });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      stopDragging = null;
    };

    stopDragging?.();
    stopDragging = handlePointerUp;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const resizeWithKeyboard = (event: KeyboardEvent, splitterIndex: number) => {
    if (node.type === "window") return;
    const isBackward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const isForward = event.key === "ArrowRight" || event.key === "ArrowDown";
    if (!isBackward && !isForward) return;
    event.preventDefault();
    const sizes = [...sizesForNode(node)];
    const pairTotal =
      (sizes[splitterIndex] ?? 0) + (sizes[splitterIndex + 1] ?? 0);
    const nextFirst = Math.max(
      10,
      Math.min(
        pairTotal - 10,
        (sizes[splitterIndex] ?? 0) + (isBackward ? -2 : 2),
      ),
    );
    sizes[splitterIndex] = nextFirst;
    sizes[splitterIndex + 1] = pairTotal - nextFirst;
    onresizesplit?.({ targetId: getSplitNodeId(node), sizes });
  };

  onDestroy(() => stopDragging?.());
</script>

{#if node.type === "row"}
  <div class="workspace-grid workspace-grid--row" bind:this={gridElement}>
    {#each node.children as child, index (`row-${index}`)}
      {@const paneStartIndex =
        startIndex +
        node.children
          .slice(0, index)
          .reduce((count, sibling) => count + countWindows(sibling), 0)}
      <div
        class="workspace-grid__pane"
        style:flex={`${sizesForNode(node)[index] ?? 1} 1 0%`}
      >
        <GridContainer
          node={child}
          startIndex={paneStartIndex}
          {activeWindowId}
          {onfocuswindow}
          {onmovewindow}
          {onclosewindow}
          {onloadmanifest}
          {oncanvaschange}
          {onresizesplit}
          {onopenmanifestmanager}
        />
      </div>
      {#if index < node.children.length - 1}
        <input
          class="workspace-splitter workspace-splitter--row"
          type="range"
          aria-label={$t('workspace.resizeRows')}
          min="10"
          max="90"
          value={Math.round(sizesForNode(node)[index] ?? 50)}
          onpointerdown={(event) => beginResize(event, index)}
          onkeydown={(event) => resizeWithKeyboard(event, index)}
        />
      {/if}
    {/each}
  </div>
{:else if node.type === "column"}
  <div class="workspace-grid workspace-grid--column" bind:this={gridElement}>
    {#each node.children as child, index (`col-${index}`)}
      {@const paneStartIndex =
        startIndex +
        node.children
          .slice(0, index)
          .reduce((count, sibling) => count + countWindows(sibling), 0)}
      <div
        class="workspace-grid__pane"
        style:flex={`${sizesForNode(node)[index] ?? 1} 1 0%`}
      >
        <GridContainer
          node={child}
          startIndex={paneStartIndex}
          {activeWindowId}
          {onfocuswindow}
          {onmovewindow}
          {onclosewindow}
          {onloadmanifest}
          {oncanvaschange}
          {onresizesplit}
          {onopenmanifestmanager}
        />
      </div>
      {#if index < node.children.length - 1}
        <input
          class="workspace-splitter workspace-splitter--column"
          type="range"
          aria-label={$t('workspace.resizeColumns')}
          min="10"
          max="90"
          value={Math.round(sizesForNode(node)[index] ?? 50)}
          onpointerdown={(event) => beginResize(event, index)}
          onkeydown={(event) => resizeWithKeyboard(event, index)}
        />
      {/if}
    {/each}
  </div>
{:else}
  <WorkspaceWindow
    windowNode={node}
    windowNumber={startIndex}
    {onfocuswindow}
    {onmovewindow}
    {onclosewindow}
    {onloadmanifest}
    {oncanvaschange}
    {onopenmanifestmanager}
  />
{/if}

<style>
  .workspace-grid {
    display: flex;
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
    display: flex;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .workspace-splitter {
    --splitter-handle: rgba(151, 165, 179, 0.62);
    position: relative;
    flex: 0 0 10px;
    width: auto;
    height: auto;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 0;
    background: transparent;
    appearance: none;
    touch-action: none;
    outline: none;
    z-index: 4;
  }

  .workspace-splitter--column {
    cursor: col-resize;
    background: linear-gradient(var(--splitter-handle), var(--splitter-handle))
      center / 4px 30px no-repeat;
  }

  .workspace-splitter--row {
    cursor: row-resize;
    background: linear-gradient(var(--splitter-handle), var(--splitter-handle))
      center / 30px 4px no-repeat;
  }

  .workspace-splitter::-webkit-slider-runnable-track {
    background: transparent;
  }

  .workspace-splitter::-webkit-slider-thumb {
    width: 1px;
    height: 1px;
    appearance: none;
    opacity: 0;
  }

  .workspace-splitter::-moz-range-track {
    background: transparent;
  }

  .workspace-splitter::-moz-range-thumb {
    width: 1px;
    height: 1px;
    border: 0;
    background: transparent;
    opacity: 0;
  }

  .workspace-splitter:hover,
  .workspace-splitter:focus-visible {
    --splitter-handle: rgba(220, 228, 236, 0.9);
    filter: drop-shadow(0 0 3px rgba(220, 228, 236, 0.28));
  }
</style>
