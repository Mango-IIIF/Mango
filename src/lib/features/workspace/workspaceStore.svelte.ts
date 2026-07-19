import type {
  WorkspaceLayoutPreset,
  WorkspaceNode,
  WorkspaceState,
  WindowNode,
} from '../../core/types/workspace';

const cloneWindow = (windowNode: WindowNode, id: string): WindowNode => ({
  ...windowNode,
  id,
});

const makeWindowId = (): string => `win-${Math.random().toString(36).slice(2, 8)}`;

const createWindow = (source?: Partial<WindowNode>): WindowNode => ({
  type: 'window',
  id: makeWindowId(),
  manifestId: source?.manifestId ?? '',
  canvasIndex: source?.canvasIndex ?? 0,
  viewBox: source?.viewBox ?? null,
});

const applyToTree = (
  node: WorkspaceNode,
  targetId: string,
  mutate: (windowNode: WindowNode) => WorkspaceNode,
): WorkspaceNode => {
  if (node.type === 'window') {
    return node.id === targetId ? mutate(node) : node;
  }

  return {
    ...node,
    children: node.children.map((child) => applyToTree(child, targetId, mutate)),
  };
};

const removeWindow = (node: WorkspaceNode, targetId: string): WorkspaceNode | null => {
  if (node.type === 'window') return node.id === targetId ? null : node;

  const children = node.children
    .map((child) => removeWindow(child, targetId))
    .filter((child): child is WorkspaceNode => Boolean(child));

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];

  return {
    ...node,
    children,
    sizes: node.sizes?.length === children.length ? node.sizes : equalSizes(children.length),
  };
};

const collectWindowIds = (node: WorkspaceNode): string[] => {
  if (node.type === 'window') return [node.id];
  return node.children.flatMap((child) => collectWindowIds(child));
};

const collectWindows = (node: WorkspaceNode): WindowNode[] => {
  if (node.type === 'window') return [node];
  return node.children.flatMap((child) => collectWindows(child));
};

export const getSplitNodeId = (node: WorkspaceNode): string =>
  collectWindowIds(node).join('|');

const equalSizes = (count: number): number[] =>
  Array.from({ length: count }, () => 100 / count);

const applySizesToTree = (
  node: WorkspaceNode,
  targetId: string,
  sizes: number[],
): WorkspaceNode => {
  if (node.type === 'window') return node;
  if (getSplitNodeId(node) === targetId) {
    return { ...node, sizes: [...sizes] };
  }
  return {
    ...node,
    children: node.children.map((child) =>
      applySizesToTree(child, targetId, sizes),
    ),
  };
};

type WindowMoveDirection = 'left' | 'right' | 'up' | 'down';

type WindowRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

const collectWindowRects = (
  node: WorkspaceNode,
  x: number,
  y: number,
  width: number,
  height: number,
): WindowRect[] => {
  if (node.type === 'window') {
    return [
      {
        id: node.id,
        x,
        y,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2,
      },
    ];
  }

  const childCount = node.children.length;
  if (childCount <= 0) return [];

  if (node.type === 'column') {
    const childWidth = width / childCount;
    return node.children.flatMap((child, index) =>
      collectWindowRects(child, x + childWidth * index, y, childWidth, height),
    );
  }

  const childHeight = height / childCount;
  return node.children.flatMap((child, index) =>
    collectWindowRects(child, x, y + childHeight * index, width, childHeight),
  );
};

const rangesOverlap = (
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean => Math.min(endA, endB) - Math.max(startA, startB) > 0.0001;

const findMoveTargetId = (
  layout: WorkspaceNode,
  sourceId: string,
  direction: WindowMoveDirection,
): string | null => {
  const rects = collectWindowRects(layout, 0, 0, 1, 1);
  const source = rects.find((rect) => rect.id === sourceId);
  if (!source) return null;

  const candidates = rects.filter((rect) => {
    if (rect.id === source.id) return false;
    if (direction === 'left') {
      return (
        rect.centerX < source.centerX &&
        rangesOverlap(source.y, source.y + source.height, rect.y, rect.y + rect.height)
      );
    }
    if (direction === 'right') {
      return (
        rect.centerX > source.centerX &&
        rangesOverlap(source.y, source.y + source.height, rect.y, rect.y + rect.height)
      );
    }
    if (direction === 'up') {
      return (
        rect.centerY < source.centerY &&
        rangesOverlap(source.x, source.x + source.width, rect.x, rect.x + rect.width)
      );
    }
    return (
      rect.centerY > source.centerY &&
      rangesOverlap(source.x, source.x + source.width, rect.x, rect.x + rect.width)
    );
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const primaryA =
      direction === 'left' || direction === 'right'
        ? Math.abs(a.centerX - source.centerX)
        : Math.abs(a.centerY - source.centerY);
    const primaryB =
      direction === 'left' || direction === 'right'
        ? Math.abs(b.centerX - source.centerX)
        : Math.abs(b.centerY - source.centerY);
    if (Math.abs(primaryA - primaryB) > 0.0001) return primaryA - primaryB;

    const secondaryA =
      direction === 'left' || direction === 'right'
        ? Math.abs(a.centerY - source.centerY)
        : Math.abs(a.centerX - source.centerX);
    const secondaryB =
      direction === 'left' || direction === 'right'
        ? Math.abs(b.centerY - source.centerY)
        : Math.abs(b.centerX - source.centerX);
    return secondaryA - secondaryB;
  });

  return candidates[0]?.id ?? null;
};

const swapWindows = (
  node: WorkspaceNode,
  firstId: string,
  secondId: string,
  windowsById: Map<string, WindowNode>,
): WorkspaceNode => {
  if (node.type === 'window') {
    if (node.id === firstId) return windowsById.get(secondId) ?? node;
    if (node.id === secondId) return windowsById.get(firstId) ?? node;
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) =>
      swapWindows(child, firstId, secondId, windowsById),
    ),
  };
};

const layoutSlotCount = (preset: WorkspaceLayoutPreset): number => {
  if (preset === '1x1') return 1;
  if (preset === '1x2-panel') return 3;
  if (preset === '2x2') return 4;
  return 2;
};

const convertLayoutPreset = (
  preset: WorkspaceLayoutPreset,
  windows: WindowNode[],
): WorkspaceNode => {
  const targetSlots = layoutSlotCount(preset);
  const preparedWindows = windows
    .slice(0, targetSlots)
    .map((windowNode) => ({ ...windowNode, id: windowNode.id || makeWindowId() }));

  while (preparedWindows.length < targetSlots) {
    preparedWindows.push(createWindow());
  }

  const getWindow = (index: number): WindowNode =>
    preparedWindows[index] ?? createWindow();

  const win1 = getWindow(0);
  const win2 = getWindow(1);
  const win3 = getWindow(2);
  const win4 = getWindow(3);

  if (preset === '1x1') return win1;
  if (preset === '1x2') {
    return { type: 'column', children: [win1, win2], sizes: equalSizes(2) };
  }
  if (preset === '2x1') {
    return { type: 'row', children: [win1, win2], sizes: equalSizes(2) };
  }
  if (preset === '1x2-panel') {
    return {
      type: 'column',
      sizes: equalSizes(2),
      children: [
        win1,
        { type: 'row', children: [win2, win3], sizes: equalSizes(2) },
      ],
    };
  }

  return {
    type: 'column',
    sizes: equalSizes(2),
    children: [
      { type: 'row', children: [win1, win2], sizes: equalSizes(2) },
      { type: 'row', children: [win3, win4], sizes: equalSizes(2) },
    ],
  };
};

export class WorkspaceStore {
  state = $state<WorkspaceState>({
    layout: createWindow(),
    activeWindowId: null,
  });

  constructor(initialManifestId = '') {
    const initialWindow = createWindow({ manifestId: initialManifestId, canvasIndex: 0 });
    this.state = {
      layout: initialWindow,
      activeWindowId: initialWindow.id,
    };
  }

  get layout(): WorkspaceNode {
    return this.state.layout;
  }

  get activeWindowId(): string | null {
    return this.state.activeWindowId;
  }

  get activeWindow(): WindowNode | null {
    const id = this.state.activeWindowId;
    if (!id) return null;
    return this.findWindow(id);
  }

  findWindow(id: string, node: WorkspaceNode = this.state.layout): WindowNode | null {
    if (node.type === 'window') return node.id === id ? node : null;
    for (const child of node.children) {
      const found = this.findWindow(id, child);
      if (found) return found;
    }
    return null;
  }

  setActiveWindow(id: string) {
    if (!this.findWindow(id)) return;
    this.state = { ...this.state, activeWindowId: id };
  }

  setLayoutPreset(preset: WorkspaceLayoutPreset) {
    const existingWindows = collectWindows(this.state.layout);
    const layout = convertLayoutPreset(
      preset,
      existingWindows.length > 0 ? existingWindows : [createWindow()],
    );
    const windowIds = collectWindowIds(layout);
    const nextActive =
      this.state.activeWindowId && windowIds.includes(this.state.activeWindowId)
        ? this.state.activeWindowId
        : (windowIds[0] ?? null);
    this.state = {
      layout,
      activeWindowId: nextActive,
    };
  }

  splitWindow(id: string, orientation: 'row' | 'column') {
    const layout = applyToTree(this.state.layout, id, (windowNode) => ({
      type: orientation,
      children: [windowNode, cloneWindow(windowNode, makeWindowId())],
      sizes: equalSizes(2),
    }));

    this.state = { ...this.state, layout };
  }

  moveWindow(id: string, direction: WindowMoveDirection) {
    const windows = collectWindows(this.state.layout);
    if (windows.length < 2) return;

    const targetId = findMoveTargetId(this.state.layout, id, direction);
    if (!targetId) return;

    const windowsById = new Map<string, WindowNode>(
      windows.map((windowNode) => [windowNode.id, windowNode]),
    );
    const layout = swapWindows(this.state.layout, id, targetId, windowsById);
    this.state = {
      ...this.state,
      layout,
      activeWindowId: id,
    };
  }

  closeWindow(id: string) {
    const nextLayout = removeWindow(this.state.layout, id);
    if (!nextLayout) return;
    const windowIds = collectWindowIds(nextLayout);
    const nextActive =
      this.state.activeWindowId === id
        ? (windowIds[0] ?? null)
        : windowIds.includes(this.state.activeWindowId ?? '')
          ? this.state.activeWindowId
          : (windowIds[0] ?? null);
    this.state = {
      layout: nextLayout,
      activeWindowId: nextActive,
    };
  }

  setWindowManifest(id: string, manifestId: string) {
    const layout = applyToTree(this.state.layout, id, (windowNode) => ({
      ...windowNode,
      manifestId,
      canvasIndex: 0,
      viewBox: null,
    }));
    this.state = { ...this.state, layout };
  }

  setWindowCanvasIndex(id: string, canvasIndex: number) {
    const layout = applyToTree(this.state.layout, id, (windowNode) => ({
      ...windowNode,
      canvasIndex,
    }));
    this.state = { ...this.state, layout };
  }

  setWindowViewBox(id: string, viewBox: WindowNode['viewBox']) {
    const layout = applyToTree(this.state.layout, id, (windowNode) => ({
      ...windowNode,
      viewBox,
    }));
    this.state = { ...this.state, layout };
  }

  updateSplitSizes(targetId: string, sizes: number[]) {
    if (!targetId || sizes.length < 2 || sizes.some((size) => !Number.isFinite(size))) {
      return;
    }
    const layout = applySizesToTree(this.state.layout, targetId, sizes);
    this.state = { ...this.state, layout };
  }

  get windows(): WindowNode[] {
    return collectWindows(this.state.layout);
  }
}
