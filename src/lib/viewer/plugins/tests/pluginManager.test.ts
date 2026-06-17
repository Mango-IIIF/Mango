import { describe, it, expect } from 'vitest';
import {
  organizePluginsBySlot,
  hasPluginsInSlot,
  getTotalPluginCount,
} from '../pluginManager';
import type { ViewerPlugin } from '../../../core/types/plugin';

describe('Plugin Manager', () => {
  describe('organizePluginsBySlot', () => {
    it('should organize plugins by slot', () => {
      const plugins: ViewerPlugin[] = [
        { id: 'plugin-1', label: 'Plugin 1', slot: 'left', init: async () => {}, destroy: async () => {} },
        { id: 'plugin-2', label: 'Plugin 2', slot: 'right', init: async () => {}, destroy: async () => {} },
        { id: 'plugin-3', label: 'Plugin 3', slot: 'bottom', init: async () => {}, destroy: async () => {} },
        { id: 'plugin-4', label: 'Plugin 4', slot: 'overlay', init: async () => {}, destroy: async () => {} },
      ];

      const organized = organizePluginsBySlot(plugins, []);

      expect(organized.left).toHaveLength(1);
      expect(organized.left[0].id).toBe('plugin-1');
      expect(organized.right).toHaveLength(1);
      expect(organized.right[0].id).toBe('plugin-2');
      expect(organized.bottom).toHaveLength(1);
      expect(organized.bottom[0].id).toBe('plugin-3');
      expect(organized.overlay).toHaveLength(1);
      expect(organized.overlay[0].id).toBe('plugin-4');
    });

    it('should deduplicate plugins by ID, keeping later ones', () => {
      const registeredPlugins: ViewerPlugin[] = [
        { id: 'plugin-1', label: 'Registered Plugin', slot: 'left', init: async () => {}, destroy: async () => {} },
      ];
      const localPlugins: ViewerPlugin[] = [
        { id: 'plugin-1', label: 'Local Plugin', slot: 'right', init: async () => {}, destroy: async () => {} },
      ];

      const organized = organizePluginsBySlot(registeredPlugins, localPlugins);

      // Local plugin should override registered plugin
      expect(organized.left).toHaveLength(0);
      expect(organized.right).toHaveLength(1);
      expect(organized.right[0].label).toBe('Local Plugin');
    });

    it('should skip plugins without IDs', () => {
      const plugins: ViewerPlugin[] = [
        { id: 'plugin-1', label: 'Plugin 1', slot: 'left', init: async () => {}, destroy: async () => {} },
        { id: '', label: 'Invalid Plugin', slot: 'left', init: async () => {}, destroy: async () => {} } as any,
        { label: 'No ID Plugin', slot: 'left', init: async () => {}, destroy: async () => {} } as any,
      ];

      const organized = organizePluginsBySlot(plugins, []);

      expect(organized.left).toHaveLength(1);
      expect(organized.left[0].id).toBe('plugin-1');
    });

    it('should handle empty plugin arrays', () => {
      const organized = organizePluginsBySlot([], []);

      expect(organized.left).toHaveLength(0);
      expect(organized.right).toHaveLength(0);
      expect(organized.bottom).toHaveLength(0);
      expect(organized.overlay).toHaveLength(0);
    });

    it('should combine multiple plugins in same slot', () => {
      const plugins: ViewerPlugin[] = [
        { id: 'plugin-1', label: 'Plugin 1', slot: 'left', init: async () => {}, destroy: async () => {} },
        { id: 'plugin-2', label: 'Plugin 2', slot: 'left', init: async () => {}, destroy: async () => {} },
        { id: 'plugin-3', label: 'Plugin 3', slot: 'left', init: async () => {}, destroy: async () => {} },
      ];

      const organized = organizePluginsBySlot(plugins, []);

      expect(organized.left).toHaveLength(3);
    });
  });

  describe('hasPluginsInSlot', () => {
    it('should return true when plugins exist in slot', () => {
      const pluginsBySlot = {
        left: [{ id: 'plugin-1', label: 'Plugin 1', slot: 'left' as const, init: async () => {}, destroy: async () => {} }],
        right: [],
        bottom: [],
        overlay: [],
      };

      expect(hasPluginsInSlot(pluginsBySlot, 'left')).toBe(true);
    });

    it('should return false when no plugins in slot', () => {
      const pluginsBySlot = {
        left: [],
        right: [],
        bottom: [],
        overlay: [],
      };

      expect(hasPluginsInSlot(pluginsBySlot, 'left')).toBe(false);
      expect(hasPluginsInSlot(pluginsBySlot, 'right')).toBe(false);
    });
  });

  describe('getTotalPluginCount', () => {
    it('should return total plugin count across all slots', () => {
      const pluginsBySlot = {
        left: [
          { id: 'plugin-1', label: 'Plugin 1', slot: 'left' as const, init: async () => {}, destroy: async () => {} },
          { id: 'plugin-2', label: 'Plugin 2', slot: 'left' as const, init: async () => {}, destroy: async () => {} },
        ],
        right: [
          { id: 'plugin-3', label: 'Plugin 3', slot: 'right' as const, init: async () => {}, destroy: async () => {} },
        ],
        bottom: [],
        overlay: [
          { id: 'plugin-4', label: 'Plugin 4', slot: 'overlay' as const, init: async () => {}, destroy: async () => {} },
        ],
      };

      expect(getTotalPluginCount(pluginsBySlot)).toBe(4);
    });

    it('should return 0 for empty slots', () => {
      const pluginsBySlot = {
        left: [],
        right: [],
        bottom: [],
        overlay: [],
      };

      expect(getTotalPluginCount(pluginsBySlot)).toBe(0);
    });
  });
});
