import { derived, get, writable } from 'svelte/store';
import en from '../../locales/en.json';
import es from '../../locales/es.json';
import cy from '../../locales/cy.json';
import fr from '../../locales/fr.json';

type Messages = typeof en;

type Params = Record<string, string | number | undefined>;

type MessageTree = string | { [key: string]: MessageTree };
type MessageValue = MessageTree | undefined;

const catalogue: Record<string, Messages> = {
  en,
  es,
  cy,
  fr,
};

export const supportedLocales = Object.freeze(Object.keys(catalogue));

const fallbackLocale = 'en';

const normaliseLocale = (value: string): string => {
  return value.trim().replace('_', '-').toLowerCase();
};

const resolveLocale = (value?: string): string => {
  if (!value) return fallbackLocale;
  const normalised = normaliseLocale(value);
  if (catalogue[normalised]) return normalised;
  const base = normalised.split('-')[0];
  if (base && catalogue[base]) return base;
  return fallbackLocale;
};

const lookup = (messages: Messages, key: string): MessageValue => {
  return key.split('.').reduce<MessageValue>((acc, part) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, MessageTree>)[part];
  }, messages as MessageTree);
};

const format = (template: string, params?: Params): string => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value == null ? match : String(value);
  });
};

export const locale = writable<string>(fallbackLocale);

export const setLocale = (value: string): void => {
  locale.set(resolveLocale(value));
};

export const getLocale = (): string => get(locale);

export const translate = (key: string, params?: Params, overrideLocale?: string): string => {
  const resolved = resolveLocale(overrideLocale ?? get(locale));
  const messages = catalogue[resolved] ?? catalogue[fallbackLocale];
  const value = lookup(messages, key);
  if (typeof value !== 'string') return key;
  return format(value, params);
};

export const t = derived(locale, ($locale) => {
  return (key: string, params?: Params): string => translate(key, params, $locale);
});
