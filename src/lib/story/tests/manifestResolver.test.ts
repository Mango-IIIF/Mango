import { describe, expect, it } from 'vitest';
import { resolveManifestForNewChapter } from '../manifestResolver';

describe('resolveManifestForNewChapter', () => {
  it('prefers viewer manifest when available', () => {
    const result = resolveManifestForNewChapter(
      'https://example.org/viewer.json',
      'https://example.org/previous.json',
    );

    expect(result).toEqual({
      ok: true,
      manifest: 'https://example.org/viewer.json',
    });
  });

  it('falls back to previous manifest when viewer missing', () => {
    const result = resolveManifestForNewChapter(null, 'https://example.org/previous.json');

    expect(result).toEqual({
      ok: true,
      manifest: 'https://example.org/previous.json',
    });
  });

  it('returns error when no manifest is available', () => {
    const result = resolveManifestForNewChapter(null, null);
    expect(result).toEqual({ ok: false, reason: 'missing-manifest' });
  });
});
