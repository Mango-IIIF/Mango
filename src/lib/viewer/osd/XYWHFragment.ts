/**
 * XYWHFragment
 * 
 * Represents a rectangular viewport region in image coordinates.
 * Matches Universal Viewer's XYWHFragment behavior for viewport serialization.
 */

export class XYWHFragment {
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}

  /**
   * Serialize to string format: "x,y,w,h"
   */
  toString(): string {
    return [
      Math.floor(this.x),
      Math.floor(this.y),
      Math.floor(this.w),
      Math.floor(this.h),
    ].join(',');
  }

  /**
   * Parse from string format: "xywh=x,y,w,h" or "x,y,w,h"
   */
  static fromString(bounds: string): XYWHFragment {
    const clean = bounds.replace('xywh=', '');
    const [x, y, w, h] = clean.split(',').map(Number);
    return new XYWHFragment(x, y, w, h);
  }
}
