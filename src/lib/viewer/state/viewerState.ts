import { writable } from 'svelte/store';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import { DEFAULT_IMAGE_FILTERS, type ImageFilters } from '../../core/types/filters';
import type { ViewBox } from '../../core/types/viewer';
import type { ViewerConfig } from '../../core/types/config';
import type { ViewerPlugin } from '../../core/types/plugin';

export type IIIFSearchAnnotation = ResolvedAnnotation & { canvasId?: string };

export type ViewerStateStores = {
  manifestId: ReturnType<typeof writable<string>>;
  collectionId: ReturnType<typeof writable<string>>;
  config: ReturnType<typeof writable<ViewerConfig | undefined>>;
  plugins: ReturnType<typeof writable<ViewerPlugin[]>>;
  selectedCanvasIndex: ReturnType<typeof writable<number>>;
  selectedMediaIndex: ReturnType<typeof writable<number>>;
  showThumbnails: ReturnType<typeof writable<boolean>>;
  showContents: ReturnType<typeof writable<boolean>>;
  showCollection: ReturnType<typeof writable<boolean>>;
  showMetadata: ReturnType<typeof writable<boolean>>;
  showSearch: ReturnType<typeof writable<boolean>>;
  showAnnotations: ReturnType<typeof writable<boolean>>;
  showTools: ReturnType<typeof writable<boolean>>;
  showSettings: ReturnType<typeof writable<boolean>>;
  showLayers: ReturnType<typeof writable<boolean>>;
  layoutMode: ReturnType<typeof writable<'single' | 'two-page' | 'continuous' | 'gallery'>>;
  layerOpacities: ReturnType<typeof writable<Record<string, number>>>;
  annotationMode: ReturnType<typeof writable<'edit' | 'create'>>;
  searchQuery: ReturnType<typeof writable<string>>;
  selectedSearchResultId: ReturnType<typeof writable<string | null>>;
  activeAnnotationId: ReturnType<typeof writable<string | null>>;
  hoverAnnotationId: ReturnType<typeof writable<string | null>>;
  imageFilters: ReturnType<typeof writable<ImageFilters>>;
  viewBox: ReturnType<typeof writable<ViewBox | null>>;
  zoom: ReturnType<typeof writable<number>>;
  rotation: ReturnType<typeof writable<number>>;
  mediaTime: ReturnType<typeof writable<number>>;
  mediaDuration: ReturnType<typeof writable<number | undefined>>;
  userAnnotations: ReturnType<typeof writable<Record<string, ResolvedAnnotation[]>>>;
  externalAnnotations: ReturnType<typeof writable<Record<string, ResolvedAnnotation[]>>>;
  iiifSearchResults: ReturnType<typeof writable<IIIFSearchAnnotation[]>>;
};

export const createViewerState = (
  initial?: Partial<{
    manifestId: string;
    config: ViewerConfig;
    plugins: ViewerPlugin[];
    selectedCanvasIndex: number;
    layoutMode: 'single' | 'two-page' | 'continuous' | 'gallery';
    rotation: number;
    viewBox: ViewBox | null;
  }>,
): ViewerStateStores => {
  const sidebarOpen =
    initial?.config?.sidebar?.enabled !== false && initial?.config?.sidebar?.open !== false;
  const activePanel = initial?.config?.sidebar?.activePanel ?? 'metadata';

  return {
    manifestId: writable(initial?.manifestId ?? ''),
    collectionId: writable(''),
    config: writable(initial?.config),
    plugins: writable(initial?.plugins ?? []),
    selectedCanvasIndex: writable(initial?.selectedCanvasIndex ?? 0),
    selectedMediaIndex: writable(0),
    showThumbnails: writable(true),
    showContents: writable(sidebarOpen && activePanel === 'contents'),
    showCollection: writable(false),
    showMetadata: writable(sidebarOpen && activePanel === 'metadata'),
    showSearch: writable(sidebarOpen && activePanel === 'search'),
    showAnnotations: writable(sidebarOpen && activePanel === 'annotations'),
    showTools: writable(sidebarOpen && activePanel === 'tools'),
    showSettings: writable(sidebarOpen && activePanel === 'settings'),
    showLayers: writable(sidebarOpen && activePanel === 'layers'),
    layoutMode: writable<'single' | 'two-page' | 'continuous' | 'gallery'>(
      initial?.layoutMode ?? 'single',
    ),
    layerOpacities: writable<Record<string, number>>({}),
    annotationMode: writable('edit'),
    searchQuery: writable(''),
    selectedSearchResultId: writable<string | null>(null),
    activeAnnotationId: writable<string | null>(null),
    hoverAnnotationId: writable<string | null>(null),
    imageFilters: writable({ ...DEFAULT_IMAGE_FILTERS }),
    viewBox: writable(initial?.viewBox ?? null),
    zoom: writable(0),
    rotation: writable(initial?.rotation ?? 0),
    mediaTime: writable(0),
    mediaDuration: writable(undefined),
    userAnnotations: writable({}),
    externalAnnotations: writable({}),
    iiifSearchResults: writable([]),
  };
};
