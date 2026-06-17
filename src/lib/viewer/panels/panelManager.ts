/**
 * Panel Manager
 * 
 * Manages visibility state for viewer panels (annotations, tools, search, metadata, thumbnails).
 * Extracted from Viewer.svelte to reduce complexity and improve testability.
 * Part of CODE_REVIEW.md Priority 2.1: Decompose Viewer.svelte
 */

import type { ViewerConfig } from '../../core/types/config';
import type { MediaType } from '../../iiif/mediaResolver';

/**
 * Panel visibility state
 */
export type PanelVisibility = {
  showThumbnails: boolean;
  showMetadata: boolean;
  showSearch: boolean;
  showAnnotations: boolean;
  showTools: boolean;
};

/**
 * Panel permissions based on config
 */
export type PanelPermissions = {
  allowThumbnails: boolean;
  allowMetadata: boolean;
  allowSearch: boolean;
  allowAnnotations: boolean;
  allowTools: boolean;
};

/**
 * Create initial panel visibility state from config
 */
export const createPanelVisibility = (config: ViewerConfig): PanelVisibility => ({
  showThumbnails: config.showThumbnails !== false,
  showMetadata: config.showMetadata !== false,
  showSearch: config.showSearch !== false,
  showAnnotations: config.showAnnotations !== false,
  showTools: config.showTools === true, // Tools default to false
});

/**
 * Create panel permissions from config
 */
export const createPanelPermissions = (config: ViewerConfig): PanelPermissions => ({
  allowThumbnails: config.showThumbnails !== false,
  allowMetadata: config.showMetadata !== false,
  allowSearch: config.showSearch !== false,
  allowAnnotations: config.showAnnotations !== false,
  allowTools: config.showTools !== false,
});

/**
 * Determine if tools panel should be shown
 * Tools are only available for image media types
 */
export const shouldShowTools = (
  showTools: boolean,
  allowTools: boolean,
  mediaType: MediaType | null,
): boolean => {
  const toolsAllowedForMedia = mediaType === 'image';
  return showTools && allowTools && toolsAllowedForMedia;
};

/**
 * Determine if left panel should be visible
 * Left panel is visible if any of its child panels are shown
 */
export const isLeftPanelVisible = (visibility: PanelVisibility, showToolsEffective: boolean): boolean => {
  return (
    visibility.showAnnotations ||
    showToolsEffective ||
    visibility.showSearch ||
    visibility.showMetadata
  );
};

/**
 * Apply config updates to panel visibility
 * Preserves user state unless explicitly overridden by config
 */
export const applyConfigToVisibility = (
  currentVisibility: PanelVisibility,
  config: ViewerConfig,
  hasExplicitToolsConfig: boolean,
): PanelVisibility => {
  const permissions = createPanelPermissions(config);
  
  return {
    showThumbnails: permissions.allowThumbnails ? currentVisibility.showThumbnails : false,
    showMetadata: permissions.allowMetadata ? currentVisibility.showMetadata : false,
    showSearch: permissions.allowSearch ? currentVisibility.showSearch : false,
    showAnnotations: permissions.allowAnnotations ? currentVisibility.showAnnotations : false,
    showTools: hasExplicitToolsConfig 
      ? (config.showTools === true)
      : currentVisibility.showTools,
  };
};
