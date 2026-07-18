import { resolveMedia } from "../../iiif/mediaResolver";
import {
  getManifestCanvases,
  type ManifestoCanvas,
  type ManifestoManifest,
} from "./manifestoAdapter";

export const readIiifId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value !== "object") return undefined;
  const record = value as { id?: unknown; "@id"?: unknown };
  const id = record.id ?? record["@id"];
  return typeof id === "string" ? id : undefined;
};

/**
 * Pick a canvas from a manifesto manifest object using the manifesto.js API
 */
export const pickCanvasFromManifest = (
  manifestoObject: ManifestoManifest | undefined,
  canvasId?: string,
  canvasIndex?: number,
): ManifestoCanvas | undefined => {
  if (!manifestoObject) return undefined;

  const canvases = getManifestCanvases(manifestoObject);
  if (!canvases || canvases.length === 0) return undefined;

  if (canvasId) {
    const match = canvases.find((canvas) => canvas.id === canvasId);
    if (match) return match;
  }

  if (typeof canvasIndex === "number" && canvases[canvasIndex]) {
    return canvases[canvasIndex];
  }

  return canvases[0];
};

export const normaliseThumbnailSrc = (src: string): string => {
  if (src.endsWith("info.json")) {
    return src.replace(/info\.json$/, "full/200,/0/default.jpg");
  }
  return src;
};

export const resolveCanvasThumbnail = (
  manifestoObject: ManifestoManifest | undefined,
  canvasId?: string,
  canvasIndex?: number,
): string | null => {
  const canvas = pickCanvasFromManifest(manifestoObject, canvasId, canvasIndex);
  if (!canvas) return null;

  // Use manifesto.js API
  if (typeof canvas.getThumbUri === "function") {
    const thumbUri = canvas.getThumbUri(200);
    if (thumbUri) return thumbUri;
  }

  // Fallback: try to resolve media as thumbnail
  const resolved = resolveMedia(manifestoObject, canvasId, canvasIndex);
  const primary = resolved.primary;
  if (primary?.type === "image") {
    return normaliseThumbnailSrc(primary.src);
  }

  return null;
};
