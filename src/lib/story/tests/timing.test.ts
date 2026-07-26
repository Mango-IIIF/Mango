import { describe, expect, it } from 'vitest';
import type { Chapter } from '../../core/types/story';
import { migrateLegacyChapterTiming, resolveChapterTiming } from '../timing';

const chapter = (overrides: Partial<Chapter> = {}): Chapter => ({
  id: 'stable-chapter-id',
  manifest: 'https://example.org/manifest',
  canvasIndex: 0,
  viewBox: { x: 0, y: 0, w: 100, h: 100 },
  ...overrides,
});

describe('chapter timing migration', () => {
  it('preserves legacy transition and silent presentation timing', () => {
    const timing = resolveChapterTiming(chapter({ transitionTimeMs: 1750 }));
    expect(timing.entryTransition.durationMs).toBe(1750);
    expect(timing.presentationDurationMs).toBe(1750);
    expect(timing.migratedFromLegacy).toBe(true);
  });

  it('keeps entry, presentation and advance timing independent', () => {
    const timing = resolveChapterTiming(
      chapter({
        transitionTimeMs: 9000,
        entryTransition: { type: 'cut', durationMs: 0 },
        presentationDurationMs: 4200,
        advance: { mode: 'auto', delayMs: 650 },
      }),
    );
    expect(timing).toMatchObject({
      entryTransition: { type: 'cut', durationMs: 0 },
      presentationDurationMs: 4200,
      advanceDelayMs: 650,
      migratedFromLegacy: false,
    });
  });

  it('materializes explicit fields without creating a camera track', () => {
    const migrated = migrateLegacyChapterTiming(chapter({ transitionTimeMs: 1200 }));
    expect(migrated.transitionTimeMs).toBeUndefined();
    expect(migrated.entryTransition?.durationMs).toBe(1200);
    expect(migrated.presentationDurationMs).toBe(1200);
    expect((migrated as Record<string, unknown>).cameraTrack).toBeUndefined();
  });
});
