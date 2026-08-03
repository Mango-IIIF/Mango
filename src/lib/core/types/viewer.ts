export type ViewBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Intrinsic pixel dimensions of the media currently open in the viewer. */
export type ContentSize = {
  width: number;
  height: number;
};

export type ViewerStateSnapshot = {
  manifestId: string;
  canvasId: string | null;
  canvasIndex: number;
  canvasLabel?: string;
  canvases: { id: string; label?: string; index: number }[];
  mediaType: 'image' | 'video' | 'audio' | 'pdf' | 'model' | null;
  viewBox: ViewBox | null;
  zoom: number;
  searchQuery: string;
  annotationCount: number;
  layerOpacities?: Record<string, number>;
};
