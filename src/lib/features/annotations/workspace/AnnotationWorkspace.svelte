<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';
  import type { AnnotationSaveState } from '../model';
  import LeftSidebar, { type LayerItem } from './LeftSidebar.svelte';
  import RightInspector from './RightInspector.svelte';
  import AnnotationBrowserTable from './AnnotationBrowserTable.svelte';
  import { t } from '../../../i18n';

  import type { ChapterAnnotationTool as Tool } from '../../../core/types/story';

  interface Props {
    annotations?: ResolvedAnnotation[];
    activeAnnotationId?: string | null;
    draftAnnotation?: ResolvedAnnotation | null;
    activeTool?: Tool;
    layers?: LayerItem[];
    ontoolchange?: ((detail: { tool: Tool }) => void) | undefined;
    ontogglelayer?: ((detail: { id: string }) => void) | undefined;
    /** Layer new annotations are created in. */
    activeLayerId?: string;
    onactivelayerchange?: ((detail: { id: string }) => void) | undefined;
    onaddlayer?: (() => void) | undefined;
    onlayercolorchange?: ((detail: { id: string; color: string }) => void) | undefined;
    onlayerrename?: ((detail: { id: string; name: string }) => void) | undefined;
    onlayermove?: ((detail: { id: string; direction: -1 | 1 }) => void) | undefined;
    onlayerarchive?: ((detail: { id: string; archived: boolean }) => void) | undefined;
    onannotationselect?: ((detail: { id: string }) => void) | undefined;
    onannotationdelete?: ((detail: { id: string }) => void) | undefined;
    onannotationupdate?:
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
    onannotationsave?: (() => void) | undefined;
    onannotationcancel?: (() => void) | undefined;
    canUndo?: boolean;
    canRedo?: boolean;
    onundo?: (() => void) | undefined;
    onredo?: (() => void) | undefined;
    onkeyboardcreate?:
      | ((detail: { tool: 'rectangle' | 'point' }) => void)
      | undefined;
    onkeydown?: ((event: KeyboardEvent) => void) | undefined;
    /** Unsaved changes are pending on the selected annotation. */
    isDirty?: boolean;
    saveState?: AnnotationSaveState;
    /** Permits `painting` authoring and the raw motivation control. */
    expertMode?: boolean;
    /** Host-configured languages available in the shared annotation switch. */
    languages?: string[];
    /**
     * Reports whether the annotation list is showing. The list needs a box of
     * its own to be usable, and the element grows to provide it rather than
     * taking the space off the page being annotated.
     */
    onlistopenchange?: ((detail: { open: boolean }) => void) | undefined;
    stage?: Snippet;
  }

  let {
    annotations = [],
    activeAnnotationId = null,
    draftAnnotation = null,
    activeTool = 'rectangle',
    layers = [
      { id: 'research', name: 'Research Notes', color: '#fb7185', visible: true },
      { id: 'transcription', name: 'Transcription', color: '#60a5fa', visible: true },
      { id: 'highlights', name: 'Highlights', color: '#34d399', visible: true },
      { id: 'mine', name: 'My Annotations', color: '#a78bfa', visible: true },
    ],
    ontoolchange = undefined,
    ontogglelayer = undefined,
    activeLayerId = 'mine',
    onactivelayerchange = undefined,
    onaddlayer = undefined,
    onlayercolorchange = undefined,
    onlayerrename = undefined,
    onlayermove = undefined,
    onlayerarchive = undefined,
    onannotationselect = undefined,
    onannotationdelete = undefined,
    onannotationupdate = undefined,
    onannotationsave = undefined,
    onannotationcancel = undefined,
    canUndo = false,
    canRedo = false,
    onundo = undefined,
    onredo = undefined,
    onkeyboardcreate = undefined,
    onkeydown = undefined,
    isDirty = false,
    saveState = { status: 'clean' },
    expertMode = false,
    languages = ['en'],
    onlistopenchange = undefined,
    stage,
  }: Props = $props();

  const activeAnnotation = $derived(
    draftAnnotation && draftAnnotation.id === activeAnnotationId
      ? draftAnnotation
      : (annotations.find((item) => item.id === activeAnnotationId) ?? null),
  );
  const activeIndex = $derived(
    Math.max(
      0,
      annotations.findIndex((item) => item.id === activeAnnotationId),
    ),
  );
  const isDraft = $derived(
    draftAnnotation ? draftAnnotation.id === activeAnnotationId : false,
  );

  /*
   * A portrait page only grows when the stage grows *taller* — a contain fit
   * binds on height, so extra width is dead space. Every reclaimable pixel of
   * height therefore matters more than it looks, and the list below the stage
   * was holding 220 of them open over an empty table.
   *
   * Null means "follow the content": closed until there is something to list.
   * A click pins the choice, so opening an empty list to check it is empty
   * does not then snap shut, and closing a populated one stays closed.
   */
  let listPinned = $state<boolean | null>(null);
  const listOpen = $derived(listPinned ?? annotations.length > 0);
  $effect(() => {
    onlistopenchange?.({ open: listOpen });
  });

  let leftOpen = $state(true);
  let rightOpen = $state(true);
</script>

<!-- The listener deliberately scopes viewer undo/redo to this labelled region. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  aria-label={$t('viewer.panels.annotations.editor.workspaceLabel')}
  onkeydown={(event) => onkeydown?.(event)}
  class="annotation-workspace"
  class:annotation-workspace--left-closed={!leftOpen}
  class:annotation-workspace--right-closed={!rightOpen}
>
  <aside class="annotation-workspace__left" class:is-closed={!leftOpen}>
    <button
      type="button"
      class="annotation-workspace__collapse"
      aria-expanded={leftOpen}
      aria-label={leftOpen
        ? $t('viewer.panels.annotations.editor.collapseToolsPanel')
        : $t('viewer.panels.annotations.editor.expandToolsPanel')}
      title={leftOpen
        ? $t('viewer.panels.annotations.editor.collapseToolsPanel')
        : $t('viewer.panels.annotations.editor.expandToolsPanel')}
      onclick={() => (leftOpen = !leftOpen)}
    >
      {leftOpen ? '‹' : '›'}
    </button>
    {#if leftOpen}
      <LeftSidebar
        {activeTool}
        {layers}
        {activeLayerId}
        {onactivelayerchange}
        {canUndo}
        {canRedo}
        {onundo}
        {onredo}
        {onkeyboardcreate}
        {ontoolchange}
        {ontogglelayer}
        {onaddlayer}
        {onlayercolorchange}
        {onlayerrename}
        {onlayermove}
        {onlayerarchive}
      />
    {:else}
      <span class="annotation-workspace__rail-label">
        {$t('viewer.panels.annotations.editor.toolsPanel')}
      </span>
    {/if}
  </aside>

  <div class="annotation-workspace__center" class:is-list-open={listOpen}>
    <div class="annotation-workspace__stage">
      {#if stage}
        {@render stage()}
      {/if}
    </div>
    <div class="annotation-workspace__bottom">
      <AnnotationBrowserTable
        {annotations}
        {layers}
        activeId={activeAnnotationId}
        onselect={onannotationselect}
        open={listOpen}
        ontoggle={() => (listPinned = !listOpen)}
      />
    </div>
  </div>

  <aside class="annotation-workspace__right" class:is-closed={!rightOpen}>
    <button
      type="button"
      class="annotation-workspace__collapse"
      aria-expanded={rightOpen}
      aria-label={rightOpen
        ? $t('viewer.panels.annotations.editor.collapseDetailsPanel')
        : $t('viewer.panels.annotations.editor.expandDetailsPanel')}
      title={rightOpen
        ? $t('viewer.panels.annotations.editor.collapseDetailsPanel')
        : $t('viewer.panels.annotations.editor.expandDetailsPanel')}
      onclick={() => (rightOpen = !rightOpen)}
    >
      {rightOpen ? '›' : '‹'}
    </button>
    {#if rightOpen}
      <RightInspector
        annotation={activeAnnotation}
        total={annotations.length}
        index={activeIndex}
        {layers}
        {isDraft}
        {isDirty}
        {saveState}
        {expertMode}
        {languages}
        oncancel={onannotationcancel}
        ondelete={onannotationdelete}
        onupdate={onannotationupdate}
        onsave={onannotationsave}
      />
    {:else}
      <span class="annotation-workspace__rail-label">
        {$t('viewer.panels.annotations.editor.detailsTitle')}
      </span>
    {/if}
  </aside>
</section>

<style>
  .annotation-workspace {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr) 280px;
    gap: 12px;
    height: 100%;
    min-height: 0;
  }
  .annotation-workspace--left-closed {
    grid-template-columns: 40px minmax(0, 1fr) 280px;
  }
  .annotation-workspace--right-closed {
    grid-template-columns: 240px minmax(0, 1fr) 40px;
  }
  .annotation-workspace--left-closed.annotation-workspace--right-closed {
    grid-template-columns: 40px minmax(0, 1fr) 40px;
  }
  .annotation-workspace__left,
  .annotation-workspace__right,
  .annotation-workspace__bottom {
    border: 1px solid var(--viewer-panel-border);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    padding: 10px;
    min-height: 0;
    overflow: auto;
  }
  .annotation-workspace__left,
  .annotation-workspace__right {
    position: relative;
  }
  .annotation-workspace__left.is-closed,
  .annotation-workspace__right.is-closed {
    padding: 6px 4px;
    overflow: hidden;
  }

  /* Each panel's toggle sits on its inner edge, so the chevron points the way
     the panel will move and never lands on the header's own controls. */
  .annotation-workspace__collapse {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border: 1px solid var(--viewer-panel-border);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--viewer-muted, #9aa6b2);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    z-index: 2;
  }
  .annotation-workspace__collapse:hover {
    color: var(--viewer-fg, #fff);
  }
  .annotation-workspace__right .annotation-workspace__collapse {
    right: auto;
    left: 6px;
  }
  /* Clear the toggle so the inspector's title and counter keep their row. */
  .annotation-workspace__right :global(.right-inspector__head) {
    padding-left: 26px;
  }
  .is-closed .annotation-workspace__collapse {
    position: static;
    margin: 0 auto;
  }

  /* Vertical so a 40px rail still says what it is. */
  .annotation-workspace__rail-label {
    display: block;
    margin: 10px auto 0;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    white-space: nowrap;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--viewer-muted, #9aa6b2);
    pointer-events: none;
  }

  .annotation-workspace__center {
    display: grid;
    /* Closed, the list is just its own header bar, and the stage takes the
       rest — which on a portrait page is the only dimension that buys size. */
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 10px;
    min-height: 0;
  }
  /*
   * The list gets a real box of its own and scrolls its rows inside it. It
   * must not become a second scroller nested in a scrolling column: that put
   * the list below the fold, so reaching it meant scrolling the column and
   * then scrolling the table again. The element grows to pay for this box
   * instead — see the host height in ViewerElement.
   */
  .annotation-workspace__center.is-list-open {
    grid-template-rows: minmax(0, 1fr) 220px;
  }
  .annotation-workspace__stage {
    min-height: 0;
    overflow: hidden;
  }

  /*
   * 1024px, not 1200px. The three columns need 240 + 280 + gaps = ~544px of
   * chrome, so they still leave a ~480px canvas at 1025px wide; collapsing at
   * 1200 threw away the multi-column editor on ordinary 1280px laptops. This
   * also lines the editor up with the 1024px breakpoint every other surface uses.
   *
   * `overscroll-behavior` is deliberately left at the default so that reaching
   * the end of this scroller passes the gesture to the stage instead of trapping
   * it — a contained inner scroller is what made the authoring panel feel like it
   * could not be scrolled to the bottom.
   */
  @container mango-viewer (max-width: 1024px) {
    .annotation-workspace {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(220px, 32%) minmax(520px, 1fr) minmax(220px, 32%);
      height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .annotation-workspace__center {
      grid-template-rows: minmax(300px, 1fr) 220px;
    }
  }

  @container mango-viewer (max-width: 700px) {
    .annotation-workspace {
      grid-template-rows: 280px 520px 280px;
    }
  }
</style>
