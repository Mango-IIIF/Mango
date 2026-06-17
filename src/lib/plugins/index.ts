export { registerPlugin, unregisterPlugin, clearPlugins } from './registry';
export type {
  PluginCapabilities,
  PluginContext,
  PluginLifecycle,
  PluginSlot,
  ViewerPlugin,
} from '../core/types/plugin';
export { createHelloPanelPlugin } from './helloPanel';
export { createAddAnnotationPlugin } from './addAnnotation';
