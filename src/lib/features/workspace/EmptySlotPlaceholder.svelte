<script lang="ts">
  import { t } from '../../i18n';
  interface Props {
    onloadmanifest?: ((url: string) => void) | undefined;
    onopenmanifestmanager?: (() => void) | undefined;
    showInput?: boolean;
  }

  let {
    onloadmanifest = undefined,
    onopenmanifestmanager = undefined,
    showInput = true,
  }: Props = $props();

  let isOver = $state(false);
  let inputUrl = $state('');

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    isOver = true;
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    isOver = false;
  };

  const handleSubmit = () => {
    const next = inputUrl.trim();
    if (!next) return;
    onloadmanifest?.(next);
    inputUrl = '';
  };

  const parseDroppedFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? '');
        const parsed = JSON.parse(raw) as { id?: string; ['@id']?: string };
        const id = (parsed.id ?? parsed['@id'] ?? '').trim();
        if (id.startsWith('http://') || id.startsWith('https://')) {
          onloadmanifest?.(id);
        }
      } catch {
        // Ignore invalid files.
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    isOver = false;

    const transfer = event.dataTransfer;
    if (!transfer) return;

    const uri = transfer.getData('text/uri-list').trim();
    const plain = transfer.getData('text/plain').trim();
    const dropped = uri || plain;
    if (dropped.startsWith('http://') || dropped.startsWith('https://')) {
      onloadmanifest?.(dropped);
      return;
    }

    const file = transfer.files?.[0];
    if (!file) return;
    const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (!isJson) return;
    parseDroppedFile(file);
  };
</script>

<div
  class="empty-slot"
  class:empty-slot--active={isOver}
  role="region"
  aria-label={$t('workspace.emptySlot.dropZone')}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <div class="empty-slot__card">
    <div class="empty-slot__icon" aria-hidden="true">📄</div>
    <p class="empty-slot__title">
      {showInput ? $t('workspace.emptySlot.dragOrPaste') : $t('workspace.emptySlot.empty')}
    </p>
    {#if showInput}
      <div class="empty-slot__row">
        <input
          type="text"
          placeholder={$t('workspace.emptySlot.placeholder')}
          bind:value={inputUrl}
          onkeydown={(event) => event.key === 'Enter' && handleSubmit()}
        />
        <button type="button" onclick={handleSubmit}>{$t('workspace.emptySlot.load')}</button>
      </div>
    {:else}
      <button class="empty-slot__library" type="button" onclick={() => onopenmanifestmanager?.()}>
        {$t('workspace.emptySlot.chooseLibrary')}
      </button>
    {/if}
  </div>
</div>

<style>
  .empty-slot {
    height: 100%;
    min-height: 220px;
    border-radius: 14px;
    border: 1px dashed rgba(133, 167, 198, 0.46);
    background: linear-gradient(140deg, rgba(9, 22, 35, 0.72), rgba(15, 30, 46, 0.85));
    padding: 14px;
    display: grid;
    place-items: center;
  }

  .empty-slot--active {
    border-color: rgba(42, 199, 255, 0.8);
    box-shadow: inset 0 0 0 1px rgba(42, 199, 255, 0.35);
  }

  .empty-slot__card {
    width: min(420px, 100%);
    display: grid;
    gap: 12px;
    text-align: center;
  }

  .empty-slot__icon {
    font-size: 30px;
  }

  .empty-slot__title {
    margin: 0;
    color: #d8e7f8;
    font-size: 13px;
    letter-spacing: 0.04em;
  }

  .empty-slot__row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  input,
  button {
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: #e6eef8;
    padding: 9px 10px;
  }

  button {
    cursor: pointer;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .empty-slot__library {
    justify-self: center;
  }
</style>
