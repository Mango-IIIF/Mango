import { describe, expect, it } from 'vitest';
import { normaliseAuthoringLanguages } from '../languages';

describe('annotation authoring languages', () => {
  it('canonicalises, de-duplicates, and rejects invalid setup values', () => {
    expect(normaliseAuthoringLanguages(['en', 'CY', 'en', 'not_a_tag'])).toEqual([
      'en',
      'cy',
    ]);
  });

  it('uses the configured interface language as its fallback', () => {
    expect(normaliseAuthoringLanguages([], 'fr')).toEqual(['fr']);
  });
});

