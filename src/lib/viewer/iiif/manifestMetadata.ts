import type { ManifestoManifest } from "./manifestoAdapter";

export type ManifestMetadataItem = { label: string; value: string };
export type ManifestAttribution = { label: string; value: string };
export type ManifestProvider = {
  id: string;
  label: string;
  homepage?: {
    id: string;
    label: string;
    format?: string;
  };
  logo?: {
    id: string;
    width?: number;
    height?: number;
  };
  seeAlso?: {
    id: string;
    label: string;
    format?: string;
    profile?: string;
  };
};
export type ManifestGeoLocation = {
  label: string;
  lat: number;
  lng: number;
};

const normaliseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const property = (value: unknown, key: string): unknown =>
  asRecord(value)?.[key];

const call = (value: unknown, method: string): unknown => {
  const fn = property(value, method);
  return typeof fn === "function" ? fn.call(value) : undefined;
};

const resolveResourceId = (value: unknown): string =>
  normaliseLangValue(property(value, "id") ?? property(value, "@id"), "en");

export const normaliseLangValue = (value: unknown, locale: string): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    const first = value[0];
    if (first && typeof first === "object" && "value" in first) {
      const match =
        value.find(
          (entry) => entry?.locale === locale || entry?.language === locale,
        ) ||
        value.find(
          (entry) => entry?.locale === "en" || entry?.language === "en",
        ) ||
        value.find((entry) => !entry?.locale && !entry?.language) ||
        first;
      return normaliseLangValue(
        (match as { value?: unknown })?.value ?? match,
        locale,
      );
    }
    return value
      .map((entry) => normaliseLangValue(entry, locale))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof value === "object") {
    if ("value" in value) {
      return normaliseLangValue((value as { value?: unknown }).value, locale);
    }
    const map = value as Record<string, unknown>;
    const languageKey = locale?.split("-")[0] ?? locale;
    if (locale && map[locale]) return normaliseLangValue(map[locale], locale);
    if (languageKey && map[languageKey]) {
      return normaliseLangValue(map[languageKey], locale);
    }
    if (map.en) return normaliseLangValue(map.en, locale);
    const firstKey = Object.keys(map)[0];
    if (firstKey) return normaliseLangValue(map[firstKey], locale);
  }
  return String(value);
};

export const resolveMetadataItems = (
  manifestoObject: ManifestoManifest | undefined,
  manifestJson: unknown,
  locale: string,
): ManifestMetadataItem[] => {
  const rawMetadata =
    property(manifestJson, "metadata") ?? manifestoObject?.getMetadata?.();
  if (!Array.isArray(rawMetadata)) return [];
  return rawMetadata
    .map((item: unknown, index: number) => {
      const manifestoItem = manifestoObject?.getMetadata?.()?.[index];
      const labelSource =
        property(item, "label") ??
        call(item, "getLabel") ??
        property(manifestoItem, "label") ??
        call(manifestoItem, "getLabel");
      const valueSource =
        property(item, "value") ??
        call(item, "getValue") ??
        property(manifestoItem, "value") ??
        call(manifestoItem, "getValue");
      const label = normaliseLangValue(labelSource, locale);
      const value = normaliseLangValue(valueSource, locale);
      if (!label && !value) return null;
      return { label, value };
    })
    .filter((item): item is ManifestMetadataItem => item !== null);
};

export const resolveManifestTitle = (
  manifestoObject: ManifestoManifest | undefined,
  manifestJson: unknown,
  locale: string,
): string => {
  const labelSource =
    property(manifestJson, "label") ?? manifestoObject?.getLabel?.();
  return normaliseLangValue(labelSource, locale);
};

export const resolveManifestDescription = (
  manifestoObject: ManifestoManifest | undefined,
  manifestJson: unknown,
  locale: string,
): string => {
  const descriptionSource =
    property(manifestJson, "summary") ??
    property(manifestJson, "description") ??
    manifestoObject?.getDescription?.();
  return normaliseLangValue(descriptionSource, locale);
};

export const resolveManifestAttribution = (
  manifestoObject: ManifestoManifest | undefined,
  manifestJson: unknown,
  locale: string,
): ManifestAttribution => {
  const requiredStatement = manifestoObject?.getRequiredStatement?.();
  const rawRequiredStatement = property(manifestJson, "requiredStatement");
  const requiredLabel =
    property(rawRequiredStatement, "label") ??
    call(requiredStatement, "getLabel") ??
    property(requiredStatement, "label");
  const requiredValue =
    property(rawRequiredStatement, "value") ??
    call(requiredStatement, "getValue") ??
    property(requiredStatement, "value") ??
    requiredStatement;
  const attributionSource =
    requiredValue ?? property(manifestJson, "attribution");

  return {
    label: normaliseLangValue(requiredLabel, locale),
    value: normaliseLangValue(attributionSource, locale),
  };
};

export const resolveManifestLicence = (
  manifestoObject: ManifestoManifest | undefined,
  manifestJson: unknown,
  locale: string,
): string => {
  const licenceSource =
    manifestoObject?.getLicense?.() ??
    property(manifestJson, "license") ??
    property(manifestJson, "rights");
  return normaliseLangValue(licenceSource, locale);
};

export const resolveManifestProviders = (
  manifestoObject: ManifestoManifest | undefined,
  manifestJson: unknown,
  locale: string,
): ManifestProvider[] => {
  const rawProviders =
    property(manifestJson, "provider") ?? manifestoObject?.getProviders?.();

  return normaliseArray(rawProviders)
    .map((provider: unknown) => {
      const id = resolveResourceId(provider);
      const label = normaliseLangValue(
        property(provider, "label") ?? call(provider, "getLabel"),
        locale,
      );
      if (!id && !label) return null;

      const homepage = normaliseArray(property(provider, "homepage"))[0];
      const logo = normaliseArray(property(provider, "logo"))[0];
      const seeAlso = normaliseArray(property(provider, "seeAlso"))[0];

      const resolvedProvider: ManifestProvider = { id, label };

      if (homepage) {
        const format = normaliseLangValue(property(homepage, "format"), locale);
        resolvedProvider.homepage = {
          id: resolveResourceId(homepage),
          label: normaliseLangValue(property(homepage, "label"), locale),
          ...(format ? { format } : {}),
        };
      }

      if (logo) {
        resolvedProvider.logo = {
          id: resolveResourceId(logo),
          ...(typeof property(logo, "width") === "number"
            ? { width: property(logo, "width") as number }
            : {}),
          ...(typeof property(logo, "height") === "number"
            ? { height: property(logo, "height") as number }
            : {}),
        };
      }

      if (seeAlso) {
        const format = normaliseLangValue(property(seeAlso, "format"), locale);
        const profile = normaliseLangValue(
          property(seeAlso, "profile"),
          locale,
        );
        resolvedProvider.seeAlso = {
          id: resolveResourceId(seeAlso),
          label: normaliseLangValue(property(seeAlso, "label"), locale),
          ...(format ? { format } : {}),
          ...(profile ? { profile } : {}),
        };
      }

      return resolvedProvider;
    })
    .filter((provider): provider is ManifestProvider => provider !== null);
};

export const resolveManifestGeoLocation = (
  manifestoObject: ManifestoManifest | undefined,
  manifestJson: unknown,
  locale: string,
): ManifestGeoLocation | null => {
  const navPlace =
    property(manifestJson, "navPlace") ?? manifestoObject?.navPlace;
  const feature = normaliseArray(property(navPlace, "features"))[0];
  const geometry = property(feature, "geometry");
  const coordinates = property(geometry, "coordinates");
  const [lng, lat] = Array.isArray(coordinates) ? coordinates : [];

  if (
    property(geometry, "type") !== "Point" ||
    typeof lat !== "number" ||
    typeof lng !== "number"
  ) {
    return null;
  }

  return {
    label: normaliseLangValue(
      property(property(feature, "properties"), "label"),
      locale,
    ),
    lat,
    lng,
  };
};
