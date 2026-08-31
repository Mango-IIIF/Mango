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
    expect(sampleCameraTrack(track, -100)?.viewBox).toEqual(
      track.keyframes[0].viewBox,
    );
    expect(sampleCameraTrack(track, 9000)?.viewBox).toEqual(
      track.keyframes[1].viewBox,
    );
  });

  it('reaches every interior keyframe at its automatically balanced time with easing', () => {
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

    const balanced = retimeCameraKeyframes(
      easedTrack.keyframes,
      easedTrack.durationMs,
    );
    expect(balanced[1].timeMs).not.toBe(6145);
    expect(sampleCameraTrack(easedTrack, balanced[1].timeMs)?.viewBox).toEqual(
      easedTrack.keyframes[1].viewBox,
    );
  });

  it('is independent of chapter entry transition data', () => {
    expect('entryTransition' in track).toBe(false);
  });

  it('generates editable points for a basic zoom mode', () => {
    const preset = generateCameraPreset(
      'zoom-in',
      track.keyframes[0].viewBox!,
      6000,
    );
    expect(preset.preset).toBe('zoom-in');
    expect(preset.keyframes).toHaveLength(2);
    expect(preset.keyframes[1].viewBox!.w).toBeLessThan(
      preset.keyframes[0].viewBox!.w,
    );
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
    expect(sampleCameraTrack(styled, 5000)?.viewBox!.w).toBeGreaterThan(
      capturedStart.w,
    );
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
    const configured = configureCameraTrackPreset(
      repositioned,
      'zoom-in',
      baseView,
      5000,
      {
        preservePoints: true,
      },
    );

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
    expect(
      retimeCameraKeyframes(points, 8000).map((point) => point.timeMs),
    ).toEqual([0, 4000, 8000]);
  });

  it('smooths and distance-balances the supplied five-point chapter track', () => {
    const suppliedTrack = {
      durationMs: 5000,
      preset: 'custom' as const,
      easing: 'linear' as const,
      pathType: 'linear' as const,
      keyframes: [
        {
          id: 'one',
          timeMs: 0,
          dwellMs: 1000,
          focus: { x: 232.61666677053688, y: 7217.0098732922725 },
          viewBox: {
            x: -625.302206660063,
            y: 6573.570718219323,
            w: 1715.8377468611998,
            h: 1286.8783101458998,
          },
        },
        {
          id: 'two',
          timeMs: 1250,
          focus: { x: 1403.3454545454545, y: 7038.181324084683 },
          viewBox: {
            x: 167.94227680539075,
            y: 6111.628940779636,
            w: 2470.8063554801274,
            h: 1853.1047666100956,
          },
        },
        {
          id: 'three',
          timeMs: 2500,
          focus: { x: 2937.705137624591, y: 7342.345685263708 },
          viewBox: {
            x: 2079.786264193991,
            y: 6698.9065301907585,
            w: 1715.8377468611998,
            h: 1286.8783101458998,
          },
        },
        {
          id: 'four',
          timeMs: 3750,
          focus: { x: 4605.198077214771, y: 6798.5450571940655 },
          viewBox: {
            x: 3122.714263926695,
            y: 5686.682197228009,
            w: 2964.967626576152,
            h: 2223.725719932114,
          },
        },
        {
          id: 'five',
          timeMs: 5000,
          focus: { x: 8990.893972228136, y: 6470.79957067083 },
          viewBox: {
            x: 7755.4907944880715,
            y: 5544.247187365781,
            w: 2470.806355480128,
            h: 1853.104766610096,
          },
        },
      ],
    };

    const balanced = retimeCameraKeyframes(
      suppliedTrack.keyframes,
      suppliedTrack.durationMs,
    );
    const travelDurations = balanced
      .slice(1)
      .map(
        (point, index) =>
          point.timeMs -
          balanced[index].timeMs -
          (balanced[index].dwellMs ?? 0),
      );

    // The hold is no longer subtracted from an equal 1.25s slot, which used
    // to leave just 250ms for the opening move. The much longer final pan is
    // also given substantially more time than the shorter opening legs.
    expect(travelDurations[0]).toBeGreaterThan(500);
    expect(travelDurations[3]).toBeGreaterThan(travelDurations[0] * 2);
    expect(balanced.at(-1)?.timeMs).toBe(5000);

    // Zoom reverses at point two. Its velocity must approach and leave that
    // point continuously rather than changing by the full linear slope in a
    // single rendered frame.
    const pointTime = balanced[1].timeMs;
    const before =
      sampleCameraTrack(suppliedTrack, pointTime - 10)?.viewBox?.w ?? 0;
    const at = sampleCameraTrack(suppliedTrack, pointTime)?.viewBox?.w ?? 0;
    const after =
      sampleCameraTrack(suppliedTrack, pointTime + 10)?.viewBox?.w ?? 0;
    const incomingVelocity = (at - before) / 10;
    const outgoingVelocity = (after - at) / 10;
    // The former pair of linear slopes jumped by about 1.2 canvas units/ms.
    expect(Math.abs(incomingVelocity - outgoingVelocity)).toBeLessThan(0.05);
    expect(at).toBeCloseTo(suppliedTrack.keyframes[1].viewBox.w);
  });

  it('regenerates generated presets and makes Still genuinely stationary', () => {
    const view = { x: 0, y: 0, w: 1000, h: 500 };
    const pan = generateCameraPreset('pan', view, 5000);

    const still = configureCameraTrackPreset(pan, 'static', view, 5000);
    expect(still.keyframes).toHaveLength(2);
    expect(still.keyframes[0].viewBox).toEqual(still.keyframes[1].viewBox);
    expect(sampleCameraTrack(still, 2500)?.viewBox).toEqual(
      still.keyframes[0].viewBox,
    );
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
      expect(styled.keyframes.map((point) => point.viewBox?.w)).toEqual([
        500, 200,
      ]);
    }

    expect(sampleCameraTrack(custom, 6000)?.viewBox?.w).toBe(200);
    expect(sampleCameraTrack(pan, 6000)?.viewBox?.w).toBe(500);
    expect(sampleCameraTrack(zoomIn, 6000)?.viewBox?.w).toBeCloseTo(220);
    expect(sampleCameraTrack(zoomOut, 6000)?.viewBox?.w).toBeCloseTo(
      500 / 0.44,
    );
    expect(sampleCameraTrack(still, 6000)?.viewBox).toEqual(
      placed.keyframes[0].viewBox,
    );

    const restored = configureCameraTrackPreset(pan, 'custom', view, 6000);
    expect(restored.keyframes.map((point) => point.viewBox?.w)).toEqual([
      500, 200,
    ]);
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
