/**
 * Plugin Manager
 * 
 * Manages plugin deduplication and slot-based organization.
 * Extracted from Viewer.svelte to reduce complexity and improve testability.
 * Part of CODE_REVIEW.md Priority 2.1: Decompose Viewer.svelte
 */

import type { ViewerPlugin } from '../../core/types/plugin';

/**
 * Plugins organized by their render slot
 */
export type PluginsBySlot = {
  left: ViewerPlugin[];
  right: ViewerPlugin[];
  bottom: ViewerPlugin[];
  overlay: ViewerPlugin[];
};

/**
 * Deduplicate and organize plugins by slot
 * 
 * Combines registered plugins (from global store) with local plugins (from props),
 * deduplicates by ID (later plugins override earlier ones), and organizes by slot.
 * 
 * @param registeredPlugins - Plugins from global registry
 * @param localPlugins - Plugins passed as props
 * @returns Plugins organized by slot
 */
export const organizePluginsBySlot = (
  registeredPlugins: ViewerPlugin[],
  localPlugins: ViewerPlugin[],
): PluginsBySlot => {
  // Deduplicate plugins by ID
  // Local plugins come after registered ones, so they override if IDs match
  const deduped = new Map<string, ViewerPlugin>();
  
  for (const plugin of [...registeredPlugins, ...localPlugins]) {
    if (!plugin?.id) continue; // Skip plugins without IDs
    deduped.set(plugin.id, plugin);
  }
  
  const allPlugins = Array.from(deduped.values());
  
  // Organize by slot
  return {
    left: allPlugins.filter((plugin) => plugin.slot === 'left'),
    right: allPlugins.filter((plugin) => plugin.slot === 'right'),
    bottom: allPlugins.filter((plugin) => plugin.slot === 'bottom'),
    overlay: allPlugins.filter((plugin) => plugin.slot === 'overlay'),
  };
};

/**
 * Check if any plugins exist for a given slot
 */
export const hasPluginsInSlot = (pluginsBySlot: PluginsBySlot, slot: keyof PluginsBySlot): boolean => {
  return pluginsBySlot[slot].length > 0;
};

/**
 * Get total plugin count across all slots
 */
export const getTotalPluginCount = (pluginsBySlot: PluginsBySlot): number => {
  return (
    pluginsBySlot.left.length +
    pluginsBySlot.right.length +
    pluginsBySlot.bottom.length +
    pluginsBySlot.overlay.length
  );
};
