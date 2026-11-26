import { afterEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  clearLocaleOverrides,
  createViewerI18n,
  getLocale,
  setLocale,
  setLocaleOverrides,
  translate,
} from '../i18n';

// Catalogue drift between locales is checked statically by
// src/locales/check-locales.ts (npm run i18n:check), not here: translate()
// falls back to English for a missing key, so a runtime assertion cannot see
// the gap. These tests cover the resolution behaviour of i18n.ts itself.
describe('i18n catalogue', () => {
  afterEach(() => {
    clearLocaleOverrides();
    setLocale('en');
  });

  it('keeps translated messages for keys present in the selected locale', () => {
    setLocale('fr-FR');

    expect(translate('viewer.gallery.title')).toBe('Galerie');
  });

  it('resolves a regional tag to its base locale', () => {
    setLocale('es-MX');

    expect(getLocale()).toBe('es');
  });

  it('falls back to English for a locale with no catalogue', () => {
    setLocale('de');

    expect(getLocale()).toBe('en');
    expect(translate('viewer.gallery.title')).toBe('Gallery');
  });

  it('returns the key itself when no catalogue defines it', () => {
    expect(translate('viewer.gallery.notARealKey')).toBe(
      'viewer.gallery.notARealKey',
    );
  });

  it('interpolates named parameters', () => {
    expect(
      translate('viewer.panels.collection.messages.loadNextDates', { count: 7 }),
    ).toBe('Load next 7 dates');
  });

  it('translates into a locale passed as an override', () => {
    expect(translate('viewer.gallery.title', undefined, 'cy')).toBe('Galeri');
    expect(translate('viewer.gallery.title', undefined, 'ja')).toBe('ギャラリー');
    expect(getLocale()).toBe('en');
  });

  it('layers app catalogues, runtime overrides, plural rules, and Mango fallbacks via createViewerI18n', () => {
    const appI18n = createViewerI18n({
      en: {
        about: { title: 'Custom App' },
        app: {
          items: { one: '{count} item', other: '{count} items' },
        },
      },
      cy: {
        about: { title: 'Ap Arbennig' },
      },
    });

    // App-level override wins over Mango's base catalogue
    expect(appI18n.translate('about.title')).toBe('Custom App');
    // Unoverridden Mango key falls back seamlessly
    expect(appI18n.translate('viewer.gallery.title')).toBe('Gallery');
    // Plural rules work out of the box
    expect(appI18n.translate('app.items', { count: 1 })).toBe('1 item');
    expect(appI18n.translate('app.items', { count: 4 })).toBe('4 items');

    // Shares the same locale store as Mango
    setLocale('cy');
    expect(appI18n.getLocale()).toBe('cy');
    expect(appI18n.translate('about.title')).toBe('Ap Arbennig');
    expect(appI18n.translate('viewer.gallery.title')).toBe('Galeri');

    // Runtime overrides take highest precedence and update reactive `t` store
    appI18n.setOverrides('cy', { about: { title: 'Archif Cymru' } });
    expect(get(appI18n.t)('about.title')).toBe('Archif Cymru');
    appI18n.clearOverrides('cy');
    expect(appI18n.translate('about.title')).toBe('Ap Arbennig');

    // Mango's own runtime overrides also work
    setLocaleOverrides('en', { viewer: { gallery: { title: 'Pages' } } });
    expect(translate('viewer.gallery.title', undefined, 'en')).toBe('Pages');
  });
});
