<script lang="ts">
  import { t } from '../../../i18n';
  import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';
  import type { LayerItem } from './LeftSidebar.svelte';

  interface Props {
    annotation?: ResolvedAnnotation | null;
    layers?: LayerItem[];
    total?: number;
    index?: number;
    isDraft?: boolean;
    ondelete?: ((detail: { id: string }) => void) | undefined;
    onupdate?:
      | ((detail: { id: string; patch: Partial<ResolvedAnnotation> }) => void)
      | undefined;
    onsave?: (() => void) | undefined;
  }

  let {
    annotation = null,
    layers = [
      { id: 'research', name: 'Research Notes', color: '#fb7185', visible: true },
      { id: 'transcription', name: 'Transcription', color: '#60a5fa', visible: true },
      { id: 'highlights', name: 'Highlights', color: '#34d399', visible: true },
      { id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true },
    ],
    total = 0,
    index = 0,
    isDraft = false,
    ondelete = undefined,
    onupdate = undefined,
    onsave = undefined,
  }: Props = $props();

  let currentAnnoId = $state<string | null>(null);
  let localLabel = $state('');
  let localText = $state('');
  let localNotes = $state('');
  let localTags = $state<string[]>([]);
  let localTagInput = $state('');
  let localMotivation = $state('sc:painting');
  let localLayer = $state('mine');
  const DEFAULT_LAYER_COLOR = '#a78bfa';
  const LAYER_FILL_OPACITY = 0.18;
  const firstLayerId = () => layers[0]?.id ?? 'mine';
  const findLayer = (layerId?: string): LayerItem | undefined =>
    layers.find((layer) => layer.id === layerId);
  const normalizeLayer = (layer?: string): string =>
    findLayer(layer)?.id ?? firstLayerId();
  const layerColorById = (layerId?: string): string =>
    findLayer(layerId)?.color ?? DEFAULT_LAYER_COLOR;

  $effect(() => {
    if (annotation && annotation.id !== currentAnnoId) {
      currentAnnoId = annotation.id;
      localLabel = annotation.label ?? '';
      localText = annotation.text ?? '';
      localNotes = annotation.notes ?? '';
      localTags = [...(annotation.tags ?? [])];
      localTagInput = '';
      localMotivation = annotation.motivation?.[0] ?? 'sc:painting';
      localLayer = normalizeLayer(annotation.targetStyleClass);
    } else if (!annotation) {
      currentAnnoId = null;
    }
  });
  $effect(() => {
    if (!annotation) return;
    const normalized = normalizeLayer(annotation.targetStyleClass);
    if (localLayer !== normalized) {
      localLayer = normalized;
    }
  });

  const getDropdownValue = (motivation: string): string => {
    if (motivation === 'painting' || motivation === 'sc:painting') return 'sc:painting';
    if (motivation === 'commenting' || motivation === 'oa:commenting')
      return 'oa:commenting';
    if (motivation === 'tagging' || motivation === 'oa:tagging') return 'oa:tagging';
    return motivation;
  };

  const handleLabelInput = (val: string) => {
    localLabel = val;
    if (annotation) {
      onupdate?.({ id: annotation.id, patch: { label: val } });
    }
  };

  const handleTextInput = (val: string) => {
    localText = val;
    if (annotation) {
      onupdate?.({ id: annotation.id, patch: { text: val } });
    }
  };

  const handleNotesInput = (val: string) => {
    localNotes = val;
    if (annotation) {
      onupdate?.({ id: annotation.id, patch: { notes: val } });
    }
  };

  const commitTags = (tags: string[]) => {
    localTags = tags;
    if (annotation) {
      onupdate?.({
        id: annotation.id,
        patch: { tags },
      });
    }
  };

  const addTag = () => {
    const next = localTagInput.trim().replace(/\s+/g, ' ');
    if (!next) return;
    if (localTags.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      localTagInput = '';
      return;
    }
    commitTags([...localTags, next]);
    localTagInput = '';
  };

  const removeTag = (index: number) => {
    if (index < 0 || index >= localTags.length) return;
    commitTags(localTags.filter((_, i) => i !== index));
  };

  const handleMotivationChange = (val: string) => {
    localMotivation = val;
    if (annotation) {
      onupdate?.({ id: annotation.id, patch: { motivation: [val] } });
    }
  };

  const handleLayerChange = (val: string) => {
    localLayer = val;
    if (annotation) {
      onupdate?.({
        id: annotation.id,
        patch: { targetStyleClass: val, targetStyle: styleForLayer(val) },
      });
    }
  };

  const styleForLayer = (layer: string): string => {
    const color = layerColorById(layer);
    const r = parseInt(color.slice(1, 3), 16) || 0;
    const g = parseInt(color.slice(3, 5), 16) || 0;
    const b = parseInt(color.slice(5, 7), 16) || 0;
    return `stroke: ${color}; fill: rgba(${r}, ${g}, ${b}, ${LAYER_FILL_OPACITY});`;
  };
</script>

<aside class="right-inspector">
  <div class="right-inspector__head">
    <h3>{$t('viewer.panels.annotations.editor.detailsTitle')}</h3>
    <span>{total > 0 ? $t('viewer.panels.annotations.editor.pagination', { current: index + 1, total }) : $t('viewer.panels.annotations.editor.pagination', { current: 0, total: 0 })}</span>
  </div>

  {#if annotation}
    <div class="right-inspector__scroll">
      <!-- Details Accordion -->
      <details class="inspector-accordion" open>
        <summary class="inspector-accordion__summary">{$t('viewer.panels.annotations.editor.details')}</summary>
        <div class="inspector-accordion__content">
          <div class="right-inspector__group">
            <label for="anno-type">{$t('viewer.panels.annotations.editor.motivation')}</label>
            <select
              id="anno-type"
              value={getDropdownValue(localMotivation)}
              onchange={(e) => handleMotivationChange(e.currentTarget.value)}
            >
              <option value="sc:painting">{$t('viewer.panels.annotations.editor.motivations.painting')}</option>
              <option value="supplementing">{$t('viewer.panels.annotations.editor.motivations.supplementing')}</option>
              <option value="contextualizing">{$t('viewer.panels.annotations.editor.motivations.contextualizing')}</option>
              <option value="contentState">{$t('viewer.panels.annotations.editor.motivations.contentState')}</option>
              <option value="highlighting">{$t('viewer.panels.annotations.editor.motivations.highlighting')}</option>
              <option value="oa:commenting">{$t('viewer.panels.annotations.editor.motivations.commenting')}</option>
              <option value="oa:tagging">{$t('viewer.panels.annotations.editor.motivations.tagging')}</option>
            </select>
          </div>

          <div class="right-inspector__group">
            <label for="anno-layer">{$t('viewer.panels.annotations.editor.layer')}</label>
            <select
              id="anno-layer"
              value={localLayer}
              onchange={(e) => handleLayerChange(e.currentTarget.value)}
            >
              {#each layers as layer}
                <option value={layer.id}>{$t(`viewer.panels.annotations.editor.layers.${layer.id}`) !== `viewer.panels.annotations.editor.layers.${layer.id}` ? $t(`viewer.panels.annotations.editor.layers.${layer.id}`) : layer.name}</option>
              {/each}
            </select>
          </div>

          <div class="right-inspector__group">
            <label for="anno-label">{$t('viewer.panels.annotations.editor.label')}</label>
            <input
              id="anno-label"
              value={localLabel}
              oninput={(e) => handleLabelInput(e.currentTarget.value)}
              placeholder={$t('viewer.panels.annotations.editor.labelPlaceholder')}
            />
          </div>

          <div class="right-inspector__group">
            <label for="anno-text">{$t('viewer.panels.annotations.editor.text')}</label>
            <textarea
              id="anno-text"
              rows="4"
              value={localText}
              oninput={(e) => handleTextInput(e.currentTarget.value)}
              placeholder={$t('viewer.panels.annotations.editor.textPlaceholder')}
            ></textarea>
          </div>

          <div class="right-inspector__group">
            <label for="anno-tags">{$t('viewer.panels.annotations.editor.tags')}</label>
            <div class="tag-editor">
              <input
                id="anno-tags"
                value={localTagInput}
                oninput={(e) => (localTagInput = e.currentTarget.value)}
                onkeydown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder={$t('viewer.panels.annotations.editor.tagPlaceholder')}
              />
              <button type="button" class="tag-editor__add" onclick={addTag}>{$t('viewer.panels.annotations.editor.addTag')}</button>
            </div>
            {#if localTags.length > 0}
              <div class="tag-list">
                {#each localTags as tag, idx}
                  <button
                    type="button"
                    class="tag-pill"
                    title={$t('viewer.panels.annotations.editor.removeTag', { tag })}
                    onclick={() => removeTag(idx)}
                  >
                    {tag}
                    <span aria-hidden="true">×</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </details>

      <!-- Notes Accordion -->
      <details class="inspector-accordion">
        <summary class="inspector-accordion__summary">{$t('viewer.panels.annotations.editor.notes')}</summary>
        <div class="inspector-accordion__content">
          <div class="right-inspector__group">
            <label for="anno-notes">{$t('viewer.panels.annotations.editor.privateNotes')}</label>
            <textarea
              id="anno-notes"
              rows="3"
              value={localNotes}
              oninput={(e) => handleNotesInput(e.currentTarget.value)}
              placeholder={$t('viewer.panels.annotations.editor.notesPlaceholder')}
            ></textarea>
          </div>
        </div>
      </details>
    </div>

    <div class="right-inspector__actions">
      <button type="button" class="right-inspector__save" onclick={onsave}>
        {isDraft ? $t('viewer.panels.annotations.editor.saveAnnotation') : $t('viewer.panels.annotations.editor.saveChanges')}
      </button>
      <button
        type="button"
        class="right-inspector__delete"
        onclick={() => ondelete?.({ id: annotation.id })}>{$t('viewer.panels.annotations.editor.deleteAnnotation')}</button
      >
    </div>
  {:else}
    <p class="right-inspector__empty">{$t('viewer.panels.annotations.editor.empty')}</p>
  {/if}
</aside>

<style>
  .right-inspector {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: 12px;
  }
  .right-inspector__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--viewer-panel-border);
  }
  .right-inspector__head h3 {
    margin: 0;
    font-size: 14px;
  }
  .right-inspector__head span {
    font-size: 11px;
    color: var(--viewer-muted);
  }
  .right-inspector__scroll {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-right: 4px;
  }

  /* Accordion styles */
  .inspector-accordion {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding: 4px 0;
  }
  .inspector-accordion__summary {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--viewer-text);
    cursor: pointer;
    padding: 8px 4px;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
  }
  .inspector-accordion__summary::-webkit-details-marker {
    display: none;
  }
  .inspector-accordion__summary::after {
    content: '▸';
    font-size: 10px;
    color: var(--viewer-muted);
    transition: transform 0.2s;
  }
  .inspector-accordion[open] .inspector-accordion__summary::after {
    transform: rotate(90deg);
  }
  .inspector-accordion__content {
    display: grid;
    gap: 12px;
    padding: 10px 4px 16px 4px;
  }

  .right-inspector__group {
    display: grid;
    gap: 6px;
  }
  .right-inspector__group label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--viewer-muted);
  }
  .right-inspector__group input,
  .right-inspector__group select,
  .right-inspector__group textarea {
    border-radius: 8px;
    border: 1px solid var(--viewer-panel-border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--viewer-text);
    padding: 8px 10px;
    font: inherit;
    font-size: 12px;
    width: 100%;
    box-sizing: border-box;
  }
  .right-inspector__group select {
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 14px;
    padding-right: 32px;
  }
  .tag-editor {
    display: flex;
    gap: 8px;
  }
  .tag-editor input {
    flex: 1;
    min-width: 0;
  }
  .tag-editor__add {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--viewer-text);
    padding: 0 12px;
    min-height: 34px;
    cursor: pointer;
    font-size: 12px;
  }
  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(42, 199, 255, 0.45);
    border-radius: 999px;
    background: rgba(42, 199, 255, 0.16);
    color: var(--viewer-text);
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .tag-pill span {
    opacity: 0.75;
    font-weight: 700;
  }

  /* Action buttons */
  .right-inspector__actions {
    display: grid;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--viewer-panel-border);
  }
  .right-inspector__save {
    background: #ff6b35;
    border: none;
    color: white;
    border-radius: 10px;
    min-height: 38px;
    font-weight: 600;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
  }
  .right-inspector__save:hover {
    background: #ff8552;
  }
  .right-inspector__delete {
    border: 1px solid rgba(255, 107, 107, 0.4);
    color: #ffb3b3;
    background: rgba(255, 107, 107, 0.08);
    border-radius: 10px;
    min-height: 38px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
  }
  .right-inspector__delete:hover {
    background: rgba(255, 107, 107, 0.16);
  }
  .right-inspector__empty {
    margin: 0;
    color: var(--viewer-muted);
    font-size: 12px;
  }
</style>
