<script lang="ts">
  import PluginPanel from './PluginPanel.svelte';
  import type { PluginContext, PluginSlot, ViewerPlugin } from '../core/types/plugin';

  export let plugins: ViewerPlugin[] = [];
  export let context: Omit<PluginContext, 'mount'>;
  export let slot: PluginSlot;
</script>

<div class="plugin-slot plugin-slot--{slot}">
  {#each plugins as plugin (plugin.id)}
    <PluginPanel {plugin} {context} {slot} />
  {/each}
</div>

<style>
  .plugin-slot {
    display: grid;
    gap: 12px;
  }
</style>
