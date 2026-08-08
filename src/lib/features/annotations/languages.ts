/** Canonicalises host-supplied authoring languages without accepting free text. */
export const canonicalLanguageTag = (value: string): string | null => {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? null;
  } catch {
    return null;
  }
};

/**
 * The language list is application setup, shared by story and standalone
 * annotation authoring. Invalid and duplicate BCP 47 values are ignored.
 */
export const normaliseAuthoringLanguages = (
  values: string[] | undefined,
  fallback = 'en',
): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const language = canonicalLanguageTag(value);
    const key = language?.toLowerCase();
    if (!language || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(language);
  }
  if (result.length) return result;
  return [canonicalLanguageTag(fallback) ?? 'en'];
};

