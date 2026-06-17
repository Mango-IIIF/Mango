import { describe, expect, it } from 'vitest';
import type { WindowNode, WorkspaceNode } from '../../../core/types/workspace';
import { WorkspaceStore } from '../workspaceStore.svelte';

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
});
