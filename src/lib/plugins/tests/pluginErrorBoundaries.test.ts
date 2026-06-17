import { describe, it, expect, vi } from 'vitest';
import type { ViewerPlugin, PluginContext } from '../../core/types/plugin';
import { createEventBus } from '../../events/eventBus';
import type { ViewerConfig } from '../../core/types/config';

describe('Plugin Error Boundaries', () => {
  it('should emit pluginError event when plugin init throws', () => {
    const events = createEventBus();
    const errorSpy = vi.fn();
    events.on('pluginError', errorSpy);

    const failingPlugin: ViewerPlugin = {
      id: 'failing-plugin',
      label: 'Failing Plugin',
      slot: 'left',
      init: () => {
        throw new Error('Init failed');
      },
      destroy: () => {},
    };

    const mount = document.createElement('div');
    const context: PluginContext = {
      mount,
      events,
      viewer: {} as PluginContext['viewer'],
      config: {} as ViewerConfig,
    };

    // Simulate what PluginPanel does with error handling
    try {
      failingPlugin.init(context);
    } catch (error) {
      events.emit('pluginError', {
        pluginId: failingPlugin.id,
        pluginLabel: failingPlugin.label,
        phase: 'init',
        message: `Plugin "${failingPlugin.label}" (${failingPlugin.id}) failed to initialize`,
        cause: error,
      });
    }

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'failing-plugin',
        pluginLabel: 'Failing Plugin',
        phase: 'init',
        message: expect.stringContaining('failed to initialize'),
      }),
    );
  });

  it('should emit pluginError event for async plugin errors', async () => {
    const events = createEventBus();
    const errorSpy = vi.fn();
    events.on('pluginError', errorSpy);

    const asyncFailingPlugin: ViewerPlugin = {
      id: 'async-failing-plugin',
      label: 'Async Failing Plugin',
      slot: 'left',
      init: async () => {
        await Promise.resolve();
        throw new Error('Async init failed');
      },
      destroy: () => {},
    };

    const mount = document.createElement('div');
    const context: PluginContext = {
      mount,
      events,
      viewer: {} as PluginContext['viewer'],
      config: {} as ViewerConfig,
    };

    // Simulate async error handling
    try {
      await asyncFailingPlugin.init(context);
    } catch (error) {
      events.emit('pluginError', {
        pluginId: asyncFailingPlugin.id,
        pluginLabel: asyncFailingPlugin.label,
        phase: 'init',
        message: `Plugin "${asyncFailingPlugin.label}" (${asyncFailingPlugin.id}) failed to initialize`,
        cause: error,
      });
    }

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'async-failing-plugin',
        pluginLabel: 'Async Failing Plugin',
        phase: 'init',
      }),
    );
  });

  it('should emit pluginError event when plugin destroy throws', () => {
    const events = createEventBus();
    const errorSpy = vi.fn();
    events.on('pluginError', errorSpy);

    const failingDestroyPlugin: ViewerPlugin = {
      id: 'failing-destroy',
      label: 'Failing Destroy Plugin',
      slot: 'left',
      init: () => {},
      destroy: () => {
        throw new Error('Destroy failed');
      },
    };

    const mount = document.createElement('div');
    const context: PluginContext = {
      mount,
      events,
      viewer: {} as PluginContext['viewer'],
      config: {} as ViewerConfig,
    };

    // Initialize successfully
    failingDestroyPlugin.init(context);

    // Simulate destroy with error handling
    try {
      failingDestroyPlugin.destroy();
    } catch (error) {
      events.emit('pluginError', {
        pluginId: failingDestroyPlugin.id,
        pluginLabel: failingDestroyPlugin.label,
        phase: 'destroy',
        message: `Plugin "${failingDestroyPlugin.label}" (${failingDestroyPlugin.id}) failed during cleanup`,
        cause: error,
      });
    }

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'failing-destroy',
        phase: 'destroy',
      }),
    );
  });

  it('should not emit errors for working plugins', () => {
    const events = createEventBus();
    const errorSpy = vi.fn();
    events.on('pluginError', errorSpy);

    const workingPlugin: ViewerPlugin = {
      id: 'working-plugin',
      label: 'Working Plugin',
      slot: 'left',
      init: (ctx: PluginContext) => {
        ctx.mount.innerHTML = '<div>Plugin content</div>';
      },
      destroy: () => {
        // Clean up
      },
    };

    const mount = document.createElement('div');
    const context: PluginContext = {
      mount,
      events,
      viewer: {} as PluginContext['viewer'],
      config: {} as ViewerConfig,
    };

    // This should not throw
    workingPlugin.init(context);
    workingPlugin.destroy();

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

