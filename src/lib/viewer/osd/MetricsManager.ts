/**
 * MetricsManager
 * 
 * Manages responsive breakpoints and device metrics
 * Implements Universal Viewer's metric system (sm, md, lg, xl)
 */

export type Metric = 'sm' | 'md' | 'lg' | 'xl';

export interface Breakpoints {
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

/**
 * Default breakpoints matching Universal Viewer
 */
export const DEFAULT_BREAKPOINTS: Breakpoints = {
  sm: 0,      // Mobile
  md: 768,    // Tablet
  lg: 1024,   // Desktop
  xl: 1280,   // Large desktop
};

export interface MetricsConfig {
  breakpoints?: Partial<Breakpoints>;
  onChange?: (metric: Metric) => void;
}

/**
 * Get current metric based on window width
 */
export function getCurrentMetric(
  width: number = window.innerWidth,
  breakpoints: Breakpoints = DEFAULT_BREAKPOINTS,
): Metric {
  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  return 'sm';
}

/**
 * Check if current metric is desktop (lg or xl)
 */
export function isDesktopMetric(metric: Metric): boolean {
  return metric === 'lg' || metric === 'xl';
}

/**
 * Check if current metric is mobile (sm)
 */
export function isMobileMetric(metric: Metric): boolean {
  return metric === 'sm';
}

/**
 * Check if current metric is tablet (md)
 */
export function isTabletMetric(metric: Metric): boolean {
  return metric === 'md';
}

/**
 * MetricsManager class for managing responsive behavior
 */
export class MetricsManager {
  private breakpoints: Breakpoints;
  private currentMetric: Metric;
  private listeners: Array<(metric: Metric) => void> = [];
  private resizeHandler: (() => void) | null = null;

  constructor(config: MetricsConfig = {}) {
    this.breakpoints = { ...DEFAULT_BREAKPOINTS, ...config.breakpoints };
    this.currentMetric = getCurrentMetric(window.innerWidth, this.breakpoints);
    
    if (config.onChange) {
      this.listeners.push(config.onChange);
    }
  }

  /**
   * Start listening for window resize events
   */
  start(): void {
    if (this.resizeHandler) return; // Already started
    
    this.resizeHandler = () => {
      this.checkMetricChange();
    };
    
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', this.resizeHandler);
  }

  /**
   * Stop listening for window resize events
   */
  stop(): void {
    if (!this.resizeHandler) return;
    
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('orientationchange', this.resizeHandler);
    this.resizeHandler = null;
  }

  /**
   * Check if metric has changed and notify listeners
   */
  private checkMetricChange(): void {
    const newMetric = getCurrentMetric(window.innerWidth, this.breakpoints);
    
    if (newMetric !== this.currentMetric) {
      this.currentMetric = newMetric;
      this.notifyListeners();
    }
  }

  /**
   * Notify all listeners of metric change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentMetric);
      } catch (error) {
        console.error('Error in metrics listener:', error);
      }
    });
  }

  /**
   * Add a metric change listener
   */
  addListener(listener: (metric: Metric) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a metric change listener
   */
  removeListener(listener: (metric: Metric) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get current metric
   */
  getMetric(): Metric {
    return this.currentMetric;
  }

  /**
   * Check if current metric is desktop
   */
  isDesktop(): boolean {
    return isDesktopMetric(this.currentMetric);
  }

  /**
   * Check if current metric is mobile
   */
  isMobile(): boolean {
    return isMobileMetric(this.currentMetric);
  }

  /**
   * Check if current metric is tablet
   */
  isTablet(): boolean {
    return isTabletMetric(this.currentMetric);
  }
}
