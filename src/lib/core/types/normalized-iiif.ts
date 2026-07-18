import type { ManifestoManifest } from "../../viewer/iiif/manifestoAdapter";
import { getManifestCanvases } from "../../viewer/iiif/manifestoAdapter";

export type NormalizedService = {
  id: string;
  type?: string;
  profile?: string | string[];
};

export type NormalizedSelector = {
  type: string;
  value?: string;
  source?: string;
};

export type NormalizedContentResource = {
  id: string;
  type?: string;
  format?: string;
  label?: string;
  services: NormalizedService[];
};

export type NormalizedAnnotation = {
  id: string;
  motivation?: string | string[];
  bodies: NormalizedContentResource[];
  target?: string;
  selectors: NormalizedSelector[];
};

export type NormalizedCanvas = {
  id: string;
  index: number;
  label?: string;
  width?: number;
  height?: number;
  type?: string;
  annotations: NormalizedAnnotation[];
};

export type NormalizedRange = {
  id: string;
  label?: string;
  items: Array<string | NormalizedRange>;
};

export type NormalizedManifest = {
  id: string;
  type: "Manifest";
  label?: string;
  canvases: NormalizedCanvas[];
  ranges: NormalizedRange[];
  services: NormalizedService[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const asArray = (value: unknown): unknown[] =>
  value === undefined || value === null
    ? []
    : Array.isArray(value)
      ? value
      : [value];

const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const readId = (value: unknown): string => {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return readString(record?.id) ?? readString(record?.["@id"]) ?? "";
};

const readLabel = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return readLabel(value[0]);
  const record = asRecord(value);
  if (!record) return undefined;
  if ("value" in record) return readLabel(record.value);
  return readLabel(record.en ?? record.none ?? Object.values(record)[0]);
};

const normalizeServices = (value: unknown): NormalizedService[] =>
  asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const id = readId(entry);
    if (!record || !id) return [];
    const profiles = asArray(record.profile ?? record["@profile"])
      .map(readString)
      .filter((profile): profile is string => Boolean(profile));
    return [
      {
        id,
        ...(readString(record.type ?? record["@type"])
          ? {
              type: readString(record.type ?? record["@type"]),
            }
          : {}),
        ...(profiles.length === 1 ? { profile: profiles[0] } : {}),
        ...(profiles.length > 1 ? { profile: profiles } : {}),
      },
    ];
  });

const normalizeContentResources = (
  value: unknown,
): NormalizedContentResource[] =>
  asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const id = readId(entry);
    return [
      {
        id,
        ...(readString(record.type ?? record["@type"])
          ? {
              type: readString(record.type ?? record["@type"]),
            }
          : {}),
        ...(readString(record.format)
          ? { format: readString(record.format) }
          : {}),
        ...(readLabel(record.label) ? { label: readLabel(record.label) } : {}),
        services: normalizeServices(record.service ?? record.services),
      },
    ];
  });

const normalizeSelectors = (value: unknown): NormalizedSelector[] =>
  asArray(value).flatMap((entry) => {
    if (typeof entry === "string")
      return [{ type: "FragmentSelector", value: entry }];
    const record = asRecord(entry);
    if (!record) return [];
    return [
      {
        type: readString(record.type ?? record["@type"]) ?? "Selector",
        ...(readString(record.value ?? record.fragment)
          ? {
              value: readString(record.value ?? record.fragment),
            }
          : {}),
        ...(readId(record.source) ? { source: readId(record.source) } : {}),
      },
    ];
  });

const normalizeAnnotations = (value: unknown): NormalizedAnnotation[] =>
  asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const target = record.target ?? record.on;
    const targetRecord = asRecord(target);
    const motivationValues = asArray(record.motivation)
      .map(readString)
      .filter((item): item is string => Boolean(item));
    return [
      {
        id: readId(entry),
        ...(motivationValues.length === 1
          ? { motivation: motivationValues[0] }
          : {}),
        ...(motivationValues.length > 1
          ? { motivation: motivationValues }
          : {}),
        bodies: normalizeContentResources(record.body ?? record.resource),
        ...(readId(targetRecord?.source ?? target)
          ? {
              target: readId(targetRecord?.source ?? target),
            }
          : {}),
        selectors: normalizeSelectors(targetRecord?.selector),
      },
    ];
  });

const normalizeRanges = (value: unknown, depth = 0): NormalizedRange[] => {
  if (depth > 20) return [];
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const rawItems = asArray(record.items ?? record.ranges ?? record.canvases);
    return [
      {
        id: readId(entry),
        ...(readLabel(record.label) ? { label: readLabel(record.label) } : {}),
        items: rawItems.flatMap<string | NormalizedRange>((item) => {
          const itemRecord = asRecord(item);
          const nested =
            itemRecord &&
            (itemRecord.type === "Range" || itemRecord["@type"] === "sc:Range")
              ? normalizeRanges(item, depth + 1)[0]
              : undefined;
          return nested ? [nested] : readId(item) ? [readId(item)] : [];
        }),
      },
    ];
  });
};

export const normalizeManifest = (
  input: unknown,
  parsed: ManifestoManifest,
  fallbackId: string,
): NormalizedManifest => {
  const record = asRecord(input) ?? {};
  const rawCanvases = asArray(record.items);
  const manifestoCanvases = getManifestCanvases(parsed);
  const canvases = manifestoCanvases.map((canvas, index): NormalizedCanvas => {
    const raw = asRecord(rawCanvases[index]);
    const annotationPages = asArray(raw?.items ?? raw?.images);
    const annotations = annotationPages.flatMap((page) => {
      const pageRecord = asRecord(page);
      return normalizeAnnotations(
        pageRecord?.items ?? pageRecord?.resources ?? page,
      );
    });
    return {
      id: canvas.id ?? readId(raw) ?? "",
      index,
      label:
        readLabel(raw?.label) ?? readLabel(canvas.getLabel?.()?.getValue?.()),
      width: canvas.getWidth?.(),
      height: canvas.getHeight?.(),
      type: canvas.getType?.(),
      annotations,
    };
  });
  return {
    id: readId(record) || fallbackId,
    type: "Manifest",
    label:
      readLabel(record.label) ?? readLabel(parsed.getLabel?.()?.getValue?.()),
    canvases,
    ranges: normalizeRanges(record.structures),
    services: normalizeServices(record.service ?? record.services),
  };
};
