import { describe, expect, it } from 'vitest';
import {
  formatCameraState,
  normaliseFovDeg,
  readCameraState,
} from '../modelCameraState';

describe('model camera state', () => {
  it('reads numeric camera state and formats pose strings', () => {
    const viewer = {
      getCameraOrbit: () => ({ theta: 0.1, phi: 1.2, radius: 3 }),
      getCameraTarget: () => ({ x: 1, y: 2, z: 3 }),
      getFieldOfView: () => Math.PI / 4,
    };

    const state = readCameraState(viewer);
    expect(state).toEqual({
      orbit: { theta: 0.1, phi: 1.2, radius: 3 },
      target: { x: 1, y: 2, z: 3 },
      fovDeg: 45,
    });

    const formatted = formatCameraState(state);
    expect(formatted).toEqual({
      cameraOrbit: '0.1rad 1.2rad 3m',
      cameraTarget: '1m 2m 3m',
      fieldOfView: '45deg',
    });
  });

  it('normalises field of view values', () => {
    expect(normaliseFovDeg('1.570796rad')).toBeCloseTo(90, 4);
    expect(normaliseFovDeg('45deg')).toBe(45);
    expect(normaliseFovDeg(2)).toBeCloseTo((2 * 180) / Math.PI, 4);
    expect(normaliseFovDeg('')).toBeNull();
  });
});
