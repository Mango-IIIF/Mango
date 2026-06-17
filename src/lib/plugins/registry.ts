import { writable } from 'svelte/store';
import { translate } from '../i18n';
import type { ViewerPlugin } from '../core/types/plugin';

const dedupePlugins = (plugins: ViewerPlugin[]): ViewerPlugin[] => {
  const map = new Map<string, ViewerPlugin>();
  for (const plugin of plugins) {
    if (!plugin?.id) continue;
    map.set(plugin.id, plugin);
  }
  return Array.from(map.values());
};

const registry = writable<ViewerPlugin[]>([]);

export const pluginsStore = {
  subscribe: registry.subscribe,
};

export const registerPlugin = (plugin: ViewerPlugin): void => {
  if (!plugin?.id) {
    console.warn(translate('warnings.pluginMissingId'));
    return;
  }
  registry.update((current) => dedupePlugins([...current, plugin]));
};

export const unregisterPlugin = (id: string): void => {
  registry.update((current) => current.filter((plugin) => plugin.id !== id));
};

export const clearPlugins = (): void => {
  registry.set([]);
};
