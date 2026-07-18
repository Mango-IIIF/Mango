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

  let spinning = $state(false);

  const close = () => {
    if (spinning) return;
    if (
      !lucide ||
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    ) {
      onclose?.();
      return;
    }

    spinning = true;
    window.setTimeout(() => onclose?.(), 280);
  };
</script>

<button
  class="panel__close"
  class:panel__close--spinning={spinning}
  type="button"
  aria-label={label}
  aria-disabled={spinning}
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
    width: 20px;
    height: 20px;
    stroke-width: 2;
  }

  .panel__close--spinning :global(svg) {
    animation: panel-close-spin 260ms cubic-bezier(0.4, 0, 0.2, 1) 1;
  }

  @keyframes panel-close-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel__close--spinning :global(svg) {
      animation: none;
    }
  }
</style>
