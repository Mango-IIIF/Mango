<script lang="ts">
  import { X } from '@lucide/svelte';
  import { t } from '../../core/i18n';

  interface Props {
    label?: string;
    lucide?: boolean;
    onclose?: () => void;
  }

  let {
    label = undefined,
    lucide = false,
    onclose = undefined,
  }: Props = $props();

  const accessibleLabel = $derived(label ?? $t('common.close'));

  const close = () => {
    onclose?.();
  };
</script>

<button
  class="panel__close"
  type="button"
  aria-label={accessibleLabel}
  onclick={close}
>
  {#if lucide}
    <X aria-hidden="true" />
  {:else}
    {$t('common.closeGlyph')}
  {/if}
</button>

<style>
  .panel__close :global(svg) {
    width: 17px;
    height: 17px;
    stroke-width: 2;
  }
</style>
