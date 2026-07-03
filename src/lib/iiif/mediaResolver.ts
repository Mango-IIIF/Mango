import * as manifesto from 'manifesto.js';
import type { IIIFIdentifiable } from '../core/types/iiif';

export type MediaType = 'image' | 'video' | 'audio' | 'pdf' | 'model';

export type MediaSource = {
  type: MediaType;
  id: string;
  src: string;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  poster?: string;
  label?: string;
};

export type ResolvedMedia = {
  primary: MediaSource | null;
  alternates: MediaSource[];
};

export type TileSource = string | { type: 'image'; url: string };

/**
 * Extracts the id from an IIIF identifiable value
 */
const readId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if ('id' in value && typeof value.id === 'string') return value.id;
    if ('@id' in value && typeof value['@id'] === 'string') return value['@id'];
  }
  return undefined;
};

const normaliseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * Pick a canvas from a manifesto manifest object using the manifesto.js API
 */
const pickCanvas = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): unknown | undefined => {
  if (!manifestoObject || typeof manifestoObject !== 'object') return undefined;

  // Type assertion for manifesto.js object
  const manifest = manifestoObject as {
    getSequences: () => Array<{ getCanvases: () => unknown[] }>;
  };

  const sequences = manifest.getSequences();
  if (!sequences || sequences.length === 0) return undefined;
  
  const canvases = sequences[0].getCanvases();
  if (!canvases || canvases.length === 0) return undefined;

  if (canvasId) {
    const match = canvases.find((canvas: unknown) => {
      const c = canvas as { id?: string };
      return c.id === canvasId;
    });
    if (match) return match;
  }

  if (typeof canvasIndex === 'number' && canvases[canvasIndex]) {
    return canvases[canvasIndex];
  }

  return canvases[0];
};

/**
 * Extracts media bodies from a canvas object
 */
const extractCanvasBodies = (canvas: unknown): unknown[] => {
  const bodies: unknown[] = [];
  if (!canvas || typeof canvas !== 'object') return bodies;

  const canvasObj = canvas as {
    getImages?: () => unknown[];
    getContent?: () => unknown[];
  };

  // Use manifesto.js API for v2 images
  if (typeof canvasObj.getImages === 'function') {
    const images = canvasObj.getImages();
    for (const image of images) {
      const imageObj = image as {
        getBody?: () => unknown | unknown[];
        getResource?: () => unknown;
      };
      // For v3, getBody() returns the bodies
      if (typeof imageObj.getBody === 'function') {
        const imageBodies = imageObj.getBody();
        if (Array.isArray(imageBodies) && imageBodies.length > 0) {
          bodies.push(...normaliseArray(imageBodies));
        }
      }
      
      // For v2, getResource() returns the resource (body equivalent)
      // getBody() returns empty array for v2 manifests
      if (typeof imageObj.getResource === 'function') {
        const resource = imageObj.getResource();
        if (resource) {
          bodies.push(resource);
        }
      }
    }
  }

  // Use manifesto.js API for v3 content (painting annotations)
  if (typeof canvasObj.getContent === 'function') {
    const content = canvasObj.getContent();
    for (const annotation of content) {
      const annotationObj = annotation as {
        getBody?: () => unknown | unknown[];
      };
      if (typeof annotationObj.getBody === 'function') {
        const annoBodies = annotationObj.getBody();
        if (annoBodies) {
          bodies.push(...normaliseArray(annoBodies));
        }
      }
    }
  }

  const plainCanvas = canvas as {
    items?: Array<{
      items?: Array<{
        body?: unknown | unknown[];
        resource?: unknown;
      }>;
    }>;
    images?: Array<{
      body?: unknown | unknown[];
      resource?: unknown;
    }>;
  };

  for (const annotation of normaliseArray(plainCanvas.images)) {
    if (annotation.body) bodies.push(...normaliseArray(annotation.body));
    if (annotation.resource) bodies.push(annotation.resource);
  }

  for (const page of normaliseArray(plainCanvas.items)) {
    for (const annotation of normaliseArray(page?.items)) {
      if (annotation.body) bodies.push(...normaliseArray(annotation.body));
      if (annotation.resource) bodies.push(annotation.resource);
    }
  }

  // Handle renderings using getProperty
  const canvasWithProp = canvasObj as { getProperty?: (prop: string) => unknown };
  if (typeof canvasWithProp.getProperty === 'function') {
    const renderings = canvasWithProp.getProperty('rendering');
    if (renderings) {
      bodies.push(...normaliseArray(renderings));
    }
  }

  return bodies;
};

/**
 * Extracts IIIF image service ID from a body
 */
const extractServiceId = (body: unknown): string | undefined => {
  if (!body || typeof body !== 'object') return undefined;
  
  const bodyObj = body as {
    getProperty?: (prop: string) => unknown;
    service?: unknown;
  };
  
  // If it's a manifesto AnnotationBody, use getProperty
  if (typeof bodyObj.getProperty === 'function') {
    const service = bodyObj.getProperty('service');
    if (service) {
      const services = normaliseArray(service);
      if (services.length > 0) {
        return readId(services[0] as IIIFIdentifiable);
      }
    }
  }
  // Fallback for plain objects
  const services = normaliseArray(bodyObj?.service);
  if (services.length === 0) return undefined;
  return readId(services[0] as IIIFIdentifiable);
};

const ensureInfoJson = (serviceId: string): string => {
  if (serviceId.endsWith('info.json')) return serviceId;
  return `${serviceId.replace(/\/$/, '')}/info.json`;
};

/**
 * Guesses media type from body type and format properties
 */
const guessMediaType = (body: unknown): MediaType | null => {
  if (!body || typeof body !== 'object') return null;
  
  const bodyObj = body as {
    getType?: () => string;
    getFormat?: () => string;
    type?: string;
    '@type'?: string;
    format?: string;
  };
  
  // Get type and format from manifesto object if available
  const type = typeof bodyObj.getType === 'function' 
    ? bodyObj.getType() 
    : (bodyObj?.type || bodyObj?.['@type']);
  const format = typeof bodyObj.getFormat === 'function'
    ? bodyObj.getFormat()
    : bodyObj?.format;
  const id = readId(body as IIIFIdentifiable) ?? '';
  const lowerId = id.toLowerCase();

  if (typeof type === 'string') {
    const lower = type.toLowerCase();
    if (lower.includes('sound')) return 'audio';
    if (lower.includes('model') || lower.includes('3d')) return 'model';
    if (lower.includes('image')) return 'image';
    if (lower.includes('video')) return 'video';
    if (lower.includes('audio')) return 'audio';
    if (lower.includes('document') || lower.includes('pdf')) return 'pdf';
  }

  if (format) {
    if (format.startsWith('image/')) return 'image';
    if (format.startsWith('video/')) return 'video';
    if (format.startsWith('audio/')) return 'audio';
    if (format === 'application/pdf') return 'pdf';
    if (format.startsWith('model/')) return 'model';
  }

  if (lowerId.endsWith('.pdf')) return 'pdf';
  if (lowerId.endsWith('.mp4') || lowerId.endsWith('.webm')) return 'video';
  if (lowerId.endsWith('.mp3') || lowerId.endsWith('.wav')) return 'audio';
  if (lowerId.endsWith('.glb') || lowerId.endsWith('.gltf') || lowerId.endsWith('.obj')) {
    return 'model';
  }
  if (
    lowerId.endsWith('.jpg') ||
    lowerId.endsWith('.jpeg') ||
    lowerId.endsWith('.png')
  ) {
    return 'image';
  }

  return null;
};

/**
 * Converts an IIIF body to a MediaSource
 */
const toMediaSource = (body: unknown, canvas: unknown): MediaSource | null => {
  const type = guessMediaType(body);
  if (!type) return null;

  const canvasId = typeof canvas === 'object' && canvas !== null
    ? (canvas as { id?: string }).id || readId(canvas as IIIFIdentifiable)
    : undefined;
  const id = readId(body as IIIFIdentifiable) || canvasId || `media-${Math.random()}`;
  
  const bodyObj = body as {
    getFormat?: () => string;
    format?: string;
    getWidth?: () => number;
    getHeight?: () => number;
    width?: number;
    height?: number;
    getProperty?: (prop: string) => unknown;
    duration?: number;
    label?: unknown;
  };
  
  const canvasObj = canvas as {
    getWidth?: () => number;
    getHeight?: () => number;
    getProperty?: (prop: string) => unknown;
    getDuration?: () => number;
    duration?: number;
  };
  
  // Get format using manifesto API if available
  const format = typeof bodyObj.getFormat === 'function' 
    ? bodyObj.getFormat() 
    : bodyObj?.format;
  
  // Get dimensions from canvas using manifesto API
  const canvasWidth = typeof canvasObj?.getWidth === 'function' ? canvasObj.getWidth() : undefined;
  const canvasHeight = typeof canvasObj?.getHeight === 'function' ? canvasObj.getHeight() : undefined;
  
  // Get dimensions from body using manifesto API if available
  const bodyWidth = typeof bodyObj.getWidth === 'function' ? bodyObj.getWidth() : bodyObj?.width;
  const bodyHeight = typeof bodyObj.getHeight === 'function' ? bodyObj.getHeight() : bodyObj?.height;
  
  const width = bodyWidth ?? canvasWidth;
  const height = bodyHeight ?? canvasHeight;
  
  // Get duration from body or canvas
  let duration = typeof bodyObj.getProperty === 'function' 
    ? bodyObj.getProperty('duration') 
    : bodyObj?.duration;
  if (!duration && typeof canvasObj.getDuration === 'function') {
    try {
      duration = canvasObj.getDuration();
    } catch (error) {
      // getDuration may not be supported, use undefined
    }
  }
  
  // Get label - for manifesto objects, there might be getLabel method
  const labelData = typeof bodyObj.getProperty === 'function'
    ? bodyObj.getProperty('label')
    : bodyObj?.label;
  const label = typeof labelData === 'object' && labelData !== null
    ? ((labelData as Record<string, string[]>).en?.[0] ?? String(labelData))
    : typeof labelData === 'string' ? labelData : undefined;
    
  // Get poster/thumbnail
  const posterData = typeof bodyObj.getProperty === 'function'
    ? (bodyObj.getProperty('poster') || bodyObj.getProperty('thumbnail'))
    : ((body as Record<string, unknown>)?.poster || (body as Record<string, unknown>)?.thumbnail);
  const poster = typeof posterData === 'string' 
    ? posterData 
    : Array.isArray(posterData) && posterData.length > 0
      ? (posterData[0] as { id?: string }).id
      : undefined;

  if (type === 'image') {
    const serviceId = extractServiceId(body);
    if (serviceId) {
      return {
        type,
        id,
        src: ensureInfoJson(serviceId),
        format,
        width,
        height,
        label,
      };
    }
  }

  const src = readId(body);
  if (!src) return null;

  return {
    type,
    id,
    src,
    format,
    width,
    height,
    duration: typeof duration === 'number' ? duration : undefined,
    poster,
    label,
  };
};

/**
 * Resolves media sources from a canvas object
 */
export const resolveMediaFromCanvas = (canvas: unknown): ResolvedMedia => {
  if (!canvas) return { primary: null, alternates: [] };

  const sources: MediaSource[] = [];
  for (const body of extractCanvasBodies(canvas)) {
    const source = toMediaSource(body, canvas);
    if (source) sources.push(source);
  }

  const primary = sources[0] ?? null;
  const alternates = sources.slice(1);
  return { primary, alternates };
};

/**
 * Resolves media from a manifesto manifest object for a specific canvas
 */
export const resolveMedia = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): ResolvedMedia => {
  const canvas = pickCanvas(manifestoObject, canvasId, canvasIndex);
  return resolveMediaFromCanvas(canvas);
};

/**
 * Resolves an image tile source (IIIF Image API) from a manifest
 */
export const resolveImageTileSource = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): TileSource | null => {
  const resolved = resolveMedia(manifestoObject, canvasId, canvasIndex);
  if (!resolved.primary || resolved.primary.type !== 'image') return null;

  const src = resolved.primary.src;
  if (src.endsWith('info.json')) return src;
  return { type: 'image', url: src };
};
