<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';
  import LeftSidebar, { type LayerItem } from './LeftSidebar.svelte';
  import RightInspector from './RightInspector.svelte';
  import AnnotationBrowserTable from './AnnotationBrowserTable.svelte';

  type Tool = 'select' | 'rectangle' | 'polygon' | 'point' | 'freehand' | 'line';

  interface Props {
    annotations?: ResolvedAnnotation[];
    activeAnnotationId?: string | null;
    draftAnnotation?: ResolvedAnnotation | null;
    activeTool?: Tool;
    layers?: LayerItem[];
    ontoolchange?: ((detail: { tool: Tool }) => void) | undefined;
    ontogglelayer?: ((detail: { id: string }) => void) | undefined;
    onaddlayer?: (() => void) | undefined;
    onlayercolorchange?: ((detail: { id: string; color: string }) => void) | undefined;
    onannotationselect?: ((detail: { id: string }) => void) | undefined;
    onannotationdelete?: ((detail: { id: string }) => void) | undefined;
    onannotationupdate?:
      | ((detail: { id: string; patch: Partial<ResolvedAnnotation> }) => void)
      | undefined;
    onannotationsave?: (() => void) | undefined;
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
    onaddlayer = undefined,
    onlayercolorchange = undefined,
    onannotationselect = undefined,
    onannotationdelete = undefined,
    onannotationupdate = undefined,
    onannotationsave = undefined,
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
</script>

<section class="annotation-workspace">
  <aside class="annotation-workspace__left">
    <LeftSidebar
      {activeTool}
      {layers}
      {ontoolchange}
      {ontogglelayer}
      {onaddlayer}
      {onlayercolorchange}
    />
  </aside>

  <div class="annotation-workspace__center">
    <div class="annotation-workspace__stage">
      {#if stage}
        {@render stage()}
      {/if}
    </div>
    <div class="annotation-workspace__bottom">
      <AnnotationBrowserTable
        {annotations}
        activeId={activeAnnotationId}
        onselect={onannotationselect}
      />
    </div>
  </div>

  <aside class="annotation-workspace__right">
    <RightInspector
      annotation={activeAnnotation}
      total={annotations.length}
      index={activeIndex}
      {layers}
      {isDraft}
      ondelete={onannotationdelete}
      onupdate={onannotationupdate}
      onsave={onannotationsave}
    />
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
  .annotation-workspace__center {
    display: grid;
    grid-template-rows: minmax(0, 1fr) 220px;
    gap: 10px;
    min-height: 0;
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
