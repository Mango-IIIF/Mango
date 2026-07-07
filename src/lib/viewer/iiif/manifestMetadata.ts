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

const normaliseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const resolveResourceId = (value: any): string =>
  normaliseLangValue(value?.id ?? value?.['@id'], 'en');

export const normaliseLangValue = (value: unknown, locale: string): string => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    const first = value[0];
    if (first && typeof first === 'object' && 'value' in first) {
      const match =
        value.find(
          (entry) => entry?.locale === locale || entry?.language === locale,
        ) ||
        value.find((entry) => entry?.locale === 'en' || entry?.language === 'en') ||
        value.find((entry) => !entry?.locale && !entry?.language) ||
        first;
      return normaliseLangValue((match as { value?: unknown })?.value ?? match, locale);
    }
    return value
      .map((entry) => normaliseLangValue(entry, locale))
      .filter(Boolean)
      .join(' ');
  }
  if (typeof value === 'object') {
    if ('value' in value) {
      return normaliseLangValue((value as { value?: unknown }).value, locale);
    }
    const map = value as Record<string, unknown>;
    const languageKey = locale?.split('-')[0] ?? locale;
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
  manifestoObject: any,
  manifestJson: any,
  locale: string,
): ManifestMetadataItem[] => {
  const rawMetadata = manifestJson?.metadata ?? manifestoObject?.getMetadata?.();
  if (!Array.isArray(rawMetadata)) return [];
  return rawMetadata
    .map((item: any, index: number) => {
      const manifestoItem = manifestoObject?.getMetadata?.()?.[index];
      const labelSource = item?.label ?? item?.getLabel?.() ?? manifestoItem?.label ?? manifestoItem?.getLabel?.();
      const valueSource = item?.value ?? item?.getValue?.() ?? manifestoItem?.value ?? manifestoItem?.getValue?.();
      const label = normaliseLangValue(labelSource, locale);
      const value = normaliseLangValue(valueSource, locale);
      if (!label && !value) return null;
      return { label, value };
    })
    .filter((item): item is ManifestMetadataItem => item !== null);
};

export const resolveManifestTitle = (
  manifestoObject: any,
  manifestJson: any,
  locale: string,
): string => {
  const labelSource = manifestJson?.label ?? manifestoObject?.getLabel?.();
  return normaliseLangValue(labelSource, locale);
};

export const resolveManifestDescription = (
  manifestoObject: any,
  manifestJson: any,
  locale: string,
): string => {
  const descriptionSource =
    manifestJson?.summary ?? manifestJson?.description ?? manifestoObject?.getDescription?.();
  return normaliseLangValue(descriptionSource, locale);
};

export const resolveManifestAttribution = (
  manifestoObject: any,
  manifestJson: any,
  locale: string,
): ManifestAttribution => {
  const requiredStatement = manifestoObject?.getRequiredStatement?.();
  const rawRequiredStatement = manifestJson?.requiredStatement;
  const requiredLabel =
    rawRequiredStatement?.label ??
    requiredStatement?.getLabel?.() ??
    requiredStatement?.label;
  const requiredValue =
    rawRequiredStatement?.value ??
    requiredStatement?.getValue?.() ??
    requiredStatement?.value ??
    requiredStatement;
  const attributionSource =
    requiredValue ?? manifestJson?.attribution;

  return {
    label: normaliseLangValue(requiredLabel, locale),
    value: normaliseLangValue(attributionSource, locale),
  };
};

export const resolveManifestLicence = (
  manifestoObject: any,
  manifestJson: any,
  locale: string,
): string => {
  const licenceSource =
    manifestoObject?.getLicense?.() ?? manifestJson?.license ?? manifestJson?.rights;
  return normaliseLangValue(licenceSource, locale);
};

export const resolveManifestProviders = (
  manifestoObject: any,
  manifestJson: any,
  locale: string
): ManifestProvider[] => {
  const rawProviders = manifestJson?.provider ?? manifestoObject?.getProviders?.();

  return normaliseArray(rawProviders)
    .map((provider: any) => {
      const id = resolveResourceId(provider);
      const label = normaliseLangValue(provider?.label ?? provider?.getLabel?.(), locale);
      if (!id && !label) return null;

      const homepage = normaliseArray(provider?.homepage)[0];
      const logo = normaliseArray(provider?.logo)[0];
      const seeAlso = normaliseArray(provider?.seeAlso)[0];

      const resolvedProvider: ManifestProvider = { id, label };

      if (homepage) {
        const format = normaliseLangValue(homepage.format, locale);
        resolvedProvider.homepage = {
          id: resolveResourceId(homepage),
          label: normaliseLangValue(homepage.label, locale),
          ...(format ? { format } : {}),
        };
      }

      if (logo) {
        resolvedProvider.logo = {
          id: resolveResourceId(logo),
          width: logo.width,
          height: logo.height,
        };
      }

      if (seeAlso) {
        const format = normaliseLangValue(seeAlso.format, locale);
        const profile = normaliseLangValue(seeAlso.profile, locale);
        resolvedProvider.seeAlso = {
          id: resolveResourceId(seeAlso),
          label: normaliseLangValue(seeAlso.label, locale),
          ...(format ? { format } : {}),
          ...(profile ? { profile } : {}),
        };
      }

      return resolvedProvider;
    })
    .filter((provider): provider is ManifestProvider => provider !== null);
};
