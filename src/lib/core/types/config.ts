export type ViewerConfig = {
  language?: string;
  theme?: 'light' | 'dark' | string;
  allowCreateMode?: boolean;
  showThumbnails?: boolean;
  showMetadata?: boolean;
  showSearch?: boolean;
  showAnnotations?: boolean;
  showTools?: boolean;
  showLayers?: boolean;
  plugins?: Record<string, unknown>;
  osd?: {
    preserveViewport?: boolean; // If true, maintains viewport state across canvas changes
    showNavigator?: boolean;
    showRotationControl?: boolean;
    clickToZoomEnabled?: boolean;
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
