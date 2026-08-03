import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNarrationPlayer } from '../narrationPlayer';

/**
 * Minimal HTMLAudioElement stand-in. The real element keeps reporting the
 * previous position until a seek lands, which is the behaviour these tests
 * exercise: `currentTime` only moves when the test says the seek completed.
 */
class FakeAudio {
  src = '';
  preload = '';
  crossOrigin: string | null = null;
  readyState = 4;
  seeking = false;
  paused = true;
  currentTime = 0;

  private listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  /** Position requested by the last assignment to currentTime. */
  pendingSeekTo: number | null = null;

  constructor() {
    // Assigning currentTime starts a seek rather than moving the playhead.
    let backing = 0;
    Object.defineProperty(this, 'currentTime', {
      get: () => backing,
      set: (value: number) => {
        this.pendingSeekTo = value;
        this.seeking = true;
      },
      configurable: true,
    });
    Object.defineProperty(this, 'landPlayhead', {
      value: (value: number) => {
        backing = value;
        this.seeking = false;
      },
      configurable: true,
    });
    Object.defineProperty(this, 'setReportedTime', {
      value: (value: number) => {
        backing = value;
      },
      configurable: true,
    });
  }

  addEventListener(event: string, handler: (...args: unknown[]) => void) {
    (this.listeners[event] ??= []).push(handler);
  }

  removeEventListener(event: string, handler: (...args: unknown[]) => void) {
    const handlers = this.listeners[event];
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index > -1) handlers.splice(index, 1);
  }

  emit(event: string) {
    [...(this.listeners[event] ?? [])].forEach((handler) => handler());
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  load() {}
}

type TestAudio = FakeAudio & {
  landPlayhead: (value: number) => void;
  setReportedTime: (value: number) => void;
};

let audio: TestAudio;

beforeEach(() => {
  audio = new FakeAudio() as TestAudio;
  vi.stubGlobal(
    'Audio',
    class {
      constructor() {
        return audio;
      }
    },
  );
});

describe('narration segment playback', () => {
  it('ignores the stale pre-seek position when moving back to an earlier segment', async () => {
    const player = createNarrationPlayer();

    // The previous chapter left the shared audio element near the end of the
    // file; selecting an earlier chapter seeks backwards.
    audio.setReportedTime(85.9);

    let settled: boolean | null = null;
    const finished = player
      .playSegment({ src: 'story.mp3', start: 20, end: 40 })
      .then((ok) => {
        settled = ok;
        return ok;
      });

    expect(audio.pendingSeekTo).toBe(20);

    // A timeupdate dispatched before the seek lands still reports 85.9, which
    // is past this segment's end. It must not end the chapter.
    audio.emit('timeupdate');
    await Promise.resolve();
    expect(settled).toBeNull();
    expect(audio.paused).toBe(false);

    // Once the seek lands, playback proceeds normally and the end still works.
    audio.landPlayhead(20);
    audio.emit('seeked');
    audio.emit('timeupdate');
    await Promise.resolve();
    expect(settled).toBeNull();

    audio.setReportedTime(40);
    audio.emit('timeupdate');
    await expect(finished).resolves.toBe(true);
    expect(audio.paused).toBe(true);
  });

  it('still ends the segment when it starts at zero after a later segment', async () => {
    const player = createNarrationPlayer();
    audio.setReportedTime(85.9);

    let settled: boolean | null = null;
    const finished = player
      .playSegment({ src: 'story.mp3', start: 0, end: 12 })
      .then((ok) => {
        settled = ok;
        return ok;
      });

    audio.emit('timeupdate');
    await Promise.resolve();
    expect(settled).toBeNull();

    audio.landPlayhead(0);
    audio.emit('timeupdate');
    await Promise.resolve();
    expect(settled).toBeNull();

    audio.setReportedTime(12);
    audio.emit('timeupdate');
    await expect(finished).resolves.toBe(true);
  });

  it('ends a forward segment without waiting for a seeked event', async () => {
    const player = createNarrationPlayer();
    audio.setReportedTime(5);

    const finished = player.playSegment({ src: 'story.mp3', start: 60, end: 85 });

    audio.landPlayhead(60);
    audio.emit('timeupdate');
    audio.setReportedTime(85);
    audio.emit('timeupdate');

    await expect(finished).resolves.toBe(true);
  });
});
