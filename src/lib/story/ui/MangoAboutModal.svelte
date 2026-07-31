<script lang="ts">
  import { onDestroy } from 'svelte';
  import { ExternalLink, X } from '@lucide/svelte';
  import MangoLogoIcon from './MangoLogoIcon.svelte';
  import pkg from '../../../../package.json';

  export let open = false;
  export let onClose: () => void = () => {};
  export let version: string = pkg.version;

  /*
   * Easter egg: the Ringo theme turns the About box into a jukebox.
   *
   * The theme is read off the nearest `.viewer` ancestor rather than the viewer
   * context, because this modal is also mounted from the story builder and from
   * standalone brand footers, where that context may not exist. Nothing is
   * embedded — and no request reaches YouTube — unless the reader is on Ringo
   * and has actually opened the dialog.
   */
  let backdropEl: HTMLElement | null = null;
  let isRingo = false;
  let themeObserver: MutationObserver | null = null;

  const readTheme = () => {
    isRingo = backdropEl?.closest('.viewer')?.getAttribute('data-theme') === 'ringo';
  };

  /*
   * `data-theme` is an attribute on an ancestor, not reactive state here, so
   * reading it once would go stale: the host can switch theme through the
   * config API while the dialog is open, which left the embed showing under a
   * theme that should not have it. Watch the attribute for as long as we are
   * open, and stop watching as soon as we are not.
   */
  const stopWatching = () => {
    themeObserver?.disconnect();
    themeObserver = null;
  };

  $: if (open && backdropEl) {
    readTheme();
    stopWatching();
    const viewer = backdropEl.closest('.viewer');
    if (viewer && typeof MutationObserver !== 'undefined') {
      themeObserver = new MutationObserver(readTheme);
      themeObserver.observe(viewer, { attributes: true, attributeFilter: ['data-theme'] });
    }
  } else if (!open) {
    stopWatching();
    isRingo = false;
  }

  onDestroy(stopWatching);

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
    bind:this={backdropEl}
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
          <MangoLogoIcon size={48} color="var(--mango-about-accent)" />
        </div>
        <h2 id="mango-about-title">Mango Viewer</h2>
        <span class="mango-about-modal__version">v{version}</span>
      </div>

      <div class="mango-about-modal__body">
        <p>
          Mango is an open-source, W3C Annotation and IIIF-compliant deep zoom viewer and interactive story creation suite designed for high-resolution manuscript, artwork, and spatial media exploration.
        </p>

        {#if isRingo}
          <div class="mango-about-modal__easter-egg">
            <iframe
              src="https://www.youtube-nocookie.com/embed/j_JaDDcyIIU"
              title="Yellow Submarine"
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
              allow="encrypted-media; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
        {/if}
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
    --mango-about-accent: var(--story-builder-accent, #e07a3f);
    --mango-about-accent-hover: var(--story-builder-accent-hover, #e8864b);
    --mango-about-surface: var(--viewer-panel, #18202c);
    --mango-about-text: var(--viewer-text, #e8edf4);
    --mango-about-muted: var(--viewer-muted, #b3c0ce);
    --mango-about-border: color-mix(in srgb, var(--viewer-text, #e8edf4) 12%, transparent);

    position: fixed;
    inset: 0;
    z-index: 99999;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(10, 14, 20, 0.75);
    backdrop-filter: blur(8px);
    color-scheme: dark;
    font-family: sans-serif;
    font-style: normal;
    letter-spacing: normal;
    text-align: left;
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
    background: var(--mango-about-surface);
    border: 1px solid var(--mango-about-border);
    border-radius: 16px;
    padding: 28px;
    color: var(--mango-about-text);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px color-mix(in srgb, var(--story-builder-accent, #e07a3f) 15%, transparent);
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
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 6%, transparent);
    color: var(--mango-about-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mango-about-modal__close:hover {
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 14%, transparent);
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
    background: color-mix(in srgb, var(--story-builder-accent, #e07a3f) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--story-builder-accent, #e07a3f) 25%, transparent);
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
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 12%, transparent);
    font-size: 11px;
    font-weight: 600;
    color: var(--mango-about-muted);
    letter-spacing: 0.03em;
  }

  .mango-about-modal__body {
    display: grid;
    gap: 16px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--mango-about-muted);
  }

  .mango-about-modal__body p {
    margin: 0;
    text-align: center;
  }

  .mango-about-modal__easter-egg {
    /* The modal caps at 480px, so size from the box rather than the embed's own
       560x315 and let the ratio carry the height. */
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--mango-about-border);
    background: #000;
  }

  .mango-about-modal__easter-egg iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .mango-about-modal__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 24px;
    padding-top: 18px;
    border-top: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 8%, transparent);
  }

  .mango-about-modal__link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    background: var(--mango-about-accent);
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
    background: var(--mango-about-accent-hover);
    transform: translateY(-1px);
  }

  .mango-about-modal__button {
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--viewer-text, #e8edf4) 12%, transparent);
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 6%, transparent);
    color: white;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .mango-about-modal__button:hover {
    background: color-mix(in srgb, var(--viewer-text, #e8edf4) 12%, transparent);
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
