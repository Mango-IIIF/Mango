import { describe, expect, it } from 'vitest';
import {
  configureCameraTrackPreset,
  generateCameraPreset,
  retimeCameraKeyframes,
  sampleCameraTrack,
} from '../cameraTrack';

describe('in-chapter camera track sampling', () => {
  const track = {
    durationMs: 4000,
    keyframes: [
      { id: 'start', timeMs: 0, viewBox: { x: 0, y: 0, w: 100, h: 100 } },
      { id: 'end', timeMs: 4000, viewBox: { x: 50, y: 25, w: 50, h: 50 } },
    ],
  };

  it('interpolates between camera points within a chapter', () => {
    expect(sampleCameraTrack(track, 2000)?.viewBox).toEqual({
      x: 25,
      y: 12.5,
      w: 75,
      h: 75,
    });
  });

  it('clamps sampling to exact endpoints', () => {
    expect(sampleCameraTrack(track, -100)?.viewBox).toEqual(track.keyframes[0].viewBox);
    expect(sampleCameraTrack(track, 9000)?.viewBox).toEqual(track.keyframes[1].viewBox);
  });

  it('reaches every interior keyframe at its declared time with easing', () => {
    const easedTrack = {
      durationMs: 12_290,
      easing: 'ease-out' as const,
      pathType: 'linear' as const,
      keyframes: [
        { id: 'a', timeMs: 0, viewBox: { x: 168, y: 956, w: 4064, h: 3647 } },
        {
          id: 'b',
          timeMs: 6145,
          viewBox: { x: 543, y: 199, w: 1173, h: 1053 },
        },
        {
          id: 'c',
          timeMs: 12_290,
          viewBox: { x: 801, y: 1458, w: 1097, h: 984 },
        },
      ],
    };

    // Global time-warping used to put this sample halfway between b and c.
    expect(sampleCameraTrack(easedTrack, 6145)?.viewBox).toEqual(easedTrack.keyframes[1].viewBox);
  });

  it('is independent of chapter entry transition data', () => {
    expect('entryTransition' in track).toBe(false);
  });

  it('generates editable points for a basic zoom mode', () => {
    const preset = generateCameraPreset('zoom-in', track.keyframes[0].viewBox!, 6000);
    expect(preset.preset).toBe('zoom-in');
    expect(preset.keyframes).toHaveLength(2);
    expect(preset.keyframes[1].viewBox!.w).toBeLessThan(preset.keyframes[0].viewBox!.w);
    expect(preset.keyframes[1].timeMs).toBe(6000);
  });

  it('never moves placed focal pins when the movement style changes', () => {
    const placed = {
      ...track,
      preset: 'pan' as const,
      keyframes: [
        { ...track.keyframes[0], focus: { x: 20, y: 30 } },
        { ...track.keyframes[1], focus: { x: 70, y: 60 } },
      ],
    };
    const styled = configureCameraTrackPreset(placed, 'zoom-in', {
      x: 0,
      y: 0,
      w: 100,
      h: 100,
    });
    expect(styled.keyframes.map((point) => point.focus)).toEqual([
      { x: 20, y: 30 },
      { x: 70, y: 60 },
    ]);
  });

  it('keeps the first captured pan and zoom as the exact start of a named style', () => {
    const capturedStart = { x: 240, y: 120, w: 320, h: 160 };
    const placed = {
      durationMs: 5000,
      preset: 'custom' as const,
      keyframes: [
        {
          id: 'zoom-out-start',
          timeMs: 0,
          focus: { x: 400, y: 200 },
          viewBox: capturedStart,
        },
        {
          id: 'zoom-out-end',
          timeMs: 5000,
          focus: { x: 700, y: 350 },
          viewBox: { x: 500, y: 250, w: 400, h: 200 },
        },
      ],
    };
    const styled = configureCameraTrackPreset(
      placed,
      'zoom-out',
      { x: 0, y: 0, w: 1000, h: 500 },
      5000,
    );

    expect(styled.keyframes.map((point) => point.id)).toEqual([
      'zoom-out-start',
      'zoom-out-end',
    ]);
    expect(styled.keyframes[0].viewBox).toEqual(capturedStart);
    expect(sampleCameraTrack(styled, 0)?.viewBox).toEqual(capturedStart);
    expect(styled.keyframes[1].viewBox).toEqual(placed.keyframes[1].viewBox);
    expect(sampleCameraTrack(styled, 5000)?.viewBox!.w).toBeGreaterThan(capturedStart.w);
  });

  it('uses the stable chapter frame for named-style zoom when focal points move', () => {
    const baseView = { x: 0, y: 0, w: 1000, h: 500 };
    const generated = generateCameraPreset('zoom-in', baseView, 5000);
    const repositioned = {
      ...generated,
      keyframes: generated.keyframes.map((point, index) =>
        index === 1 ? { ...point, focus: { x: 800, y: 250 } } : point,
      ),
    };
    const configured = configureCameraTrackPreset(repositioned, 'zoom-in', baseView, 5000, {
      preservePoints: true,
    });

    expect(configured.keyframes[0].viewBox?.w).toBe(1000);
    expect(configured.keyframes[1].viewBox?.w).toBeCloseTo(440);
    expect(configured.keyframes[1].focus).toEqual({ x: 800, y: 250 });
    const styledEnd = sampleCameraTrack(configured, 5000)?.viewBox;
    expect(styledEnd?.x).toBeCloseTo(580);
    expect(styledEnd?.y).toBeCloseTo(140);
    expect(styledEnd?.w).toBeCloseTo(440);
    expect(styledEnd?.h).toBeCloseTo(220);
  });

  it('spaces ordered positions automatically across the duration', () => {
    const points = [
      { id: 'one', timeMs: 0, focus: { x: 10, y: 10 } },
      { id: 'two', timeMs: 0, focus: { x: 20, y: 20 } },
      { id: 'three', timeMs: 0, focus: { x: 30, y: 30 } },
    ];
    expect(retimeCameraKeyframes(points, 8000).map((point) => point.timeMs)).toEqual([
      0, 4000, 8000,
    ]);
  });

  it('regenerates generated presets and makes Still genuinely stationary', () => {
    const view = { x: 0, y: 0, w: 1000, h: 500 };
    const pan = generateCameraPreset('pan', view, 5000);

    const still = configureCameraTrackPreset(pan, 'static', view, 5000);
    expect(still.keyframes).toHaveLength(2);
    expect(still.keyframes[0].viewBox).toEqual(still.keyframes[1].viewBox);
    expect(sampleCameraTrack(still, 2500)?.viewBox).toEqual(still.keyframes[0].viewBox);
  });

  it('gives each basic authoring style a distinct camera rule', () => {
    const view = { x: 0, y: 0, w: 1000, h: 500 };
    const placed = {
      durationMs: 6000,
      preset: 'custom' as const,
      keyframes: [
        {
          id: 'one',
          timeMs: 0,
          focus: { x: 250, y: 250 },
          viewBox: { x: 0, y: 125, w: 500, h: 250 },
        },
        {
          id: 'two',
          timeMs: 6000,
          focus: { x: 750, y: 250 },
          viewBox: { x: 650, y: 200, w: 200, h: 100 },
        },
      ],
    };

    const custom = configureCameraTrackPreset(placed, 'custom', view, 6000);
    const pan = configureCameraTrackPreset(placed, 'pan', view, 6000);
    const zoomIn = configureCameraTrackPreset(placed, 'zoom-in', view, 6000);
    const zoomOut = configureCameraTrackPreset(placed, 'zoom-out', view, 6000);
    const still = configureCameraTrackPreset(placed, 'static', view, 6000);

    // Style selection does not mutate either authored frame.
    for (const styled of [custom, pan, zoomIn, zoomOut, still]) {
      expect(styled.keyframes.map((point) => point.viewBox?.w)).toEqual([500, 200]);
    }

    expect(sampleCameraTrack(custom, 6000)?.viewBox?.w).toBe(200);
    expect(sampleCameraTrack(pan, 6000)?.viewBox?.w).toBe(500);
    expect(sampleCameraTrack(zoomIn, 6000)?.viewBox?.w).toBeCloseTo(220);
    expect(sampleCameraTrack(zoomOut, 6000)?.viewBox?.w).toBeCloseTo(500 / 0.44);
    expect(sampleCameraTrack(still, 6000)?.viewBox).toEqual(placed.keyframes[0].viewBox);

    const restored = configureCameraTrackPreset(pan, 'custom', view, 6000);
    expect(restored.keyframes.map((point) => point.viewBox?.w)).toEqual([500, 200]);
  });

  it('does not invent camera points when an empty track is set to Custom', () => {
    const custom = configureCameraTrackPreset(
      { durationMs: 5000, preset: 'pan', keyframes: [] },
      'custom',
      { x: 0, y: 0, w: 1000, h: 500 },
      5000,
    );

    expect(custom.preset).toBe('custom');
    expect(custom.keyframes).toEqual([]);
  });

  it('always reaches an exact keyframe even when imported dwell data is invalid', () => {
    const invalidDwellTrack = {
      ...track,
      durationMs: 1000,
      keyframes: [
        { ...track.keyframes[0], timeMs: 0, dwellMs: 3000 },
        { ...track.keyframes[1], timeMs: 1000 },
      ],
    };
    expect(sampleCameraTrack(invalidDwellTrack, 1000)?.viewBox).toEqual(
      invalidDwellTrack.keyframes[1].viewBox,
    );
  });
});
