import type { ViewBox } from './viewer';

export type WindowNode = {
  type: 'window';
  id: string;
  manifestId: string;
  canvasIndex: number;
  viewBox?: ViewBox | null;
};

export type SplitNode = {
  type: 'row' | 'column';
  children: WorkspaceNode[];
  sizes?: number[];
};

export type WorkspaceNode = WindowNode | SplitNode;

export type WorkspaceLayoutPreset = '1x1' | '1x2' | '2x1' | '1x2-panel' | '2x2';

export type WorkspaceState = {
  layout: WorkspaceNode;
  activeWindowId: string | null;
};
