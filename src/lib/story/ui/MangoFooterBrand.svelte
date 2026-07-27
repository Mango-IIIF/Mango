<script lang="ts">
  import MangoLogoIcon from './MangoLogoIcon.svelte';
  import MangoAboutModal from './MangoAboutModal.svelte';

  export let position: 'fixed' | 'absolute' | 'relative' | 'inline' = 'relative';
  export let size = 16;

  let aboutOpen = false;

  const toggleModal = () => {
    aboutOpen = !aboutOpen;
  };
</script>

<div
  class="mango-footer-brand"
  class:mango-footer-brand--fixed={position === 'fixed'}
  class:mango-footer-brand--absolute={position === 'absolute'}
  class:mango-footer-brand--relative={position === 'relative'}
  class:mango-footer-brand--inline={position === 'inline'}
>
  <button
    type="button"
    class="mango-footer-brand__button"
    title="About Mango Viewer (mangoviewer.dev)"
    aria-label="About Mango Viewer"
    on:click={toggleModal}
  >
    <MangoLogoIcon {size} color="currentColor" />
    <span class="mango-footer-brand__label">Mango</span>
  </button>

  <MangoAboutModal open={aboutOpen} onClose={() => (aboutOpen = false)} />
</div>

<style>
  .mango-footer-brand {
    display: inline-flex;
    align-items: center;
    line-height: 1;
    z-index: 999;
  }

  .mango-footer-brand--fixed {
    position: fixed;
    bottom: 8px;
    right: 8px;
  }

  .mango-footer-brand--absolute {
    position: absolute;
    bottom: 8px;
    right: 8px;
  }

  .mango-footer-brand--inline {
    display: inline-flex;
  }

  .mango-footer-brand__button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    backdrop-filter: none;
    color: currentColor;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    box-shadow: none;
    opacity: 0.75;
    transition: opacity 0.2s ease;
  }

  .mango-footer-brand__button:hover {
    background: transparent;
    border: none;
    opacity: 1;
    box-shadow: none;
  }

  .mango-footer-brand__label {
    letter-spacing: -0.01em;
    color: currentColor;
    line-height: 1;
  }
</style>
