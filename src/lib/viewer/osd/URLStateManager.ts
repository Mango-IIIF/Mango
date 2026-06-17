/**
 * URLStateManager
 * 
 * Manages URL parameters for viewer state synchronization
 * Handles parsing and syncing of:
 * - xywh: viewport bounds (x,y,w,h)
 * - r or rotation: rotation angle
 * - cv or canvasIndex: canvas index
 * - target: full target string (canvas#xywh=x,y,w,h)
 * - iiif-content: IIIF content-state token
 */

import { XYWHFragment } from './XYWHFragment';

export interface URLStateParams {
  manifestId?: string;
  canvasId?: string;
  canvasIndex?: number;
  xywh?: string;
  rotation?: number;
  target?: string;
  iiifContent?: string;
}

export interface ContentStateTarget {
  canvasId: string;
  xywh?: string;
}

/**
 * Parse URL hash parameters
 */
export function parseURLHash(hash: string = window.location.hash): URLStateParams {
  const params: URLStateParams = {};
  
  if (!hash || hash.length <= 1) return params;
  
  // Remove leading '#' or '?'
  const cleanHash = hash.replace(/^[#?]/, '');
  const searchParams = new URLSearchParams(cleanHash);
  
  // Parse manifest
  if (searchParams.has('manifest') || searchParams.has('iiifManifestId')) {
    params.manifestId = searchParams.get('manifest') || searchParams.get('iiifManifestId') || undefined;
  }
  
  // Parse canvas index
  if (searchParams.has('cv')) {
    const cv = parseInt(searchParams.get('cv') || '', 10);
    if (!isNaN(cv)) params.canvasIndex = cv;
  }
  
  // Parse xywh
  if (searchParams.has('xywh')) {
    params.xywh = searchParams.get('xywh') || undefined;
  }
  
  // Parse rotation (support both 'r' and 'rotation')
  if (searchParams.has('r')) {
    const r = parseInt(searchParams.get('r') || '', 10);
    if (!isNaN(r)) params.rotation = r;
  } else if (searchParams.has('rotation')) {
    const r = parseInt(searchParams.get('rotation') || '', 10);
    if (!isNaN(r)) params.rotation = r;
  }
  
  // Parse target
  if (searchParams.has('target')) {
    params.target = searchParams.get('target') || undefined;
  }
  
  // Parse IIIF content-state
  if (searchParams.has('iiif-content')) {
    params.iiifContent = searchParams.get('iiif-content') || undefined;
  }
  
  return params;
}

/**
 * Parse target string (canvas#xywh=x,y,w,h)
 */
export function parseTarget(target: string): ContentStateTarget | null {
  if (!target) return null;
  
  const parts = target.split('#');
  if (parts.length < 1) return null;
  
  const result: ContentStateTarget = {
    canvasId: parts[0],
  };
  
  if (parts.length > 1 && parts[1]) {
    const selector = parts[1];
    if (selector.startsWith('xywh=')) {
      result.xywh = selector.substring(5); // Remove 'xywh=' prefix
    } else if (selector.includes(',')) {
      // Also support bare x,y,w,h format
      result.xywh = selector;
    }
  }
  
  return result;
}

/**
 * Parse IIIF content-state token
 * Decodes base64url and extracts canvas + selector
 */
export function parseContentState(token: string): ContentStateTarget | null {
  try {
    // Decode base64url
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    const contentState = JSON.parse(decoded);
    
    // Extract first target
    if (contentState.target) {
      let targetObj = contentState.target;
      
      // Handle string targets
      if (typeof targetObj === 'string') {
        return parseTarget(targetObj);
      }
      
      // Handle object targets (IIIF Presentation API 3.0 SpecificResource)
      if (targetObj.source?.id) {
        const result: ContentStateTarget = {
          canvasId: targetObj.source.id,
        };
        
        // Extract xywh from BoxSelector
        if (targetObj.selector?.type === 'BoxSelector') {
          const spatial = targetObj.selector.spatial;
          if (spatial) {
            result.xywh = `${spatial.x},${spatial.y},${spatial.width},${spatial.height}`;
          }
        }
        // Also check for FragmentSelector with xywh
        else if (targetObj.selector?.type === 'FragmentSelector') {
          const value = targetObj.selector.value;
          if (value?.startsWith('xywh=')) {
            result.xywh = value.substring(5);
          }
        }
        
        return result;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to parse content-state token:', error);
    return null;
  }
}

/**
 * Serialize viewport state to URL parameters
 */
export function serializeURLState(params: URLStateParams): string {
  const searchParams = new URLSearchParams();
  
  if (params.manifestId) {
    searchParams.set('manifest', params.manifestId);
  }
  
  if (params.canvasIndex !== undefined) {
    searchParams.set('cv', params.canvasIndex.toString());
  }
  
  if (params.xywh) {
    searchParams.set('xywh', params.xywh);
  }
  
  if (params.rotation !== undefined && params.rotation !== 0) {
    searchParams.set('r', params.rotation.toString());
  }
  
  if (params.target) {
    searchParams.set('target', params.target);
  }
  
  const result = searchParams.toString();
  return result ? `#${result}` : '';
}

/**
 * Update URL hash without triggering navigation
 */
export function updateURLHash(params: URLStateParams, replace: boolean = true): void {
  const hash = serializeURLState(params);
  const newUrl = hash || window.location.pathname + window.location.search;
  
  if (replace) {
    window.history.replaceState(null, '', newUrl);
  } else {
    window.history.pushState(null, '', newUrl);
  }
}

/**
 * Create target string from canvas ID and xywh
 */
export function createTarget(canvasId: string, xywh: XYWHFragment | string): string {
  const xywhStr = typeof xywh === 'string' ? xywh : xywh.toString();
  return `${canvasId}#xywh=${xywhStr}`;
}
