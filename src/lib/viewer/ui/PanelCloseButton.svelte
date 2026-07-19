<script lang="ts">
  import { X } from '@lucide/svelte';
  import { t } from '../../i18n';

  interface Props {
    label?: string;
    lucide?: boolean;
    onclose?: () => void;
  }

  let {
    label = 'Close',
    lucide = false,
    onclose = undefined,
  }: Props = $props();

  const close = () => {
    onclose?.();
  };
</script>

<button
  class="panel__close"
  type="button"
  aria-label={label}
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
