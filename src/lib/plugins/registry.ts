/**
 * The set of plugins available to every viewer on the page.
 *
 * Registration is deliberately one-way. There is no `unregisterPlugin` and no
 * `clearPlugins`: plugins are registered once at startup, by the host or by
 * `window.MangoViewerPlugins`, and the registry is process-global rather than
 * scoped to a viewer instance. Registering the same id twice replaces the
 * earlier entry, which is the only removal this needs.
 *
 * Both removal functions did exist and neither was ever called. They are gone
 * on purpose — the missing `unregister` beside a published `register` is a
 * decision, not an omission. Adding one back means answering what it should do
 * to viewers already mounted with that plugin, which nothing currently needs.
 */

import { writable } from 'svelte/store';
import { translate } from '../core/i18n';
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

