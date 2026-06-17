import { describe, expect, it } from 'vitest';
import { createModelPose } from '../modelPose';

describe('model pose', () => {
  it('stores latest model pose data', () => {
    const pose = createModelPose();
    pose.updateFromEvent({
      cameraOrbit: '45deg 30deg 2m',
      cameraTarget: '0m 1m 0m',
      fieldOfView: '45deg',
      orientation: '0deg 0deg 0deg',
    });

    expect(pose.getPose()).toEqual({
      cameraOrbit: '45deg 30deg 2m',
      cameraTarget: '0m 1m 0m',
      fieldOfView: '45deg',
      orientation: '0deg 0deg 0deg',
    });
  });

  it('ignores empty updates until pose is available', () => {
    const pose = createModelPose();
    pose.updateFromEvent({});
    expect(pose.getPose()).toBeNull();
  });
});
