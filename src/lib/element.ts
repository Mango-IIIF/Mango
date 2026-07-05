import './hmr-patch';
import './components/ViewerElement.svelte';
import { registerPlugin } from './plugins/registry';
import type { ViewerPlugin } from './core/types/plugin';

declare global {
  interface Window {
    MangoViewerPlugins?: ViewerPlugin[];
    MangoViewer?: {
      registerPlugin: (plugin: ViewerPlugin) => void;
    };
  }
}

if (typeof window !== 'undefined') {
  window.MangoViewer = window.MangoViewer || {
    registerPlugin,
  };

  if (Array.isArray(window.MangoViewerPlugins)) {
    window.MangoViewerPlugins.forEach((plugin) => registerPlugin(plugin));
  }
}
