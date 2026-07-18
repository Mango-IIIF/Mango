import * as manifesto from "manifesto.js";

export type ManifestoValue = {
  getValue?: () => unknown;
};

export type ManifestoCanvas = {
  id?: string;
  getLabel?: () => ManifestoValue | undefined;
  getWidth?: () => number | undefined;
  getHeight?: () => number | undefined;
  getType?: () => string | undefined;
  getThumbUri?: (width: number) => string | undefined;
};

export type ManifestoSequence = {
  getCanvases?: () => ManifestoCanvas[];
};

/** The only Manifesto surface the viewer is allowed to depend on. */
export type ManifestoManifest = {
  getSequences?: () => ManifestoSequence[];
  getLabel?: () => ManifestoValue | undefined;
  getMetadata?: () => unknown[];
  getDescription?: () => unknown;
  getRequiredStatement?: () => unknown;
  getLicense?: () => unknown;
  getProviders?: () => unknown[];
  getProperty?: (name: string) => unknown;
  getViewingHint?: () => unknown;
  navPlace?: unknown;
};

const isManifestoManifest = (value: unknown): value is ManifestoManifest =>
  typeof value === "object" && value !== null && "getSequences" in value;

export const parseManifest = (json: unknown): ManifestoManifest => {
  const parsed: unknown = manifesto.parseManifest(json);
  if (!isManifestoManifest(parsed)) {
    throw new Error("manifesto.js returned an invalid Manifest");
  }
  return parsed;
};

export const getManifestCanvases = (
  manifest: ManifestoManifest | undefined,
): ManifestoCanvas[] => manifest?.getSequences?.()?.[0]?.getCanvases?.() ?? [];

export const getManifestLabel = (
  manifest: ManifestoManifest | undefined,
): string | undefined => {
  const value = manifest?.getLabel?.()?.getValue?.();
  return typeof value === "string" ? value : undefined;
};
