import type { AVPlayerConfig } from '@mango-iiif/av/core';

export type ViewerConfig = {
  language?: string;
  theme?: 'light' | 'dark' | string;
  allowCreateMode?: boolean;
  showThumbnails?: boolean;
  showCollection?: boolean;
  showMetadata?: boolean;
  showSearch?: boolean;
  showAnnotations?: boolean;
  showTools?: boolean;
  showLayers?: boolean;
  showSettings?: boolean;
  plugins?: Record<string, unknown>;
  sidebar?: {
    enabled?: boolean;
    open?: boolean;
    activePanel?: string;
    position?: 'left' | 'right';
  };
  osd?: {
    preserveViewport?: boolean; // If true, maintains viewport state across canvas changes
    showNavigator?: boolean;
    showRotationControl?: boolean;
    clickToZoomEnabled?: boolean;
  };
  /** Raw OpenSeadragon options. Viewer-managed element and tile sources are ignored. */
  osdConfig?: Record<string, unknown>;
  /** Raw attributes/properties applied to the @google/model-viewer element. */
  modelConfig?: Record<string, unknown>;
  pdf?: {
    page?: number;
  };
  /** Audio/video player, controls, transcript, request, and playback options. */
  av?: AVPlayerConfig;
  initialCanvasIndex?: number;
  initialLayoutMode?: 'single' | 'two-page' | 'continuous' | 'gallery';
  initialRotation?: number;
  initialViewBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  story?: {
    enabled?: boolean;
    showDebug?: boolean;
    languages?: string[];
    save?: {
      endpoint?: string;
      method?: 'POST' | 'PUT';
      headers?: Record<string, string>;
      timeoutMs?: number;
      credentials?: RequestCredentials;
      enabled?: boolean;
    };
  };
};
