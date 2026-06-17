import { writable } from 'svelte/store';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import { DEFAULT_IMAGE_FILTERS, type ImageFilters } from '../../core/types/filters';
import type { ViewBox } from '../../core/types/viewer';
import type { ViewerConfig } from '../../core/types/config';
import type { ViewerPlugin } from '../../core/types/plugin';
import type { SearchResult } from '../iiif/iiifSearch';

export type ViewerStateStores = {
  manifestId: ReturnType<typeof writable<string>>;
  config: ReturnType<typeof writable<ViewerConfig | undefined>>;
  plugins: ReturnType<typeof writable<ViewerPlugin[]>>;
  selectedCanvasIndex: ReturnType<typeof writable<number>>;
  selectedMediaIndex: ReturnType<typeof writable<number>>;
  showThumbnails: ReturnType<typeof writable<boolean>>;
  showContents: ReturnType<typeof writable<boolean>>;
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
  userAnnotations: ReturnType<
    typeof writable<Record<string, ResolvedAnnotation[]>>
  >;
  externalAnnotations: ReturnType<
    typeof writable<Record<string, ResolvedAnnotation[]>>
  >;
  iiifSearchResults: ReturnType<typeof writable<SearchResult[]>>;
};

export const createViewerState = (
  initial?: Partial<{
    manifestId: string;
    config: ViewerConfig;
    plugins: ViewerPlugin[];
  }>,
): ViewerStateStores => ({
  manifestId: writable(initial?.manifestId ?? ''),
  config: writable(initial?.config),
  plugins: writable(initial?.plugins ?? []),
  selectedCanvasIndex: writable(0),
  selectedMediaIndex: writable(0),
  showThumbnails: writable(true),
  showContents: writable(true),
  showMetadata: writable(true),
  showSearch: writable(true),
  showAnnotations: writable(true),
  showTools: writable(false),
  showSettings: writable(false),
  showLayers: writable(false),
  layoutMode: writable<'single' | 'two-page' | 'continuous' | 'gallery'>('single'),
  layerOpacities: writable<Record<string, number>>({}),
  annotationMode: writable('edit'),
  searchQuery: writable(''),
  selectedSearchResultId: writable<string | null>(null),
  activeAnnotationId: writable<string | null>(null),
  hoverAnnotationId: writable<string | null>(null),
  imageFilters: writable({ ...DEFAULT_IMAGE_FILTERS }),
  viewBox: writable(null),
  zoom: writable(0),
  rotation: writable(0),
  mediaTime: writable(0),
  mediaDuration: writable(undefined),
  userAnnotations: writable({}),
  externalAnnotations: writable({}),
  iiifSearchResults: writable([]),
});
