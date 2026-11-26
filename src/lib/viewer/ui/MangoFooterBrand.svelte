<script lang="ts">
  import MangoLogoIcon from './MangoLogoIcon.svelte';
  import MangoAboutModal from './MangoAboutModal.svelte';
  import { t } from '../../core/i18n';

  export let position: 'fixed' | 'absolute' | 'relative' | 'inline' = 'relative';
  export let size = 16;
  export let brand: string | undefined = undefined;
  export let buttonTitle: string | undefined = undefined;
  export let buttonLabel: string | undefined = undefined;
  export let aboutTitle: string | undefined = undefined;
  export let aboutDescription: string | undefined = undefined;
  export let aboutVersion: string | undefined = undefined;
  export let aboutHomepage: string | undefined = undefined;
  export let aboutVisitLabel: string | undefined = undefined;

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
    title={buttonTitle ?? $t('about.buttonTitle')}
    aria-label={buttonLabel ?? $t('about.buttonLabel')}
    on:click={toggleModal}
  >
    <MangoLogoIcon {size} color="currentColor" />
    <span class="mango-footer-brand__label">{brand ?? $t('about.brand')}</span>
  </button>

  <MangoAboutModal
    open={aboutOpen}
    onClose={() => (aboutOpen = false)}
    title={aboutTitle}
    description={aboutDescription}
    version={aboutVersion}
    homepage={aboutHomepage}
    visitLabel={aboutVisitLabel}
  />
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
