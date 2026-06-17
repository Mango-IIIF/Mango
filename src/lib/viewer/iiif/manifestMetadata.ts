export type ManifestMetadataItem = { label: string; value: string };

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
  const rawMetadata = manifestoObject?.getMetadata?.() ?? manifestJson?.metadata;
  if (!Array.isArray(rawMetadata)) return [];
  return rawMetadata
    .map((item: any) => {
      const labelSource = item?.getLabel?.() ?? item?.label;
      const valueSource = item?.getValue?.() ?? item?.value;
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
  const labelSource = manifestoObject?.getLabel?.() ?? manifestJson?.label;
  return normaliseLangValue(labelSource, locale);
};

export const resolveManifestDescription = (
  manifestoObject: any,
  manifestJson: any,
  locale: string,
): string => {
  const descriptionSource =
    manifestoObject?.getDescription?.() ?? manifestJson?.description;
  return normaliseLangValue(descriptionSource, locale);
};

export const resolveManifestAttribution = (
  manifestoObject: any,
  manifestJson: any,
  locale: string,
): string => {
  const requiredStatement = manifestoObject?.getRequiredStatement?.();
  const requiredValue =
    requiredStatement?.getValue?.() ??
    requiredStatement?.value ??
    requiredStatement;
  const attributionSource =
    requiredValue ?? manifestJson?.requiredStatement?.value ?? manifestJson?.attribution;
  return normaliseLangValue(attributionSource, locale);
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
