import { derived, get, writable, type Readable, type Writable } from 'svelte/store';
import en from '../../locales/en.json';
import es from '../../locales/es.json';
import cy from '../../locales/cy.json';
import fr from '../../locales/fr.json';
import ja from '../../locales/ja.json';

export type I18nParams = Record<string, string | number | undefined>;
export type MessageTree = string | { [key: string]: MessageTree };
export type LocaleCatalogues = Record<string, MessageTree>;
export type TranslateFn = (key: string, params?: I18nParams, overrideLocale?: string) => string;

type MessageValue = MessageTree | undefined;

export interface CreateI18nOptions {
  /** Messages and overrides keyed by locale code (e.g. `{ en, cy, es, fr, ja }`). */
  catalogues: LocaleCatalogues;
  /** Shared locale store to bind to; creates an isolated store when omitted. */
  localeStore?: Writable<string>;
  /** Ordered fallback translators checked when a key is not present in `catalogues` or overrides. */
  fallbacks?: readonly TranslateFn[];
  /** Fallback locale code when the active locale is unsupported or missing a key. Default `'en'`. */
  fallbackLocale?: string;
}

export interface I18nInstance {
  locale: Writable<string>;
  supportedLocales: readonly string[];
  setLocale: (value: string) => void;
  getLocale: () => string;
  /** Looks up a key in this instance's overrides/catalogues only, returning `undefined` if absent. */
  lookup: (key: string, params?: I18nParams, overrideLocale?: string) => string | undefined;
  /** Translates a key through overrides -> catalogues -> fallbacks -> key. */
  translate: TranslateFn;
  /** Reactive Svelte store returning `(key, params?) => string`. */
  t: Readable<(key: string, params?: I18nParams) => string>;
  /** Registers or replaces runtime override messages for a locale (merged over `catalogues`). */
  setOverrides: (localeCode: string, overrides: MessageTree) => void;
  /** Clears runtime overrides for a locale, or all locales when omitted. */
  clearOverrides: (localeCode?: string) => void;
}

const normaliseLocale = (value: string): string =>
  value.trim().replace('_', '-').toLowerCase();

const lookupTree = (messages: MessageTree | undefined, key: string): MessageValue => {
  if (!messages) return undefined;
  return key.split('.').reduce<MessageValue>((acc, part) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, MessageTree>)[part];
  }, messages);
};

const formatMessage = (template: string, params?: I18nParams): string => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value == null ? match : String(value);
  });
};

const resolveValue = (
  value: MessageValue,
  resolvedLocale: string,
  params?: I18nParams,
): string | undefined => {
  if (typeof value === 'string') return formatMessage(value, params);
  if (value && typeof value === 'object' && typeof params?.count === 'number') {
    const category = new Intl.PluralRules(resolvedLocale).select(params.count);
    const template = value[category] ?? value.other;
    if (typeof template === 'string') return formatMessage(template, params);
  }
  return undefined;
};

/**
 * Creates a layered i18n instance supporting app-level catalogues, runtime overrides,
 * `Intl.PluralRules` pluralization, and ordered fallback translators (e.g. Annotation -> Mango).
 */
export const createI18n = (options: CreateI18nOptions): I18nInstance => {
  const { catalogues, fallbacks = [], fallbackLocale = 'en' } = options;
  const supported = Object.freeze(Object.keys(catalogues));
  const localeStore = options.localeStore ?? writable<string>(fallbackLocale);
  const overridesStore = writable<LocaleCatalogues>({});

  const resolveLocale = (value?: string): string => {
    if (!value) return fallbackLocale;
    const normalised = normaliseLocale(value);
    if (catalogues[normalised] || get(overridesStore)[normalised]) return normalised;
    const base = normalised.split('-')[0];
    if (base && (catalogues[base] || get(overridesStore)[base])) return base;
    return fallbackLocale;
  };

  const setLocale = (value: string): void => {
    localeStore.set(resolveLocale(value));
  };

  const getLocale = (): string => get(localeStore);

  const lookup = (
    key: string,
    params?: I18nParams,
    overrideLocale?: string,
  ): string | undefined => {
    const active = overrideLocale ?? get(localeStore);
    const resolved = resolveLocale(active);
    const overrides = get(overridesStore);

    const fromOverride =
      resolveValue(lookupTree(overrides[resolved], key), resolved, params) ??
      resolveValue(lookupTree(overrides[fallbackLocale], key), fallbackLocale, params);
    if (fromOverride !== undefined) return fromOverride;

    const fromCatalogue =
      resolveValue(lookupTree(catalogues[resolved], key), resolved, params) ??
      resolveValue(lookupTree(catalogues[fallbackLocale], key), fallbackLocale, params);
    if (fromCatalogue !== undefined) return fromCatalogue;

    return undefined;
  };

  const translate: TranslateFn = (
    key: string,
    params?: I18nParams,
    overrideLocale?: string,
  ): string => {
    const found = lookup(key, params, overrideLocale);
    if (found !== undefined) return found;

    const active = overrideLocale ?? get(localeStore);
    for (const fallback of fallbacks) {
      const candidate = fallback(key, params, active);
      if (candidate !== key) return candidate;
    }
    return key;
  };

  const t = derived([localeStore, overridesStore], ([$locale]) => {
    return (key: string, params?: I18nParams): string =>
      translate(key, params, $locale);
  });

  const setOverrides = (localeCode: string, overrides: MessageTree): void => {
    const code = normaliseLocale(localeCode);
    overridesStore.update((current) => ({ ...current, [code]: overrides }));
  };

  const clearOverrides = (localeCode?: string): void => {
    if (!localeCode) {
      overridesStore.set({});
      return;
    }
    const code = normaliseLocale(localeCode);
    overridesStore.update((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
  };

  return {
    locale: localeStore,
    supportedLocales: supported,
    setLocale,
    getLocale,
    lookup,
    translate,
    t,
    setOverrides,
    clearOverrides,
  };
};

export const viewerLocales: LocaleCatalogues = Object.freeze({
  en,
  es,
  cy,
  fr,
  ja,
});

const viewerI18n = createI18n({ catalogues: viewerLocales });

export const supportedLocales = viewerI18n.supportedLocales;
export const locale = viewerI18n.locale;
export const setLocale = viewerI18n.setLocale;
export const getLocale = viewerI18n.getLocale;
export const translate = viewerI18n.translate;
export const t = viewerI18n.t;
export const setLocaleOverrides = viewerI18n.setOverrides;
export const clearLocaleOverrides = viewerI18n.clearOverrides;

/**
 * Creates an app-level i18n instance bound to Mango's shared `locale` store.
 * App-specific messages and overrides win; missing keys fall through `extraFallbacks`
 * and finally into Mango's base viewer catalogue.
 */
export const createViewerI18n = (
  catalogues: LocaleCatalogues,
  extraFallbacks: readonly TranslateFn[] = [],
): I18nInstance =>
  createI18n({
    catalogues,
    localeStore: locale,
    fallbacks: [...extraFallbacks, translate],
  });
