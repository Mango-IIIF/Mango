import type { ChapterModel } from '../core/types/story';
import type { ModelViewChange } from '../core/types/events';

export type ModelPoseState = {
  lastPose: ChapterModel | null;
};

export type ModelPose = {
  getState: () => ModelPoseState;
  updateFromEvent: (detail: ModelViewChange) => void;
  clear: () => void;
  getPose: () => ChapterModel | null;
};

export const createModelPose = (): ModelPose => {
  const state: ModelPoseState = {
    lastPose: null,
  };

  return {
    getState: () => ({ lastPose: state.lastPose ? { ...state.lastPose } : null }),
    updateFromEvent: (detail: ModelViewChange) => {
      const next = {
        cameraOrbit: detail.cameraOrbit ?? state.lastPose?.cameraOrbit,
        cameraTarget: detail.cameraTarget ?? state.lastPose?.cameraTarget,
        fieldOfView: detail.fieldOfView ?? state.lastPose?.fieldOfView,
        orientation: detail.orientation ?? state.lastPose?.orientation,
      };
      if (!next.cameraOrbit && !next.cameraTarget && !next.orientation && !next.fieldOfView) {
        return;
      }
      state.lastPose = {
        cameraOrbit: next.cameraOrbit,
        cameraTarget: next.cameraTarget,
        fieldOfView: next.fieldOfView,
        orientation: next.orientation,
      };
    },
    clear: () => {
      state.lastPose = null;
    },
    getPose: () => (state.lastPose ? { ...state.lastPose } : null),
  };
};
