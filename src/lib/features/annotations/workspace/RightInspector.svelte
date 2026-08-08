<script lang="ts">
  import { t } from '../../../i18n';
  import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';
  import type { LayerItem } from './LeftSidebar.svelte';
  import {
    AUTHORING_PURPOSES,
    DEFAULT_MOTIVATION,
    motivationPresets,
    presetForMotivation,
    authoringMotivations,
    isExpertMotivation,
  } from '../profile';
  import { isForeign } from '../model';
  import type { AnnotationSaveState } from '../model';
  import { summariseDiagnostics, toMangoDiagnostics } from '../diagnostics';
  import LanguageTabs from '../LanguageTabs.svelte';
  import { normaliseAuthoringLanguages } from '../languages';

  interface Props {
    annotation?: ResolvedAnnotation | null;
    layers?: LayerItem[];
    total?: number;
    index?: number;
    isDraft?: boolean;
    /** Unsaved changes are pending on the selected annotation. */
    isDirty?: boolean;
    saveState?: AnnotationSaveState;
    /** Permits `painting` and the raw motivation control. */
    expertMode?: boolean;
    /** Host-configured BCP 47 languages available for annotation authoring. */
    languages?: string[];
    ondelete?: ((detail: { id: string }) => void) | undefined;
    onupdate?:
      | ((detail: {
          id: string;
          patch: Partial<ResolvedAnnotation>;
          options?: {
            language?: string;
            bodyPurpose?: string;
            textDirection?: string;
            bodyPath?: string;
            createBody?: boolean;
          };
        }) => void)
      | undefined;
    onsave?: (() => void) | undefined;
    oncancel?: (() => void) | undefined;
  }

  let {
    annotation = null,
    layers = [],
    total = 0,
    index = 0,
    isDraft = false,
    isDirty = false,
    saveState = { status: 'clean' },
    expertMode = false,
    languages = ['en'],
    ondelete = undefined,
    onupdate = undefined,
    onsave = undefined,
    oncancel = undefined,
  }: Props = $props();

  let currentAnnotationSignature = $state('');
  let localLabel = $state('');
  let localText = $state('');
  let localNotes = $state('');
  let localTags = $state<string[]>([]);
  let localTagInput = $state('');
  let localMotivation = $state(DEFAULT_MOTIVATION);
  let localDirection = $state('');
  let localPurpose = $state('');
  let localLayer = $state('mine');
  let showRawMotivation = $state(false);
  let activeBodyPath = $state('');
  let activeLanguage = $state('');
  let lastAnnotationId = $state('');

  const DEFAULT_LAYER_ID = 'mine';
  const firstLayerId = () => layers[0]?.id ?? DEFAULT_LAYER_ID;
  const findLayer = (layerId?: string): LayerItem | undefined =>
    layers.find((layer) => layer.id === layerId);
  /*
   * Falls back to the same layer the stage draws an unassigned annotation on
   * (see `normalizeLayerId` in ViewerLayout). Falling back to the first layer
   * instead had the inspector reporting "Research Notes" for annotations
   * rendered in the "My Annotations" colour.
   */
  const normalizeLayer = (layer?: string): string =>
    findLayer(layer)?.id ?? findLayer(DEFAULT_LAYER_ID)?.id ?? firstLayerId();

  /**
   * The preset that describes an annotation's motivation.
   *
   * Legacy `oa:` and `sc:` prefixes are read here so an imported document
   * selects the right preset; nothing writes them back. New output always uses
   * the compact Presentation 3 term.
   */
  const normalizeMotivation = (value: string | undefined): string => {
    if (!value) return DEFAULT_MOTIVATION;
    const compact = value.replace(/^(?:oa|sc):/, '');
    return compact || DEFAULT_MOTIVATION;
  };

  const editableTextBodies = $derived(
    annotation?.bodies?.filter(
      (body) => body.type !== 'image' && body.purpose !== 'tagging',
    ) ?? [],
  );
  const configuredLanguages = $derived(normaliseAuthoringLanguages(languages));
  const languageChoices = $derived.by(() => {
    const values = [...configuredLanguages];
    for (const body of editableTextBodies) {
      const language = body.language ?? '';
      if (!values.some((entry) => entry.toLowerCase() === language.toLowerCase())) {
        values.push(language);
      }
    }
    return values;
  });
  const bodyForLanguage = (language: string) =>
    editableTextBodies.find(
      (body) => (body.language ?? '').toLowerCase() === language.toLowerCase(),
    );
  const initialLanguage = () => {
    const configuredBodyLanguage = configuredLanguages.find((language) =>
      bodyForLanguage(language),
    );
    if (configuredBodyLanguage) return configuredBodyLanguage;
    if (editableTextBodies[0]) return editableTextBodies[0].language ?? '';
    return configuredLanguages[0] ?? '';
  };
  const activeBody = $derived(
    editableTextBodies.find(
      (body) =>
        body.path === activeBodyPath &&
        (body.language ?? '').toLowerCase() === activeLanguage.toLowerCase(),
    ) ?? bodyForLanguage(activeLanguage),
  );

  /** Selected preset id, or empty when the motivation has no preset. */
  const presetId = (motivation: string): string =>
    presetForMotivation(normalizeMotivation(motivation))?.id ?? '';

  let readOnly = $derived(isForeign(annotation?.provenance));
  let renderOnly = $derived(annotation?.editability === 'render-only');
  let diagnostics = $derived(
    summariseDiagnostics(toMangoDiagnostics(annotation?.diagnostics ?? [], 'loading')),
  );

  /** Everything the parser kept that this panel has no editor for. */
  let preserved = $derived.by(() => {
    const document = annotation?.document;
    if (!document) return [] as Array<[string, string]>;
    const entries: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(document.extensions)) {
      if (key.startsWith('mango:')) continue;
      entries.push([key, typeof value === 'string' ? value : JSON.stringify(value)]);
    }
    if (document.creator.length) {
      entries.push(['creator', document.creator.map((agent) => agent.name ?? agent.id ?? '').join(', ')]);
    }
    if (document.created) entries.push(['created', document.created]);
    if (document.modified) entries.push(['modified', document.modified]);
    if (document.rights.length) entries.push(['rights', document.rights.join(', ')]);
    for (const target of document.targets) {
      for (const selector of target.selectors) {
        if (selector.refinedBy.length) {
          entries.push([
            'refinedBy',
            selector.refinedBy.map((refinement) => refinement.kind).join(', '),
          ]);
        }
      }
    }
    return entries;
  });

  $effect(() => {
    if (annotation) {
      if (annotation.id !== lastAnnotationId) {
        lastAnnotationId = annotation.id;
        activeLanguage = initialLanguage();
        activeBodyPath = '';
      } else if (!languageChoices.includes(activeLanguage)) {
        activeLanguage = configuredLanguages[0] ?? languageChoices[0] ?? '';
        activeBodyPath = '';
      }
      const body = activeBody;
      if (body?.path && activeBodyPath !== body.path) {
        activeBodyPath = body.path;
      }
      const signature = JSON.stringify({
        id: annotation.id,
        label: annotation.label ?? '',
        bodies: editableTextBodies,
        activeBodyPath: body?.path ?? '',
        notes: annotation.notes ?? '',
        tags: annotation.tags ?? [],
        motivation: annotation.motivation?.[0] ?? '',
        layer: annotation.targetStyleClass ?? '',
        language: activeLanguage,
        purpose: body?.purpose ?? '',
        direction: body?.textDirection ?? '',
      });
      if (signature === currentAnnotationSignature) return;
      currentAnnotationSignature = signature;
      localLabel = annotation.label ?? '';
      localText = body?.value ?? '';
      localNotes = annotation.notes ?? '';
      localTags = [...(annotation.tags ?? [])];
      localTagInput = '';
      localMotivation = normalizeMotivation(annotation.motivation?.[0]);
      localLayer = normalizeLayer(annotation.targetStyleClass);
      localPurpose =
        body?.purpose ??
        presetForMotivation(normalizeMotivation(annotation.motivation?.[0]))?.bodyPurpose ??
        'commenting';
      localDirection = body?.textDirection ?? '';
    } else if (!annotation) {
      currentAnnotationSignature = '';
      activeBodyPath = '';
      activeLanguage = '';
      lastAnnotationId = '';
    }
  });
  $effect(() => {
    if (!annotation) return;
    const normalized = normalizeLayer(annotation.targetStyleClass);
    if (localLayer !== normalized) {
      localLayer = normalized;
    }
  });

  const patch = (
    value: Partial<ResolvedAnnotation>,
    options: {
      language?: string;
      bodyPurpose?: string;
      textDirection?: string;
      bodyPath?: string;
      createBody?: boolean;
    } = {},
  ) => {
    if (annotation) onupdate?.({ id: annotation.id, patch: value, options });
  };

  const handleDirectionChange = (val: string) => {
    localDirection = val;
    patch({}, { textDirection: val, bodyPath: activeBody?.path });
  };

  const handleLabelInput = (val: string) => {
    localLabel = val;
    patch({ label: val });
  };

  const handleTextInput = (val: string) => {
    localText = val;
    const selectedBody = bodyForLanguage(activeLanguage);
    if (!selectedBody) {
      if (!val.trim() || !activeLanguage) return;
      patch(
        { text: val },
        {
          createBody: true,
          language: activeLanguage,
          bodyPurpose: localPurpose || 'commenting',
          textDirection: localDirection || undefined,
        },
      );
      return;
    }
    patch({ text: val }, { bodyPath: selectedBody.path });
  };

  const selectLanguage = (language: string) => {
    activeLanguage = language;
    activeBodyPath = bodyForLanguage(language)?.path ?? '';
    currentAnnotationSignature = '';
  };

  const removeActiveTranslation = () => {
    if (!activeBody?.path) return;
    patch({ text: '' }, { bodyPath: activeBody.path });
    activeBodyPath = '';
    currentAnnotationSignature = '';
  };

  const handleNotesInput = (val: string) => {
    localNotes = val;
    patch({ notes: val });
  };

  const commitTags = (tags: string[]) => {
    localTags = tags;
    patch({ tags });
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

  const removeTag = (idx: number) => {
    if (idx < 0 || idx >= localTags.length) return;
    commitTags(localTags.filter((_, i) => i !== idx));
  };

  /**
   * Applies a task preset.
   *
   * The preset sets the motivation and the body purpose together, which is the
   * point of having presets: the two are separate fields with separate
   * vocabularies, and asking a user to keep them consistent by hand is asking
   * them to learn the difference in order to write a comment.
   */
  const handlePresetChange = (id: string) => {
    const preset = motivationPresets(expertMode).find((entry) => entry.id === id);
    if (!preset) return;
    localMotivation = preset.motivation;
    if (preset.bodyPurpose) localPurpose = preset.bodyPurpose;
    patch(
      { motivation: [preset.motivation] },
      preset.bodyPurpose
        ? { bodyPurpose: preset.bodyPurpose, bodyPath: activeBody?.path }
        : {},
    );
  };

  const handlePurposeChange = (val: string) => {
    localPurpose = val;
    patch({}, { bodyPurpose: val, bodyPath: activeBody?.path });
  };

  const handleMotivationChange = (val: string) => {
    localMotivation = val;
    patch({ motivation: [val] });
  };

  /*
   * Exact coordinates.
   *
   * Every geometry operation the stage offers is a pointer gesture, so without
   * this there is no way at all to place or resize a shape from a keyboard.
   * Numbers are also simply more precise than a drag when the region is known.
   *
   * The values go through the ordinary patch path rather than the editor's
   * `setGeometry`, so an exact edit is the same kind of change as a drag — one
   * undo step, one dirty flag, one source of truth.
   */
  const geometryFields = $derived.by(() => {
    if (!annotation) return [];
    if (annotation.rect) {
      const rect = annotation.rect;
      return [
        { key: 'x', label: 'x', value: rect.x },
        { key: 'y', label: 'y', value: rect.y },
        { key: 'w', label: 'w', value: rect.w },
        { key: 'h', label: 'h', value: rect.h },
      ];
    }
    if (annotation.point) {
      return [
        { key: 'x', label: 'x', value: annotation.point.x },
        { key: 'y', label: 'y', value: annotation.point.y },
      ];
    }
    if (annotation.polygon?.points.length) {
      const xs = annotation.polygon.points.map((point) => point.x);
      const ys = annotation.polygon.points.map((point) => point.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return [
        { key: 'x', label: 'x', value: x },
        { key: 'y', label: 'y', value: y },
        { key: 'w', label: 'w', value: Math.max(...xs) - x },
        { key: 'h', label: 'h', value: Math.max(...ys) - y },
      ];
    }
    return [];
  });

  const handleGeometryInput = (key: string, raw: string) => {
    if (!annotation) return;
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return;

    if (annotation.rect) {
      const rect = { ...annotation.rect, [key]: value };
      // A zero or negative extent is not a rectangle, and the editor cannot
      // draw one back out of it.
      if (rect.w <= 0 || rect.h <= 0) return;
      patch({ shapeType: 'rect', rect });
      return;
    }
    if (annotation.point) {
      patch({ shapeType: 'point', point: { ...annotation.point, [key]: value } });
      return;
    }
    if (annotation.polygon?.points.length) {
      const points = annotation.polygon.points;
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const bounds = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      };
      if ((key === 'w' || key === 'h') && value <= 0) return;
      if ((key === 'w' && bounds.w === 0) || (key === 'h' && bounds.h === 0)) return;
      const next = points.map((point) => {
        if (key === 'x') return { ...point, x: point.x + value - bounds.x };
        if (key === 'y') return { ...point, y: point.y + value - bounds.y };
        if (key === 'w') {
          return { ...point, x: bounds.x + (point.x - bounds.x) * (value / bounds.w) };
        }
        return { ...point, y: bounds.y + (point.y - bounds.y) * (value / bounds.h) };
      });
      patch({
        shapeType: annotation.shapeType,
        // The canonical geometry operation regenerates the selector. Carrying
        // the old serialized SVG beside new points would leave two conflicting
        // descriptions of the same shape in the editing projection.
        polygon: { points: next },
      });
    }
  };

  const handleLayerChange = (val: string) => {
    localLayer = val;
    // The layer is a grouping and a presentation choice. It is never the
    // motivation, and changing it does not change what the annotation means.
    patch({ targetStyleClass: val });
  };
</script>

<aside class="right-inspector">
  <div class="right-inspector__head">
    <h3>{$t('viewer.panels.annotations.editor.detailsTitle')}</h3>
    <span>{isDraft ? $t('viewer.panels.annotations.editor.newAnnotation') : total > 0 ? $t('viewer.panels.annotations.editor.pagination', { current: index + 1, total }) : $t('viewer.panels.annotations.editor.pagination', { current: 0, total: 0 })}</span>
  </div>

  {#if annotation}
    <div class="right-inspector__scroll">
      {#if annotation.provenance}
        <p class="right-inspector__provenance" data-testid="annotation-provenance">
          <span
            class="right-inspector__badge"
            data-provenance={annotation.provenance}
            title={$t(`viewer.panels.annotations.editor.provenance.${annotation.provenance}`)}
          >
            {$t(`viewer.panels.annotations.editor.provenance.${annotation.provenance}`)}
          </span>
          {#if readOnly}
            <span class="right-inspector__note">{$t('viewer.panels.annotations.editor.readOnlyHint')}</span>
          {/if}
          {#if renderOnly}
            <span class="right-inspector__note">{$t('viewer.panels.annotations.editor.renderOnlyHint')}</span>
          {/if}
        </p>
      {/if}

      {#if diagnostics.length > 0}
        <ul class="right-inspector__diagnostics" data-testid="annotation-diagnostics">
          {#each diagnostics as diagnostic (diagnostic.code)}
            <li data-severity={diagnostic.severity}>
              {diagnostic.messageKey ? $t(diagnostic.messageKey) : diagnostic.detail}
              {#if diagnostic.count > 1}<span> ×{diagnostic.count}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}

      <details class="inspector-accordion" open>
        <summary class="inspector-accordion__summary">{$t('viewer.panels.annotations.editor.details')}</summary>
        <div class="inspector-accordion__content">
          <div class="right-inspector__group">
            <label for="anno-preset">{$t('viewer.panels.annotations.editor.task')}</label>
            <select
              id="anno-preset"
              value={presetId(localMotivation)}
              onchange={(e) => handlePresetChange(e.currentTarget.value)}
            >
              {#if !presetId(localMotivation)}
                <option value="">{$t('viewer.panels.annotations.editor.motivations.other', { motivation: localMotivation })}</option>
              {/if}
              {#each motivationPresets(expertMode) as preset (preset.id)}
                <option value={preset.id}>
                  {$t(`viewer.panels.annotations.editor.motivationPresets.${preset.id}`)}
                </option>
              {/each}
            </select>
            {#if isExpertMotivation(localMotivation)}
              <p class="right-inspector__warning">{$t('viewer.panels.annotations.editor.paintingWarning')}</p>
            {/if}
          </div>

          {#if expertMode}
            <div class="right-inspector__group">
              <button
                type="button"
                class="right-inspector__link"
                aria-expanded={showRawMotivation}
                onclick={() => (showRawMotivation = !showRawMotivation)}
              >
                {$t('viewer.panels.annotations.editor.rawMotivation')}
              </button>
              {#if showRawMotivation}
                <select
                  id="anno-motivation"
                  aria-label={$t('viewer.panels.annotations.editor.motivation')}
                  value={localMotivation}
                  onchange={(e) => handleMotivationChange(e.currentTarget.value)}
                >
                  {#each authoringMotivations(expertMode) as motivation (motivation)}
                    <option value={motivation}>{motivation}</option>
                  {/each}
                </select>
              {/if}
            </div>
          {/if}

          <div class="right-inspector__group">
            <label for="anno-layer">{$t('viewer.panels.annotations.editor.layer')}</label>
            <select
              id="anno-layer"
              value={localLayer}
              onchange={(e) => handleLayerChange(e.currentTarget.value)}
            >
              {#each layers as layer (layer.id)}
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
            <span class="right-inspector__field-label">
              {$t('viewer.panels.annotations.editor.translations')}
            </span>
            <LanguageTabs
              languages={languageChoices}
              {activeLanguage}
              ariaLabel={$t('viewer.panels.annotations.editor.translations')}
              noLanguageLabel={$t('viewer.panels.annotations.editor.noLanguage')}
              onchange={selectLanguage}
            />
            {#if activeBody && editableTextBodies.length > 1}
              <button
                type="button"
                class="right-inspector__remove-translation"
                onclick={removeActiveTranslation}
              >
                {$t('viewer.panels.annotations.editor.removeTranslation', {
                  language:
                    activeBody.language || $t('viewer.panels.annotations.editor.noLanguage'),
                })}
              </button>
            {/if}
          </div>

          <div class="right-inspector__group">
            <label for="anno-direction">{$t('viewer.panels.annotations.editor.textDirection')}</label>
            <select
              id="anno-direction"
              value={localDirection}
              onchange={(e) => handleDirectionChange(e.currentTarget.value)}
            >
              <option value="">{$t('viewer.panels.annotations.editor.direction.auto')}</option>
              <option value="ltr">{$t('viewer.panels.annotations.editor.direction.ltr')}</option>
              <option value="rtl">{$t('viewer.panels.annotations.editor.direction.rtl')}</option>
            </select>
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

          {#if expertMode}
            <div class="right-inspector__group">
              <label for="anno-purpose">{$t('viewer.panels.annotations.editor.bodyPurpose')}</label>
              <select
                id="anno-purpose"
                value={localPurpose}
                onchange={(e) => handlePurposeChange(e.currentTarget.value)}
              >
                <option value="">{$t('viewer.panels.annotations.editor.direction.auto')}</option>
                {#each AUTHORING_PURPOSES as purpose (purpose)}
                  <option value={purpose}>{purpose}</option>
                {/each}
              </select>
            </div>
          {/if}

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
                {#each localTags as tag, idx (tag)}
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

      {#if geometryFields.length > 0}
        <details class="inspector-accordion" data-testid="annotation-geometry">
          <summary class="inspector-accordion__summary"
            >{$t('viewer.panels.annotations.editor.position')}</summary
          >
          <div class="inspector-accordion__content">
            <div class="right-inspector__coordinates">
              {#each geometryFields as field (field.key)}
                <div class="right-inspector__group">
                  <label for={`anno-geom-${field.key}`}>{field.label}</label>
                  <input
                    id={`anno-geom-${field.key}`}
                    type="number"
                    inputmode="numeric"
                    step="1"
                    disabled={readOnly || renderOnly}
                    value={Math.round(field.value)}
                    onchange={(event) => handleGeometryInput(field.key, event.currentTarget.value)}
                  />
                </div>
              {/each}
            </div>
            <p class="right-inspector__note">
              {$t('viewer.panels.annotations.editor.positionHint')}
            </p>
          </div>
        </details>
      {/if}

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
              aria-describedby="anno-notes-privacy"
            ></textarea>
            <p class="right-inspector__note" id="anno-notes-privacy">
              {$t('viewer.panels.annotations.editor.privateNotesHint')}
            </p>
          </div>
        </div>
      </details>

      {#if preserved.length > 0}
        <details class="inspector-accordion" data-testid="annotation-advanced">
          <summary class="inspector-accordion__summary">{$t('viewer.panels.annotations.editor.advanced')}</summary>
          <div class="inspector-accordion__content">
            <p class="right-inspector__note">{$t('viewer.panels.annotations.editor.advancedHint')}</p>
            <dl class="right-inspector__preserved">
              {#each preserved as [key, value] (key)}
                <dt>{key}</dt>
                <dd>{value}</dd>
              {/each}
            </dl>
          </div>
        </details>
      {/if}
    </div>

    <div class="right-inspector__actions">
      {#if saveState.status === 'failed' || saveState.status === 'conflicted'}
        <p class="right-inspector__error" role="alert">{saveState.message}</p>
      {/if}
      <p class="right-inspector__state" aria-live="polite">
        <!-- A draft has never been saved, so it always has unsaved work in it
             even before the user has typed anything. -->
        {$t(
          `viewer.panels.annotations.editor.saveState.${
            (isDirty || isDraft) && saveState.status === 'clean' ? 'dirty' : saveState.status
          }`,
        )}
      </p>
      <button
        type="button"
        class="right-inspector__save"
        disabled={saveState.status === 'saving' || (!isDraft && !isDirty)}
        onclick={onsave}
      >
        {isDraft ? $t('viewer.panels.annotations.editor.saveAnnotation') : $t('viewer.panels.annotations.editor.saveChanges')}
      </button>
      <button
        type="button"
        class="right-inspector__cancel"
        disabled={!isDirty && !isDraft}
        onclick={oncancel}>{$t('viewer.panels.annotations.editor.cancel')}</button
      >
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

  .right-inspector__provenance {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0 0 4px;
  }
  /*
   * A shape, not only a colour. Provenance decides whether an edit is allowed,
   * so it has to stay legible when author colours are off or indistinguishable.
   */
  .right-inspector__badge {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .right-inspector__badge[data-provenance='manifest'],
  .right-inspector__badge[data-provenance='external'] {
    border-style: dashed;
  }
  .right-inspector__badge[data-provenance='draft'] {
    border-style: dotted;
  }
  .right-inspector__note {
    margin: 0;
    color: var(--viewer-muted);
    font-size: 11px;
  }
  .right-inspector__warning {
    margin: 0;
    font-size: 11px;
    color: #fbbf24;
  }
  .right-inspector__error {
    margin: 0;
    font-size: 12px;
    color: #ffb3b3;
  }
  .right-inspector__state {
    margin: 0;
    font-size: 11px;
    color: var(--viewer-muted);
  }
  .right-inspector__diagnostics {
    margin: 0 0 4px;
    padding-left: 16px;
    font-size: 11px;
    color: var(--viewer-muted);
  }
  .right-inspector__diagnostics li[data-severity='error'] {
    color: #ffb3b3;
  }
  .right-inspector__link {
    background: none;
    border: 0;
    color: var(--viewer-text);
    font-size: 11px;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }
  .right-inspector__preserved {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 10px;
    font-size: 11px;
  }
  .right-inspector__preserved dt {
    color: var(--viewer-muted);
  }
  .right-inspector__preserved dd {
    margin: 0;
    overflow-wrap: anywhere;
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

  .right-inspector__coordinates {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
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
  .right-inspector__field-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--viewer-muted);
  }
  .right-inspector__remove-translation {
    justify-self: start;
    border: 0;
    padding: 2px 0;
    background: transparent;
    color: var(--viewer-danger, #ffb3b3);
    font: inherit;
    font-size: 11px;
    text-decoration: underline;
    cursor: pointer;
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
  .right-inspector__save:hover:not(:disabled) {
    background: #ff8552;
  }
  .right-inspector__save:disabled,
  .right-inspector__cancel:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .right-inspector__cancel {
    border: 1px solid var(--viewer-panel-border);
    color: var(--viewer-text);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    min-height: 38px;
    cursor: pointer;
    font-size: 13px;
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
