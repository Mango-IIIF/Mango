import * as manifesto from 'manifesto.js';
import { resolveMedia } from '../../iiif/mediaResolver';

export const readIiifId = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.id || value['@id'];
};

/**
 * Pick a canvas from a manifesto manifest object using the manifesto.js API
 */
export const pickCanvasFromManifest = (
  manifestoObject: any,
  canvasId?: string,
  canvasIndex?: number,
): any | undefined => {
  if (!manifestoObject) return undefined;

  const sequences = manifestoObject.getSequences();
  if (!sequences || sequences.length === 0) return undefined;

  const canvases = sequences[0].getCanvases();
  if (!canvases || canvases.length === 0) return undefined;

  if (canvasId) {
    const match = canvases.find((canvas: any) => canvas.id === canvasId);
    if (match) return match;
  }

  if (typeof canvasIndex === 'number' && canvases[canvasIndex]) {
    return canvases[canvasIndex];
  }

  return canvases[0];
};

export const normaliseThumbnailSrc = (src: string): string => {
  if (src.endsWith('info.json')) {
    return src.replace(/info\.json$/, 'full/200,/0/default.jpg');
  }
  return src;
};

export const resolveCanvasThumbnail = (
  manifestoObject: any,
  canvasId?: string,
  canvasIndex?: number,
): string | null => {
  const canvas = pickCanvasFromManifest(manifestoObject, canvasId, canvasIndex);
  if (!canvas) return null;

  // Use manifesto.js API
  if (typeof canvas.getThumbUri === 'function') {
    const thumbUri = canvas.getThumbUri(200);
    if (thumbUri) return thumbUri;
  }

  // Fallback: try to resolve media as thumbnail
  const resolved = resolveMedia(manifestoObject, canvasId, canvasIndex);
  const primary = resolved.primary;
  if (primary?.type === 'image') {
    return normaliseThumbnailSrc(primary.src);
  }

  return null;
};
