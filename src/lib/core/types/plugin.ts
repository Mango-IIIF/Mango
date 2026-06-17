import type { ViewerConfig } from './config';
import type { EventBus, ViewerEventMap } from './events';
import type { ViewerApi } from './viewer-api';

export type PluginSlot = 'left' | 'right' | 'bottom' | 'overlay';

export type PluginCapabilities = {
  requiresManifest?: boolean;
  requiresMedia?: boolean;
  supportsOverlay?: boolean;
};

export type PluginContext = {
  mount: HTMLElement;
  events: EventBus<ViewerEventMap>;
  viewer: ViewerApi;
  config: ViewerConfig;
};

export type PluginLifecycle = {
  init: (ctx: PluginContext) => void | Promise<void>;
  destroy: () => void;
};

export type ViewerPlugin = PluginLifecycle & {
  id: string;
  label: string;
  slot: PluginSlot;
  capabilities?: PluginCapabilities;
};
