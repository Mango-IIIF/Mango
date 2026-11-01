<script lang="ts">
  import { getViewerContext } from '../context';
  import { t } from '../../core/i18n';
  import GalleryStrip from './GalleryStrip.svelte';
  import PanelCloseButton from './PanelCloseButton.svelte';

  interface Props {
    redesigned?: boolean;
    onclose?: (() => void) | undefined;
    oncanvasSelect?: (payload: { index: number }) => void;
    onviewall?: () => void;
  }

  let {
    redesigned = false,
    onclose = undefined,
    oncanvasSelect = undefined,
    onviewall = undefined,
  }: Props = $props();

  const viewer = getViewerContext();
  const { canvases, canvasThumbnails } = viewer.derived;
  const { selectedCanvasIndex } = viewer.state;
</script>

<section class="panel panel--thumbnails" aria-label={$t('viewer.gallery.label')}>
  <div class="panel__header">
    <div class="panel__title">{$t('viewer.gallery.pages')}</div>
    <PanelCloseButton lucide={redesigned} label={$t('viewer.gallery.hide')} {onclose} />
  </div>
  <div class="panel__body">
    <GalleryStrip
      layout="grid"
      canvases={$canvases}
      canvasThumbnails={$canvasThumbnails}
      selectedCanvasIndex={$selectedCanvasIndex}
      {oncanvasSelect}
      {onviewall}
    />
  </div>
</section>
