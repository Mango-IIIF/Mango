import { describe, expect, it } from 'vitest';
import type { WindowNode, WorkspaceNode } from '../../../core/types/workspace';
import { getSplitNodeId, WorkspaceStore } from '../workspaceStore.svelte';

const collectWindows = (node: WorkspaceNode): WindowNode[] => {
  if (node.type === 'window') return [node];
  return node.children.flatMap((child) => collectWindows(child));
};

describe('WorkspaceStore', () => {
  it('keeps existing viewers when expanding from two panes to 2x2', () => {
    const store = new WorkspaceStore('manifest-a');
    const initialWindows = collectWindows(store.layout);
    const firstWindowId = initialWindows[0]?.id;

    expect(firstWindowId).toBeTruthy();
    if (!firstWindowId) return;

    store.splitWindow(firstWindowId, 'column');
    const splitWindows = collectWindows(store.layout);
    const secondWindowId = splitWindows[1]?.id;

    expect(secondWindowId).toBeTruthy();
    if (!secondWindowId) return;

    store.setWindowManifest(secondWindowId, 'manifest-b');
    store.setActiveWindow(secondWindowId);
    store.setLayoutPreset('2x2');

    const expandedWindows = collectWindows(store.layout);
    expect(expandedWindows).toHaveLength(4);
    expect(expandedWindows[0]?.manifestId).toBe('manifest-a');
    expect(expandedWindows[1]?.manifestId).toBe('manifest-b');
    expect(store.activeWindowId).toBe(secondWindowId);
  });

  it('moves a window right by swapping with its right-hand neighbor', () => {
    const store = new WorkspaceStore('manifest-a');
    store.setLayoutPreset('1x2');

    const before = collectWindows(store.layout).map((windowNode) => windowNode.id);
    const leftWindowId = before[0];
    const rightWindowId = before[1];

    expect(leftWindowId).toBeTruthy();
    expect(rightWindowId).toBeTruthy();
    if (!leftWindowId || !rightWindowId) return;

    store.moveWindow(leftWindowId, 'right');
    const after = collectWindows(store.layout).map((windowNode) => windowNode.id);

    expect(after).toEqual([rightWindowId, leftWindowId]);
    expect(store.activeWindowId).toBe(leftWindowId);
  });

  it('moves a window down by swapping with the window below in 2x2', () => {
    const store = new WorkspaceStore('manifest-a');
    store.setLayoutPreset('2x2');

    const before = collectWindows(store.layout).map((windowNode) => windowNode.id);
    const topLeftId = before[0];
    const bottomLeftId = before[1];

    expect(topLeftId).toBeTruthy();
    expect(bottomLeftId).toBeTruthy();
    if (!topLeftId || !bottomLeftId) return;

    store.moveWindow(topLeftId, 'down');
    const after = collectWindows(store.layout).map((windowNode) => windowNode.id);

    expect(after).toEqual([bottomLeftId, topLeftId, before[2], before[3]]);
    expect(store.activeWindowId).toBe(topLeftId);
  });

  it('initializes equal split sizes for layout presets', () => {
    const store = new WorkspaceStore('manifest-a');
    store.setLayoutPreset('2x2');

    expect(store.layout.type).toBe('column');
    if (store.layout.type === 'window') return;
    expect(store.layout.sizes).toEqual([50, 50]);
    expect(store.layout.children.every((child) =>
      child.type === 'window' || child.sizes?.every((size) => size === 50),
    )).toBe(true);
  });

  it('creates one large left window and two stacked right windows for the one-by-two layout', () => {
    const store = new WorkspaceStore('manifest-a');
    store.setLayoutPreset('1x2-panel');

    expect(collectWindows(store.layout)).toHaveLength(3);
    expect(store.layout.type).toBe('column');
    if (store.layout.type !== 'column') return;
    expect(store.layout.sizes).toEqual([50, 50]);
    expect(store.layout.children[0]?.type).toBe('window');
    expect(store.layout.children[1]?.type).toBe('row');
    if (store.layout.children[1]?.type === 'row') {
      expect(store.layout.children[1].children).toHaveLength(2);
      expect(store.layout.children[1].sizes).toEqual([50, 50]);
    }
  });

  it('updates the requested split without changing nested split sizes', () => {
    const store = new WorkspaceStore('manifest-a');
    store.setLayoutPreset('2x2');
    if (store.layout.type === 'window') return;
    const targetId = getSplitNodeId(store.layout);

    store.updateSplitSizes(targetId, [65, 35]);

    expect(store.layout.type).toBe('column');
    if (store.layout.type === 'window') return;
    expect(store.layout.sizes).toEqual([65, 35]);
    expect(store.layout.children[0]?.type).toBe('row');
    if (store.layout.children[0]?.type === 'row') {
      expect(store.layout.children[0].sizes).toEqual([50, 50]);
    }
  });
});
