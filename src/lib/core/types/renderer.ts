import type { Component } from "svelte";
import type { ImageFilters } from "./filters";
import type { ModelPose, ModelPoseOptions } from "./model";
import type { ViewBox } from "./viewer";
import type { MediaSource } from "../../iiif/mediaResolver";

export type RendererComponent = Component<Record<string, unknown>>;

export type ActiveLayoutImage = {
  source: MediaSource;
  layers: MediaSource[];
  index: number;
  id: string;
};

export type RendererInstance = {
  getViewBox?: () => ViewBox | null;
  setViewBox?: (box: ViewBox) => void;
  zoomBy?: (factor: number) => void;
  goHome?: () => void;
  rotateBy?: (delta: number) => void;
  start?: () => void;
  play?: () => void;
  pause?: () => void;
  stop?: () => void;
  seekBy?: (delta: number) => void;
  seekTo?: (time: number) => void;
  setMediaSegment?: (start: number, end: number) => void;
  setCameraOrbit?: (orbit: string) => void;
  setCameraTarget?: (target: string) => void;
  setOrientation?: (orientation: string) => void;
  setModelPose?: (pose: ModelPose, options?: ModelPoseOptions) => void;
  getModelPose?: () => ModelPose | null;
  getCameraOrbit?: () => string | null;
  getCameraTarget?: () => string | null;
  getOrientation?: () => string | null;
  setImageFilters?: (filters: ImageFilters) => void;
  setRotation?: (rotation: number) => void;
};

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
