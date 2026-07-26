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
    expect(sampleCameraTrack(track, 2000)?.viewBox).toEqual({ x: 25, y: 12.5, w: 75, h: 75 });
  });

  it('clamps sampling to exact endpoints', () => {
    expect(sampleCameraTrack(track, -100)?.viewBox).toEqual(track.keyframes[0].viewBox);
    expect(sampleCameraTrack(track, 9000)?.viewBox).toEqual(track.keyframes[1].viewBox);
  });

  it('is independent of chapter entry transition data', () => {
    expect('entryTransition' in track).toBe(false);
  });

  it('generates editable points for named Ken Burns-style presets', () => {
    const preset = generateCameraPreset('zoom-in', track.keyframes[0].viewBox!, 6000);
    expect(preset.preset).toBe('zoom-in');
    expect(preset.keyframes).toHaveLength(2);
    expect(preset.keyframes[1].viewBox!.w).toBeLessThan(preset.keyframes[0].viewBox!.w);
    expect(preset.keyframes[1].timeMs).toBe(6000);
  });

  it('never moves placed focal pins when the movement style changes', () => {
    const placed = {
      ...track,
      preset: 'custom' as const,
      keyframes: [
        { ...track.keyframes[0], focus: { x: 20, y: 30 } },
        { ...track.keyframes[1], focus: { x: 70, y: 60 } },
      ],
    };
    const styled = configureCameraTrackPreset(
      placed,
      'zoom-in',
      { x: 0, y: 0, w: 100, h: 100 },
    );
    expect(styled.keyframes.map((point) => point.focus)).toEqual([
      { x: 20, y: 30 },
      { x: 70, y: 60 },
    ]);
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
});
