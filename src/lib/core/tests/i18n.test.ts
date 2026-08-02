import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale, translate } from '../i18n';

// Catalogue drift between locales is checked statically by
// src/locales/check-locales.ts (npm run i18n:check), not here: translate()
// falls back to English for a missing key, so a runtime assertion cannot see
// the gap. These tests cover the resolution behaviour of i18n.ts itself.
describe('i18n catalogue', () => {
  afterEach(() => setLocale('en'));

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
      translate('storyViewer.chapterPosition', { current: 2, total: 7 }),
    ).toBe('Chapter 2 of 7');
  });

  it('translates into a locale passed as an override', () => {
    expect(translate('viewer.gallery.title', undefined, 'cy')).toBe('Galeri');
    expect(translate('viewer.gallery.title', undefined, 'ja')).toBe('ギャラリー');
    expect(getLocale()).toBe('en');
  });
});
