export type ModelPose = {
  cameraOrbit?: string;
  cameraTarget?: string;
  fieldOfView?: string;
  orientation?: string;
};

export type ModelPoseTransition = 'interpolate' | 'jump';

export type ModelPoseOptions = {
  transition?: ModelPoseTransition;
  interpolationDecay?: number;
};
