/**
 * Renderer Capabilities
 * 
 * Defines what features each renderer supports, making capabilities explicit
 * rather than implicit. This helps UI components know which controls to show
 * and helps developers understand renderer limitations.
 */

export type RendererCapabilities = {
  /**
   * Whether the renderer supports zoom functionality
   */
  supportsZoom: boolean;
  
  /**
   * Whether the renderer supports image filters (brightness, contrast, etc.)
   */
  supportsFilters: boolean;
  
  /**
   * Whether the renderer supports panning/dragging the view
   */
  supportsPan: boolean;
  
  /**
   * Whether the renderer supports viewBox (region of interest) selection
   */
  supportsViewBox: boolean;
  
  /**
   * Whether the renderer supports rotation
   */
  supportsRotation: boolean;
  
  /**
   * Whether the renderer is interactive (clickable, hoverable)
   */
  isInteractive: boolean;
};

/**
 * Default capabilities - all features disabled
 */
export const DEFAULT_RENDERER_CAPABILITIES: RendererCapabilities = {
  supportsZoom: false,
  supportsFilters: false,
  supportsPan: false,
  supportsViewBox: false,
  supportsRotation: false,
  isInteractive: false,
};
