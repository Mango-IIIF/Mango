import type { ImageFilters } from '../types/filters';
import { DEFAULT_IMAGE_FILTERS } from '../types/filters';
import type { ViewBox } from '../types/viewer';

export class ViewportState {
  manifestId = $state('');
  selectedCanvasIndex = $state(0);
  viewBox = $state<ViewBox | null>(null);
  imageFilters = $state<ImageFilters>({ ...DEFAULT_IMAGE_FILTERS });

  constructor(init?: {
    manifestId?: string;
    selectedCanvasIndex?: number;
    viewBox?: ViewBox | null;
    imageFilters?: ImageFilters;
  }) {
    if (!init) return;
    if (typeof init.manifestId === 'string') this.manifestId = init.manifestId;
    if (typeof init.selectedCanvasIndex === 'number') {
      this.selectedCanvasIndex = init.selectedCanvasIndex;
    }
    if (init.viewBox !== undefined) this.viewBox = init.viewBox;
    if (init.imageFilters) this.imageFilters = { ...init.imageFilters };
  }
}

export const VIEWPORT_STATE_CONTEXT_KEY = 'viewport-state';
