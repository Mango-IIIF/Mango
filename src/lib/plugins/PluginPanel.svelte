<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { PluginContext, PluginSlot, ViewerPlugin } from '../core/types/plugin';

  export let plugin: ViewerPlugin;
  export let context: Omit<PluginContext, 'mount'>;
  export let slot: PluginSlot;

  let container: HTMLDivElement | null = null;
  let hasMounted = false;
  let hasDestroyed = false;
  let initPromise: Promise<void> | null = null;
  let initError: Error | null = null;
  let hasError = false;

  const mountPlugin = async () => {
    if (hasMounted || !container) return;
    hasMounted = true;
    hasError = false;
    initError = null;
    
    const ctx: PluginContext = { ...context, mount: container };
    
    try {
      const result = plugin.init(ctx);
      if (result && typeof (result as Promise<void>).then === 'function') {
        initPromise = result as Promise<void>;
        await initPromise;
      }
    } catch (error) {
      hasError = true;
      initError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = `Plugin "${plugin.label}" (${plugin.id}) failed to initialize`;
      console.error(errorMessage, error);
      
      // Emit plugin error event
      context.events.emit('pluginError', {
        pluginId: plugin.id,
        pluginLabel: plugin.label,
        phase: 'init',
        message: errorMessage,
        cause: error,
      });
      
      // Display user-friendly error in the plugin slot
      if (container) {
        container.innerHTML = `
          <div style="padding: 12px; background: rgba(255, 79, 79, 0.1); border: 1px solid rgba(255, 79, 79, 0.3); border-radius: 8px; color: #ff9999;">
            <div style="font-weight: 600; margin-bottom: 4px;">Plugin Error</div>
            <div style="font-size: 12px; opacity: 0.9;">${plugin.label} failed to load</div>
          </div>
        `;
      }
    }
  };

  onMount(() => {
    void mountPlugin();
  });

  $: if (container && !hasMounted) {
    void mountPlugin();
  }

  onDestroy(() => {
    const finalize = () => {
      if (hasDestroyed || !hasMounted) return;
      hasDestroyed = true;
      
      try {
        plugin.destroy();
        container?.replaceChildren();
      } catch (error) {
        const errorMessage = `Plugin "${plugin.label}" (${plugin.id}) failed during cleanup`;
        console.error(errorMessage, error);
        
        // Emit plugin error event for destroy phase
        context.events.emit('pluginError', {
          pluginId: plugin.id,
          pluginLabel: plugin.label,
          phase: 'destroy',
          message: errorMessage,
          cause: error,
        });
      }
    };
    
    if (initPromise && !hasError) {
      void initPromise.finally(finalize);
    } else {
      finalize();
    }
  });
</script>

<div class="plugin-panel" class:plugin-panel--overlay={slot === 'overlay'}>
  {#if slot === 'overlay'}
    <div class="plugin-panel__body" bind:this={container}></div>
  {:else}
    <div class="plugin-panel__panel">
      <div class="plugin-panel__title">{plugin.label}</div>
      <div class="plugin-panel__body" bind:this={container}></div>
    </div>
  {/if}
</div>

<style>
  .plugin-panel--overlay {
    pointer-events: auto;
  }

  .plugin-panel__panel {
    display: grid;
    gap: 8px;
    padding: 14px;
    border-radius: 18px;
    background: var(--viewer-panel, #121922);
    border: 1px solid var(--viewer-panel-border, rgba(255, 255, 255, 0.08));
    font-size: 13px;
  }

  .plugin-panel__title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--viewer-muted, #9aa6b2);
  }

  .plugin-panel__body {
    color: var(--viewer-text, #e8edf4);
    line-height: 1.4;
  }

  :global(.hello-panel) {
    display: grid;
    gap: 8px;
  }

  :global(.hello-panel__title) {
    font-size: 12px;
    color: var(--viewer-muted, #9aa6b2);
    word-break: break-word;
  }

  :global(.hello-panel__meta) {
    font-size: 13px;
    font-weight: 600;
    color: var(--viewer-text, #e8edf4);
  }

  :global(.hello-panel__button) {
    border: none;
    border-radius: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--viewer-text, #e8edf4);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  :global(.annotation-plugin) {
    display: grid;
    gap: 10px;
  }

  :global(.annotation-plugin__note) {
    font-size: 12px;
    color: var(--viewer-muted, #9aa6b2);
  }

  :global(.annotation-plugin__button) {
    border: none;
    border-radius: 10px;
    padding: 8px 12px;
    background: var(--viewer-accent, #ff4fa2);
    color: #0b0f14;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }
</style>
