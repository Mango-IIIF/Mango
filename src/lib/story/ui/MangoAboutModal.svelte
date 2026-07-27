<script lang="ts">
  import { ExternalLink, X, Compass, Film, Mic, FileCode2 } from '@lucide/svelte';
  import MangoLogoIcon from './MangoLogoIcon.svelte';
  import pkg from '../../../../package.json';

  export let open = false;
  export let onClose: () => void = () => {};
  export let version: string = pkg.version;

  const handleKeydown = (event: KeyboardEvent) => {
    if (open && event.key === 'Escape') {
      onClose();
    }
  };
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class="mango-about-backdrop"
    role="presentation"
    on:click|self={onClose}
  >
    <div
      class="mango-about-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mango-about-title"
    >
      <button
        class="mango-about-modal__close"
        type="button"
        aria-label="Close modal"
        on:click={onClose}
      >
        <X aria-hidden="true" size={18} />
      </button>

      <div class="mango-about-modal__header">
        <div class="mango-about-modal__badge">
          <MangoLogoIcon size={48} color="var(--accent, #e07a3f)" />
        </div>
        <h2 id="mango-about-title">Mango Viewer</h2>
        <span class="mango-about-modal__version">v{version}</span>
      </div>

      <div class="mango-about-modal__body">
        <p>
          Mango is an open-source, W3C Annotation and IIIF-compliant deep zoom viewer and interactive story creation suite designed for high-resolution manuscript, artwork, and spatial media exploration.
        </p>
      </div>

      <div class="mango-about-modal__footer">
        <a
          class="mango-about-modal__link"
          href="https://mangoviewer.dev/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Visit mangoviewer.dev</span>
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        <button
          class="mango-about-modal__button"
          type="button"
          on:click={onClose}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .mango-about-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(10, 14, 20, 0.75);
    backdrop-filter: blur(8px);
    animation: mangoAboutFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mango-about-modal {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    max-width: 480px;
    max-height: calc(100dvh - 32px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--viewer-card-bg, #18202c);
    border: 1px solid var(--viewer-border, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    padding: 28px;
    color: var(--viewer-text, #e8edf4);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(224, 122, 63, 0.15);
    animation: mangoAboutScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mango-about-modal__close {
    position: absolute;
    top: 16px;
    right: 16px;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: var(--viewer-muted, #9aa6b2);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mango-about-modal__close:hover {
    background: rgba(255, 255, 255, 0.14);
    color: white;
  }

  .mango-about-modal__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 20px;
  }

  .mango-about-modal__badge {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: rgba(224, 122, 63, 0.12);
    border: 1px solid rgba(224, 122, 63, 0.25);
    margin-bottom: 12px;
  }

  .mango-about-modal__header h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: white;
  }

  .mango-about-modal__version {
    display: inline-block;
    margin-top: 6px;
    margin-bottom: 2px;
    padding: 2px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-size: 11px;
    font-weight: 600;
    color: var(--viewer-muted, #9aa6b2);
    letter-spacing: 0.03em;
  }

  .mango-about-modal__tagline {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    color: var(--accent, #e07a3f);
    font-weight: 600;
  }

  .mango-about-modal__body {
    display: grid;
    gap: 16px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--viewer-muted, #b3c0ce);
  }

  .mango-about-modal__body p {
    margin: 0;
    text-align: center;
  }

  .mango-about-modal__features {
    display: grid;
    gap: 10px;
    margin-top: 4px;
  }

  .mango-about-modal__feature {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .mango-about-modal__feature :global(.mango-about-modal__icon) {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--accent, #e07a3f);
  }

  .mango-about-modal__feature div {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .mango-about-modal__feature strong {
    font-size: 13px;
    font-weight: 700;
    color: white;
  }

  .mango-about-modal__feature span {
    font-size: 12px;
    color: var(--viewer-muted, #9aa6b2);
    overflow-wrap: anywhere;
  }

  .mango-about-modal__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 24px;
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mango-about-modal__link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    background: var(--accent, #e07a3f);
    color: white;
    font-weight: 700;
    font-size: 13px;
    text-decoration: none;
    overflow-wrap: anywhere;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  @media (max-width: 520px), (max-height: 700px) {
    .mango-about-modal {
      padding: 20px;
    }

    .mango-about-modal__header {
      margin-bottom: 14px;
    }

    .mango-about-modal__badge {
      width: 52px;
      height: 52px;
      margin-bottom: 8px;
    }

    .mango-about-modal__body {
      gap: 12px;
    }

    .mango-about-modal__footer {
      flex-wrap: wrap;
      margin-top: 16px;
      padding-top: 14px;
    }
  }

  .mango-about-modal__link:hover {
    background: #e8864b;
    transform: translateY(-1px);
  }

  .mango-about-modal__button {
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: white;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .mango-about-modal__button:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  @keyframes mangoAboutFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes mangoAboutScaleUp {
    from { opacity: 0; transform: scale(0.94); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
