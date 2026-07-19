import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCurrentMetric,
  isDesktopMetric,
  isMobileMetric,
  isTabletMetric,
  MetricsManager,
} from '../MetricsManager';

describe('MetricsManager', () => {
  describe('getCurrentMetric', () => {
    it('should return sm for small widths', () => {
      expect(getCurrentMetric(320)).toBe('sm');
      expect(getCurrentMetric(767)).toBe('sm');
    });

    it('should return md for medium widths', () => {
      expect(getCurrentMetric(768)).toBe('md');
      expect(getCurrentMetric(1023)).toBe('md');
    });

    it('should return lg for large widths', () => {
      expect(getCurrentMetric(1024)).toBe('lg');
      expect(getCurrentMetric(1279)).toBe('lg');
    });

    it('should return xl for extra large widths', () => {
      expect(getCurrentMetric(1280)).toBe('xl');
      expect(getCurrentMetric(1920)).toBe('xl');
    });

    it('should use custom breakpoints', () => {
      const breakpoints = { sm: 0, md: 600, lg: 900, xl: 1200 };
      expect(getCurrentMetric(500, breakpoints)).toBe('sm');
      expect(getCurrentMetric(700, breakpoints)).toBe('md');
      expect(getCurrentMetric(1000, breakpoints)).toBe('lg');
      expect(getCurrentMetric(1300, breakpoints)).toBe('xl');
    });
  });

  describe('metric helpers', () => {
    it('isDesktopMetric should identify desktop metrics', () => {
      expect(isDesktopMetric('sm')).toBe(false);
      expect(isDesktopMetric('md')).toBe(false);
      expect(isDesktopMetric('lg')).toBe(true);
      expect(isDesktopMetric('xl')).toBe(true);
    });

    it('isMobileMetric should identify mobile metric', () => {
      expect(isMobileMetric('sm')).toBe(true);
      expect(isMobileMetric('md')).toBe(false);
      expect(isMobileMetric('lg')).toBe(false);
      expect(isMobileMetric('xl')).toBe(false);
    });

    it('isTabletMetric should identify tablet metric', () => {
      expect(isTabletMetric('sm')).toBe(false);
      expect(isTabletMetric('md')).toBe(true);
      expect(isTabletMetric('lg')).toBe(false);
      expect(isTabletMetric('xl')).toBe(false);
    });
  });

  describe('MetricsManager class', () => {
    let manager: MetricsManager;

    beforeEach(() => {
      manager = new MetricsManager();
    });

    afterEach(() => {
      manager.stop();
    });

    it('should initialize with current metric', () => {
      const metric = manager.getMetric();
      expect(['sm', 'md', 'lg', 'xl']).toContain(metric);
    });

    it('should provide desktop check', () => {
      const isDesktop = manager.isDesktop();
      const metric = manager.getMetric();
      expect(isDesktop).toBe(metric === 'lg' || metric === 'xl');
    });

    it('should provide mobile check', () => {
      const isMobile = manager.isMobile();
      const metric = manager.getMetric();
      expect(isMobile).toBe(metric === 'sm');
    });

    it('should provide tablet check', () => {
      const isTablet = manager.isTablet();
      const metric = manager.getMetric();
      expect(isTablet).toBe(metric === 'md');
    });

    it('should add and remove listeners', () => {
      const listener = vi.fn();
      manager.addListener(listener);
      manager.removeListener(listener);
      expect(true).toBe(true); // If no error, test passes
    });

    it('should start and stop listening', () => {
      manager.start();
      manager.stop();
      expect(true).toBe(true); // If no error, test passes
    });

    it('should not error on double start/stop', () => {
      manager.start();
      manager.start();
      manager.stop();
      manager.stop();
      expect(true).toBe(true);
    });
  });
});
