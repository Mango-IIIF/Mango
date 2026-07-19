<script lang="ts">
  import { t } from '../../i18n';

  interface Props {
    open?: boolean;
    payload?: unknown;
    onclose?: () => void;
  }

  let { open = false, payload = null, onclose = undefined }: Props = $props();

  let textareaRef = $state<HTMLTextAreaElement | null>(null);

  const close = () => onclose?.();

  const pretty = () =>
    payload ? JSON.stringify(payload, null, 2) : '// No export payload available';

  const copyJson = async () => {
    try {
      if (textareaRef) {
        textareaRef.select();
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(pretty());
        return;
      }
    } catch {
      // fallback
    }

    try {
      document.execCommand('copy');
    } catch {
      // swallow
    }
  };

</script>

<div class="save-modal" hidden={!open} aria-hidden={!open}>
  {#if open}
    <div class="save-modal__scrim" role="presentation" onclick={close}></div>
    <div class="save-modal__panel" role="dialog" aria-modal="true">
      <div class="save-modal__header">
        <div class="save-modal__title">{$t('storyBuilder.export.title')}</div>
        <button class="save-modal__close" type="button" aria-label="Close" onclick={close}>
          {$t('common.closeGlyph')}
        </button>
      </div>

      <textarea
        bind:this={textareaRef}
        class="save-modal__code"
        aria-label="Exported story JSON"
        readonly
        value={pretty()}
      ></textarea>

      <div class="save-modal__actions">
        <button class="save-modal__button save-modal__button--primary" type="button" onclick={copyJson}>
          {$t('storyBuilder.export.copy')}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .save-modal {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: block;
    pointer-events: auto;
  }

  .save-modal[hidden] {
    display: none;
  }

  .save-modal__scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
  }

  .save-modal__panel {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(720px, 90vw);
    height: min(640px, 85vh);
    max-height: 90vh;
    background: #0f1722;
    color: #e8edf4;
    border-radius: 14px;
    padding: 16px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 12px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .save-modal__header {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .save-modal__title {
    font-size: 16px;
    font-weight: 700;
  }

  .save-modal__close {
    width: var(--viewer-close-button-size, 28px);
    height: var(--viewer-close-button-size, 28px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--viewer-close-button-border, rgba(255, 255, 255, 0.18));
    border-radius: var(--viewer-close-button-radius, 10px);
    background: var(--viewer-close-button-bg, rgba(255, 255, 255, 0.1));
    color: var(--viewer-close-button-color, inherit);
    font-size: var(--viewer-close-button-glyph-size, 15px);
    cursor: pointer;
    line-height: 1;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      transform 0.08s ease;
  }

  .save-modal__close:hover:not(:disabled) {
    background: var(--viewer-close-button-hover-bg, rgba(255, 255, 255, 0.16));
    border-color: var(--viewer-close-button-hover-border, rgba(255, 255, 255, 0.34));
  }

  .save-modal__close:focus-visible {
    outline: 2px solid var(--viewer-close-button-focus-ring, rgba(42, 199, 255, 0.55));
    outline-offset: 2px;
  }

  .save-modal__close:active:not(:disabled) {
    transform: translateY(1px);
  }

  .save-modal__code {
    display: block;
    width: 100%;
    height: 100%;
    background: #0b111a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 12px;
    margin: 0;
    overflow-y: auto;
    resize: none;
    font-family: Monaco, 'Courier New', monospace;
    font-size: 12px;
    color: #d5e2f5;
    box-sizing: border-box;
  }

  .save-modal__actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .save-modal__button {
    border: none;
    border-radius: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
  }

  .save-modal__button--primary {
    background: #e07a3f;
    color: #fffaf6;
  }
</style>
