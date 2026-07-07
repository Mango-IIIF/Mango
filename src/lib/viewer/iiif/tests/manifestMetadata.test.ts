import { describe, expect, it } from 'vitest';
import {
  resolveManifestAttribution,
  resolveManifestDescription,
  resolveManifestGeoLocation,
  resolveManifestTitle,
  resolveMetadataItems,
} from '../manifestMetadata';

const cookbookLanguageManifest = {
  label: {
    en: ["Whistler's Mother"],
    fr: ['La Mère de Whistler'],
  },
  summary: {
    en: [
      "Arrangement in Grey and Black No. 1, also called Portrait of the Artist's Mother.",
    ],
    fr: [
      "Arrangement en gris et noir n°1, also called Portrait de la mère de l'artiste.",
    ],
  },
  metadata: [
    {
      label: {
        en: ['Creator'],
        fr: ['Auteur'],
      },
      value: {
        none: ['Whistler, James Abbott McNeill'],
      },
    },
    {
      label: {
        en: ['Subject'],
        fr: ['Sujet'],
      },
      value: {
        en: ['McNeill Anna Matilda, mother of Whistler (1804-1881)'],
        fr: ['McNeill Anna Matilda, mère de Whistler (1804-1881)'],
      },
    },
  ],
  requiredStatement: {
    label: {
      en: ['Held By'],
      fr: ['Détenu par'],
    },
    value: {
      none: ["Musée d'Orsay, Paris, France"],
    },
  },
};

describe('manifest metadata language maps', () => {
  it('uses raw IIIF language maps for metadata labels and values', () => {
    const items = resolveMetadataItems(null, cookbookLanguageManifest, 'fr');

    expect(items[0]).toEqual({
      label: 'Auteur',
      value: 'Whistler, James Abbott McNeill',
    });
    expect(items[1]).toEqual({
      label: 'Sujet',
      value: 'McNeill Anna Matilda, mère de Whistler (1804-1881)',
    });
  });

  it('uses raw IIIF language maps for title, summary, and required statement', () => {
    expect(resolveManifestTitle(null, cookbookLanguageManifest, 'fr')).toBe(
      'La Mère de Whistler',
    );
    expect(resolveManifestDescription(null, cookbookLanguageManifest, 'fr')).toBe(
      "Arrangement en gris et noir n°1, also called Portrait de la mère de l'artiste.",
    );
    expect(resolveManifestAttribution(null, cookbookLanguageManifest, 'fr')).toEqual({
      label: 'Détenu par',
      value: "Musée d'Orsay, Paris, France",
    });
  });

  it('resolves a manifest-level navPlace point', () => {
    const location = resolveManifestGeoLocation(
      null,
      {
        navPlace: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                label: {
                  en: ['The Laocoön Bronze'],
                  it: ['Bronzo Laocoonte e i suoi figli'],
                },
              },
              geometry: {
                type: 'Point',
                coordinates: [-118.4745559, 34.0776376],
              },
            },
          ],
        },
      },
      'it',
    );

    expect(location).toEqual({
      label: 'Bronzo Laocoonte e i suoi figli',
      lat: 34.0776376,
      lng: -118.4745559,
    });
  });

  it('returns null when the manifest has no navPlace point', () => {
    expect(resolveManifestGeoLocation(null, {}, 'en')).toBeNull();
  });
});
