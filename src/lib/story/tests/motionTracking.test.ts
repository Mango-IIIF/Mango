import { describe, expect, it } from 'vitest';
import {
  catmullRom,
  configureCameraTrackPreset,
  generateCameraPreset,
  sampleCameraTrack,
} from '../cameraTrack';
import { createMangoViewerStateBody, parseMangoViewerStateBody } from '../storyAnnotationProfile';
import type { Chapter } from '../../core/types/story';

describe('enhanced motion tracking engine', () => {
  it('calculates Catmull-Rom spline points correctly at boundaries and midpoints', () => {
    // Linear values 0 -> 10 -> 20 -> 30
    expect(catmullRom(0, 10, 20, 30, 0)).toBe(10);
    expect(catmullRom(0, 10, 20, 30, 1)).toBe(20);
    expect(catmullRom(0, 10, 20, 30, 0.5)).toBe(15);
  });

  it('respects keyframe dwell (hold) times before beginning movement', () => {
    const track = {
      durationMs: 5000,
      pathType: 'spline' as const,
      keyframes: [
        {
          id: 'k1',
          timeMs: 0,
          dwellMs: 2000,
          viewBox: { x: 0, y: 0, w: 100, h: 100 },
        },
        {
          id: 'k2',
          timeMs: 5000,
          viewBox: { x: 300, y: 300, w: 50, h: 50 },
        },
      ],
    };

    // At t=0 and t=1500ms (during the 2000ms dwell period), view remains fixed at k1
    expect(sampleCameraTrack(track, 0)?.viewBox).toEqual({
      x: 0,
      y: 0,
      w: 100,
      h: 100,
    });
    expect(sampleCameraTrack(track, 1500)?.viewBox).toEqual({
      x: 0,
      y: 0,
      w: 100,
      h: 100,
    });

    // After 2000ms, motion starts interpolating towards k2
    const midSample = sampleCameraTrack(track, 3500); // 50% between 2000ms and 5000ms
    expect(midSample?.viewBox?.x).toBeGreaterThan(0);
    expect(midSample?.viewBox?.x).toBeLessThan(300);
  });

  it('uses Catmull-Rom spline curves for non-linear arc trajectories', () => {
    // Non-collinear points: k1=(0,0), k2=(500,400), k3=(1000,0)
    const track = {
      durationMs: 6000,
      pathType: 'spline' as const,
      keyframes: [
        { id: 'k1', timeMs: 0, viewBox: { x: 0, y: 0, w: 1000, h: 1000 } },
        { id: 'k2', timeMs: 3000, viewBox: { x: 500, y: 400, w: 800, h: 800 } },
        {
          id: 'k3',
          timeMs: 6000,
          viewBox: { x: 1000, y: 0, w: 1000, h: 1000 },
        },
      ],
    };

    const linearSample = sampleCameraTrack({ ...track, pathType: 'linear' }, 1500);
    const splineSample = sampleCameraTrack(track, 1500);

    expect(splineSample?.viewBox).toBeDefined();
    expect(linearSample?.viewBox).toBeDefined();
    // Spline curve provides smooth non-linear interpolation distinct from straight-line LERP
    expect(splineSample?.viewBox?.y).not.toBe(linearSample?.viewBox?.y);
  });

  it('generates ken-burns, hero-reveal, and arc-sweep motion presets', () => {
    const baseView = { x: 0, y: 0, w: 1000, h: 500 };

    const kenBurns = generateCameraPreset('ken-burns', baseView, 5000);
    expect(kenBurns.preset).toBe('ken-burns');
    expect(kenBurns.pathType).toBe('spline');
    expect(kenBurns.keyframes[1].viewBox?.w).toBeLessThan(baseView.w);

    const hero = generateCameraPreset('hero-reveal', baseView, 6000);
    expect(hero.preset).toBe('hero-reveal');
    expect(hero.keyframes[0].dwellMs).toBe(1500);

    const arc = generateCameraPreset('arc-sweep', baseView, 4000);
    expect(arc.preset).toBe('arc-sweep');
    expect(arc.keyframes).toHaveLength(3);
  });

  it('preserves existing user keyframe markers when applying motion presets', () => {
    const baseView = { x: 0, y: 0, w: 1000, h: 500 };
    const customTrack = {
      durationMs: 6000,
      preset: 'pan' as const,
      keyframes: [
        { id: 'm1', timeMs: 0, focus: { x: 100, y: 100 }, viewBox: baseView },
        {
          id: 'm2',
          timeMs: 3000,
          focus: { x: 500, y: 300 },
          viewBox: baseView,
        },
        {
          id: 'm3',
          timeMs: 6000,
          focus: { x: 900, y: 100 },
          viewBox: baseView,
        },
      ],
    };

    const kenBurnsConfig = configureCameraTrackPreset(customTrack, 'ken-burns', baseView, 6000);
    expect(kenBurnsConfig.keyframes).toHaveLength(3);
    expect(kenBurnsConfig.keyframes[0].focus).toEqual({ x: 100, y: 100 });
    expect(kenBurnsConfig.keyframes[1].focus).toEqual({ x: 500, y: 300 });
    expect(kenBurnsConfig.keyframes[2].focus).toEqual({ x: 900, y: 100 });
    expect(kenBurnsConfig.pathType).toBe('spline');
    expect(kenBurnsConfig.preset).toBe('ken-burns');
  });

  it('serializes and deserializes dwellMs, pathType, and presets in W3C Annotations', () => {
    const chapter: Chapter = {
      id: 'ch_motion_1',
      manifest: 'https://example.org/iiif/manifest.json',
      canvasIndex: 0,
      cameraTrack: {
        durationMs: 7000,
        preset: 'ken-burns',
        pathType: 'spline',
        easing: 'ease-in-out',
        keyframes: [
          {
            id: 'node-1',
            timeMs: 0,
            dwellMs: 1500,
            viewBox: { x: 10, y: 20, w: 500, h: 400 },
          },
          {
            id: 'node-2',
            timeMs: 7000,
            viewBox: { x: 100, y: 80, w: 400, h: 320 },
          },
        ],
      },
    };

    const body = createMangoViewerStateBody(chapter);
    expect(body.mangoState.cameraTrack?.pathType).toBe('spline');
    expect(body.mangoState.cameraTrack?.keyframes[0].dwellMs).toBe(1500);

    const restored = parseMangoViewerStateBody(body);
    expect(restored?.cameraTrack?.pathType).toBe('spline');
    expect(restored?.cameraTrack?.preset).toBe('ken-burns');
    expect(restored?.cameraTrack?.keyframes[0].dwellMs).toBe(1500);
  });

  it('keeps legacy custom preset metadata when loading annotations', () => {
    const chapter: Chapter = {
      id: 'legacy-custom',
      manifest: 'https://example.org/iiif/manifest.json',
      canvasIndex: 0,
      cameraTrack: {
        durationMs: 3000,
        preset: 'custom',
        keyframes: [
          {
            id: 'custom-1',
            timeMs: 0,
            viewBox: { x: 0, y: 0, w: 100, h: 100 },
          },
          {
            id: 'custom-2',
            timeMs: 3000,
            viewBox: { x: 20, y: 10, w: 80, h: 80 },
          },
        ],
      },
    };
    const restored = parseMangoViewerStateBody(createMangoViewerStateBody(chapter));
    expect(restored?.cameraTrack?.preset).toBe('custom');
  });
});
