/**
 * ResizeCoordinator
 * 
 * Manages viewport resize events
 * Implements the resize stabilization patterns from Universal Viewer
 */

export type ResizeHandler = () => void;

export interface ResizeCoordinatorOptions {
  onResize: ResizeHandler;
  orientationChangeDelay?: number; // Default: 100m
  resizePanDelay?: number; // Default: 1ms
}

/**
 * Coordinates window resize and orientation change events
 */
export class ResizeCoordinator {
  private orientationChangeDelay: number;
  private resizePanDelay: number;
  private onResize: ResizeHandler;
  private cleanupHandlers: Array<() => void> = [];

  constructor(options: ResizeCoordinatorOptions) {
    this.onResize = options.onResize;
    this.orientationChangeDelay = options.orientationChangeDelay ?? 100;
    this.resizePanDelay = options.resizePanDelay ?? 1;
  }

  /**
   * Install resize event listeners
   */
  install(): void {
    const handleResize = () => {
      this.onResize();
    };

    const handleOrientationChange = () => {
      setTimeout(() => {
        this.onResize();
      }, this.orientationChangeDelay);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    this.cleanupHandlers.push(() => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    });
  }

  /**
   * Remove all event listeners
   */
  cleanup(): void {
    this.cleanupHandlers.forEach((handler) => handler());
    this.cleanupHandlers = [];
  }

  /**
   * Get the resize pan delay (for viewport correction after resize)
   */
  getResizePanDelay(): number {
    return this.resizePanDelay;
  }
}
