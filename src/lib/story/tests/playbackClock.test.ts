import { describe, expect, it, vi } from 'vitest';
import { StoryPlaybackClock } from '../playbackClock.svelte';

const createClock = (nowRef: { value: number }) =>
  new StoryPlaybackClock({
    now: () => nowRef.value,
    // Ticking is driven manually so the assertions are deterministic.
    setIntervalFn: (() => 1) as unknown as typeof setInterval,
    clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
  });

describe('story playback clock', () => {
  it('does not complete a narration phase from a pre-seek source position', () => {
    const now = { value: 1_000 };
    const clock = createClock(now);
    const onComplete = vi.fn();

    // Chapter 6 left the shared audio element at 85.93s. Selecting chapter 3
    // starts its narration phase before the seek to 29.13s has landed.
    let sourceTime = 85.93;
    clock.loadChapter(4.67);
    clock.startNarrationPhase({
      offsetSec: 0,
      durationSec: 4.67,
      sourceStartSec: 29.13,
      getCurrentTime: () => sourceTime,
      onComplete,
    });
    clock.play();

    // 85.93 - 29.13 is 56.8s, far past this chapter. Deriving from it ended
    // the phase instantly: the timeline jumped to full and the camera loop
    // stopped, leaving the animation frozen at the end of its track.
    expect(clock.getState().playState).toBe('playing');
    expect(clock.getState().phase).toBe('narration');
    expect(clock.getState().currentTime).toBeLessThan(1);
    expect(onComplete).not.toHaveBeenCalled();

    // Once the seek lands the phase tracks the audio again.
    sourceTime = 31.13;
    now.value += 200;
    expect(clock.getLiveCurrentTime()).toBeCloseTo(2, 1);
  });

  it('still completes a narration phase when the audio reaches the segment end', () => {
    const now = { value: 1_000 };
    const clock = createClock(now);
    const onComplete = vi.fn();

    let sourceTime = 29.13;
    clock.loadChapter(4.67);
    clock.startNarrationPhase({
      offsetSec: 0,
      durationSec: 4.67,
      sourceStartSec: 29.13,
      getCurrentTime: () => sourceTime,
      onComplete,
    });
    clock.play();
    expect(onComplete).not.toHaveBeenCalled();

    // A small overshoot past the segment end is normal — timeupdate is coarse.
    sourceTime = 33.9;
    clock.play();
    now.value += 50;
    clock.pause();
    clock.play();

    expect(onComplete).toHaveBeenCalled();
    expect(clock.getState().phase).toBeNull();
  });

  it('drives the phase from the wall clock while the source is unavailable', () => {
    const now = { value: 1_000 };
    const clock = createClock(now);

    clock.loadChapter(10);
    clock.startNarrationPhase({
      offsetSec: 0,
      durationSec: 10,
      sourceStartSec: 0,
      getCurrentTime: () => null,
    });
    clock.play();

    now.value += 1_500;
    expect(clock.getLiveCurrentTime()).toBeCloseTo(1.5, 1);
  });
});
