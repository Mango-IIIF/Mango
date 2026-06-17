/**
 * IIIF Search Service utilities
 *
 * Handles IIIF Content Search API v0.9 and v1.0
 * @see https://iiif.io/api/search/0.9/
 * @see https://iiif.io/api/search/1.0/
 */

import type { ResolvedAnnotation } from '../../iiif/annotationResolver';

const SEARCH_PROFILE_V0 = 'http://iiif.io/api/search/0/search';
const SEARCH_PROFILE_V1 = 'http://iiif.io/api/search/1/search';

const normaliseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const hasSearchProfile = (profile: unknown): boolean => {
  if (!profile) return false;
  if (typeof profile === 'string') {
    return profile === SEARCH_PROFILE_V0 || profile === SEARCH_PROFILE_V1;
  }
  if (Array.isArray(profile)) {
    return profile.some((entry) => hasSearchProfile(entry));
  }
  if (typeof profile === 'object') {
    const value = (profile as { id?: string; '@id'?: string }).id ?? (profile as { '@id'?: string })['@id'];
    return value === SEARCH_PROFILE_V0 || value === SEARCH_PROFILE_V1;
  }
  return false;
};

/**
 * Extract the search service URL from a IIIF manifest
 */
export const getSearchServiceUrl = (manifestJson: any): string | null => {
  if (!manifestJson || typeof manifestJson !== 'object') return null;
  
  // Try to get services from manifesto object first
  let services;
  if (typeof manifestJson.getProperty === 'function') {
    services = normaliseArray(
      manifestJson.getProperty('service') ?? manifestJson.getProperty('services'),
    );
  } else {
    services = normaliseArray(
      manifestJson.service ?? manifestJson.services,
    );
  }
  
  // Find the search service
  const searchService = services.find((service) => {
    if (!service || typeof service !== 'object') return false;
    const profile = service.profile ?? service['@profile'];
    return hasSearchProfile(profile);
  });
  
  if (!searchService) return null;
  
  // Extract the service URL (supports both @id and id)
  return searchService['@id'] ?? searchService.id ?? null;
};

/**
 * IIIF Search API response structure
 */
interface IIIFSearchHit {
  '@type'?: string;
  annotations?: string[];
  match?: string;
  before?: string;
  after?: string;
}

interface IIIFSearchResponse {
  '@context'?: string;
  '@id'?: string;
  '@type'?: string;
  within?: {
    '@type'?: string;
    total?: number;
  };
  hits?: IIIFSearchHit[];
  resources?: any[];
}

/**
 * Parse canvas ID from an annotation target
 */
const parseCanvasId = (target: string): string | null => {
  if (!target) return null;
  
  // Handle fragment selector (e.g., "canvas#xywh=...")
  const fragmentIndex = target.indexOf('#');
  if (fragmentIndex !== -1) {
    return target.substring(0, fragmentIndex);
  }
  
  return target;
};

/**
 * Search result with canvas information for navigation
 */
export type SearchResult = ResolvedAnnotation & {
  canvasId?: string;
};

/**
 * Query the IIIF Search API
 */
export const searchIIIF = async (
  serviceUrl: string,
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<SearchResult[]> => {
  if (!serviceUrl || !query) return [];
  
  try {
    // Build search URL with query parameter
    const searchUrl = new URL(serviceUrl);
    searchUrl.searchParams.set('q', query);
    
    const response = await fetcher(searchUrl.toString());
    if (!response.ok) {
      console.warn('[Mango IIIF Search] Search request failed:', response.status);
      return [];
    }
    
    const data: IIIFSearchResponse = await response.json();
    
    // Parse search results into SearchResult format with canvas info
    const results: SearchResult[] = [];
    
    // Handle the resources array (contains annotation objects)
    if (data.resources && Array.isArray(data.resources)) {
      for (const resource of data.resources) {
        const result = parseAnnotation(resource);
        if (result) {
          // Include canvas info with the annotation for navigation
          results.push({
            ...result.annotation,
            canvasId: result.canvasId,
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    console.warn('[Mango IIIF Search] Search failed:', error);
    return [];
  }
};

/**
 * Parse a search result annotation into ResolvedAnnotation format
 */
const parseAnnotation = (resource: any): { annotation: ResolvedAnnotation; canvasId: string } | null => {
  if (!resource || typeof resource !== 'object') return null;
  
  const id = resource['@id'] ?? resource.id;
  if (!id) return null;
  
  // Extract text content
  let text = '';
  if (resource.resource) {
    if (typeof resource.resource === 'string') {
      text = resource.resource;
    } else if (resource.resource.chars) {
      text = resource.resource.chars;
    } else if (resource.resource['@value']) {
      text = resource.resource['@value'];
    }
  } else if (resource.body) {
    if (typeof resource.body === 'string') {
      text = resource.body;
    } else if (resource.body.value) {
      text = resource.body.value;
    }
  }
  
  // Extract target (canvas ID and position)
  const target = resource.on ?? resource.target;
  if (!target) return null;
  
  const canvasId = parseCanvasId(typeof target === 'string' ? target : target.source ?? target['@id'] ?? target.id);
  if (!canvasId) return null;
  
  // Extract rectangle if available (xywh fragment selector)
  let rect = undefined;
  const targetStr = typeof target === 'string' ? target : target.selector?.value ?? target['@id'] ?? target.id ?? '';
  const xywh = extractXYWH(targetStr);
  if (xywh) {
    rect = {
      x: xywh.x,
      y: xywh.y,
      w: xywh.w,
      h: xywh.h,
    };
  }
  
  return {
    annotation: {
      id,
      text,
      rect,
      time: undefined,
      // Motivation determines if it's a comment, tag, etc.
      // Search results are typically comments or transcriptions
    },
    canvasId,
  };
};

/**
 * Extract xywh coordinates from a fragment selector
 */
const extractXYWH = (selector: string): { x: number; y: number; w: number; h: number } | null => {
  if (!selector) return null;
  
  const match = selector.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
  if (!match) return null;
  
  return {
    x: parseInt(match[1], 10),
    y: parseInt(match[2], 10),
    w: parseInt(match[3], 10),
    h: parseInt(match[4], 10),
  };
};
