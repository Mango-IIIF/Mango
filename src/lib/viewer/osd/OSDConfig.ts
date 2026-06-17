/**
 * OSDConfig
 */

export interface OSDViewerConfig {
  // UI Controls
  showNavigationControl: boolean;
  showNavigator: boolean;
  showRotationControl: boolean;
  showHomeControl: boolean;
  showFullPageControl: boolean;
  showSequenceControl: boolean;
  showZoomControl: boolean;
  
  // Animation and Timing
  animationTime: number;
  blendTime: number;
  controlsFadeDelay: number;
  controlsFadeLength: number;
  
  // Zoom and Constraints
  defaultZoomLevel: number;
  maxZoomPixelRatio: number;
  visibilityRatio: number;
  constrainDuringPan: boolean;
  immediateRender: boolean;
  
  // Navigator
  navigatorPosition: string;
  navigatorHeight: string;
  navigatorWidth: string;
  
  // Layout
  pageGap: number;
  
  // Gestures
  clickToZoomEnabled: boolean;
  
  // Reduced Motion
  reducedAnimation: boolean;
}

/**
 * Default OSD configuration matching Universal Viewer
 */
export const DEFAULT_OSD_CONFIG: OSDViewerConfig = {
  // Controls
  showNavigationControl: true,
  showNavigator: true,
  showRotationControl: true,
  showHomeControl: false,
  showFullPageControl: false,
  showSequenceControl: false,
  showZoomControl: true,
  
  // animation time
  animationTime: 0.15,
  blendTime: 0,
  controlsFadeDelay: 250,
  controlsFadeLength: 250,
  
  // Zoom
  defaultZoomLevel: 0,
  maxZoomPixelRatio: 1.25,
  visibilityRatio: 0.5,
  constrainDuringPan: false,
  immediateRender: false,
  
  // Navigator
  navigatorPosition: 'BOTTOM_RIGHT',
  navigatorHeight: '100px',
  navigatorWidth: '100px',
  
  // Layout
  pageGap: 50,
  
  // Gestures
  clickToZoomEnabled: true,
  
  // Accessibility
  reducedAnimation: false,
};

/**
 * Get control fade length based on reduced animation setting
 */
export function getControlsFadeLength(config: OSDViewerConfig): number {
  return config.reducedAnimation ? 0 : config.controlsFadeLength;
}
