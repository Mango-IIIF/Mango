export type MediaMarksState = {
  lastTime: number;
  markIn: number | null;
  markOut: number | null;
};

export type MediaSegment = {
  start: number;
  end: number;
};

export type MediaMarks = {
  getState: () => MediaMarksState;
  updateTime: (time: number) => void;
  markIn: () => void;
  markOut: () => void;
  setSegment: (start: number | null, end: number | null) => void;
  clear: () => void;
  hasValidMarks: () => boolean;
  getSegment: () => MediaSegment | null;
};

const isValid = (markIn: number | null, markOut: number | null): boolean => {
  if (markIn == null || markOut == null) return false;
  return markOut > markIn;
};

export const createMediaMarks = (): MediaMarks => {
  const state: MediaMarksState = {
    lastTime: 0,
    markIn: null,
    markOut: null,
  };

  return {
    getState: () => ({ ...state }),
    updateTime: (time: number) => {
      if (Number.isFinite(time)) {
        state.lastTime = Math.max(0, time);
      }
    },
    markIn: () => {
      state.markIn = state.lastTime;
    },
    markOut: () => {
      state.markOut = state.lastTime;
    },
    setSegment: (start: number | null, end: number | null) => {
      state.markIn = Number.isFinite(start) ? (start as number) : null;
      state.markOut = Number.isFinite(end) ? (end as number) : null;
    },
    clear: () => {
      state.markIn = null;
      state.markOut = null;
    },
    hasValidMarks: () => isValid(state.markIn, state.markOut),
    getSegment: () => {
      if (!isValid(state.markIn, state.markOut)) return null;
      return { start: state.markIn as number, end: state.markOut as number };
    },
  };
};
