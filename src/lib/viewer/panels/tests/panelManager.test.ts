import { describe, it, expect } from 'vitest';
import {
  createPanelVisibility,
  createPanelPermissions,
  shouldShowTools,
  isLeftPanelVisible,
  applyConfigToVisibility,
  type PanelVisibility,
} from '../panelManager';
import type { ViewerConfig } from '../../../core/types/config';

describe('Panel Manager', () => {
  describe('createPanelVisibility', () => {
    it('should create visibility with all panels visible by default', () => {
      const config: ViewerConfig = {};
      const visibility = createPanelVisibility(config);
      
      expect(visibility.showThumbnails).toBe(true);
      expect(visibility.showMetadata).toBe(true);
      expect(visibility.showSearch).toBe(true);
      expect(visibility.showAnnotations).toBe(true);
      expect(visibility.showTools).toBe(false); // Tools default to false
    });

    it('should respect config settings', () => {
      const config: ViewerConfig = {
        showThumbnails: false,
        showMetadata: false,
        showTools: true,
      };
      const visibility = createPanelVisibility(config);
      
      expect(visibility.showThumbnails).toBe(false);
      expect(visibility.showMetadata).toBe(false);
      expect(visibility.showSearch).toBe(true); // Not specified, defaults to true
      expect(visibility.showTools).toBe(true);
    });
  });

  describe('createPanelPermissions', () => {
    it('should create permissions with all panels allowed by default', () => {
      const config: ViewerConfig = {};
      const permissions = createPanelPermissions(config);
      
      expect(permissions.allowThumbnails).toBe(true);
      expect(permissions.allowMetadata).toBe(true);
      expect(permissions.allowSearch).toBe(true);
      expect(permissions.allowAnnotations).toBe(true);
      expect(permissions.allowTools).toBe(true);
    });

    it('should respect config restrictions', () => {
      const config: ViewerConfig = {
        showTools: false,
        showSearch: false,
      };
      const permissions = createPanelPermissions(config);
      
      expect(permissions.allowTools).toBe(false);
      expect(permissions.allowSearch).toBe(false);
      expect(permissions.allowAnnotations).toBe(true);
    });
  });

  describe('shouldShowTools', () => {
    it('should return true only for image media with tools enabled', () => {
      expect(shouldShowTools(true, true, 'image')).toBe(true);
    });

    it('should return false when showTools is false', () => {
      expect(shouldShowTools(false, true, 'image')).toBe(false);
    });

    it('should return false when allowTools is false', () => {
      expect(shouldShowTools(true, false, 'image')).toBe(false);
    });

    it('should return false for non-image media types', () => {
      expect(shouldShowTools(true, true, 'video')).toBe(false);
      expect(shouldShowTools(true, true, 'audio')).toBe(false);
      expect(shouldShowTools(true, true, null)).toBe(false);
    });
  });

  describe('isLeftPanelVisible', () => {
    it('should return true when any panel is shown', () => {
      const visibility: PanelVisibility = {
        showThumbnails: false,
        showMetadata: false,
        showSearch: true, // One panel visible
        showAnnotations: false,
        showTools: false,
      };
      
      expect(isLeftPanelVisible(visibility, false)).toBe(true);
    });

    it('should return true when tools are effective', () => {
      const visibility: PanelVisibility = {
        showThumbnails: false,
        showMetadata: false,
        showSearch: false,
        showAnnotations: false,
        showTools: false,
      };
      
      expect(isLeftPanelVisible(visibility, true)).toBe(true);
    });

    it('should return false when no panels are shown', () => {
      const visibility: PanelVisibility = {
        showThumbnails: false,
        showMetadata: false,
        showSearch: false,
        showAnnotations: false,
        showTools: false,
      };
      
      expect(isLeftPanelVisible(visibility, false)).toBe(false);
    });
  });

  describe('applyConfigToVisibility', () => {
    it('should preserve visibility when permissions allow', () => {
      const current: PanelVisibility = {
        showThumbnails: true,
        showMetadata: false,
        showSearch: true,
        showAnnotations: true,
        showTools: false,
      };
      const config: ViewerConfig = {}; // All allowed
      
      const result = applyConfigToVisibility(current, config, false);
      
      expect(result).toEqual(current);
    });

    it('should hide panels when permissions disallow', () => {
      const current: PanelVisibility = {
        showThumbnails: true,
        showMetadata: true,
        showSearch: true,
        showAnnotations: true,
        showTools: false,
      };
      const config: ViewerConfig = {
        showMetadata: false,
        showSearch: false,
      };
      
      const result = applyConfigToVisibility(current, config, false);
      
      expect(result.showThumbnails).toBe(true);
      expect(result.showMetadata).toBe(false); // Hidden by config
      expect(result.showSearch).toBe(false); // Hidden by config
      expect(result.showAnnotations).toBe(true);
    });

    it('should apply explicit tools config when hasExplicitToolsConfig is true', () => {
      const current: PanelVisibility = {
        showThumbnails: true,
        showMetadata: true,
        showSearch: true,
        showAnnotations: true,
        showTools: false,
      };
      const config: ViewerConfig = {
        showTools: true,
      };
      
      const result = applyConfigToVisibility(current, config, true);
      
      expect(result.showTools).toBe(true);
    });
  });
});
