/**
 * Story Viewer State Machine
 *
 * Implements explicit state management for story playback with:
 * - Type-safe state transitions
 * - Transition guards
 * - State entry/exit hooks
 * - Event emission
 * - History tracking (optional)
 */

// ===== Types =====

export type StoryState =
  | "IDLE"
  | "LOADING_CHAPTER"
  | "PLAYING_NARRATION"
  | "PLAYING_MEDIA"
  | "PRESENTING_SILENT"
  | "TRANSITION_DELAY"
  | "PAUSED"
  | "ENDED";

export type StoryEvent =
  | "LOAD_CHAPTER"
  | "CHAPTER_LOADED"
  | "START_NARRATION"
  | "START_MEDIA"
  | "START_SILENT_PRESENTATION"
  | "START_TRANSITION_DELAY"
  | "PAUSE"
  | "RESUME"
  | "STOP"
  | "END";

export type StateTransition = {
  from: StoryState;
  to: StoryState;
  event: StoryEvent;
};

export type TransitionContext = {
  chapterIndex?: number;
  autoPlay?: boolean;
  [key: string]: unknown;
};

export type TransitionGuard = (context: TransitionContext) => boolean;

export type StateAction = (context: TransitionContext) => void | Promise<void>;

export type StateChangeEvent = {
  from: StoryState;
  to: StoryState;
  event: StoryEvent;
  context: TransitionContext;
  timestamp: number;
};

export type StateChangeListener = (event: StateChangeEvent) => void;

// ===== State Machine Configuration =====

/**
 * Valid state transitions map
 * Maps from (currentState, event) to nextState
 */
const TRANSITIONS: Record<string, StoryState | undefined> = {
  // From IDLE
  "IDLE:LOAD_CHAPTER": "LOADING_CHAPTER",
  "IDLE:END": "ENDED",

  // From LOADING_CHAPTER
  "LOADING_CHAPTER:CHAPTER_LOADED": "IDLE", // Temporary state, will transition immediately
  "LOADING_CHAPTER:START_NARRATION": "PLAYING_NARRATION",
  "LOADING_CHAPTER:START_MEDIA": "PLAYING_MEDIA",
  "LOADING_CHAPTER:START_SILENT_PRESENTATION": "PRESENTING_SILENT",
  "LOADING_CHAPTER:STOP": "IDLE",
  "LOADING_CHAPTER:END": "ENDED",

  // From PLAYING_NARRATION
  "PLAYING_NARRATION:PAUSE": "PAUSED",
  "PLAYING_NARRATION:STOP": "IDLE",
  "PLAYING_NARRATION:START_TRANSITION_DELAY": "TRANSITION_DELAY",
  "PLAYING_NARRATION:LOAD_CHAPTER": "LOADING_CHAPTER",
  "PLAYING_NARRATION:END": "ENDED",

  // From PLAYING_MEDIA
  "PLAYING_MEDIA:PAUSE": "PAUSED",
  "PLAYING_MEDIA:STOP": "IDLE",
  "PLAYING_MEDIA:START_TRANSITION_DELAY": "TRANSITION_DELAY",
  "PLAYING_MEDIA:LOAD_CHAPTER": "LOADING_CHAPTER",
  "PLAYING_MEDIA:END": "ENDED",

  // From PRESENTING_SILENT
  "PRESENTING_SILENT:PAUSE": "PAUSED",
  "PRESENTING_SILENT:STOP": "IDLE",
  "PRESENTING_SILENT:START_TRANSITION_DELAY": "TRANSITION_DELAY",
  "PRESENTING_SILENT:LOAD_CHAPTER": "LOADING_CHAPTER",
  "PRESENTING_SILENT:END": "ENDED",

  // From TRANSITION_DELAY
  "TRANSITION_DELAY:LOAD_CHAPTER": "LOADING_CHAPTER",
  "TRANSITION_DELAY:STOP": "IDLE",
  "TRANSITION_DELAY:PAUSE": "PAUSED",
  "TRANSITION_DELAY:END": "ENDED",

  // From PAUSED
  "PAUSED:RESUME": "IDLE", // Will restore previous playing state
  "PAUSED:STOP": "IDLE",
  "PAUSED:LOAD_CHAPTER": "LOADING_CHAPTER",
  "PAUSED:END": "ENDED",

  // From ENDED
  "ENDED:LOAD_CHAPTER": "LOADING_CHAPTER",
  "ENDED:STOP": "IDLE",
};

// ===== State Machine =====

export type StoryStateMachine = {
  getState: () => StoryState;
  transition: (event: StoryEvent, context?: TransitionContext) => boolean;
  canTransition: (event: StoryEvent) => boolean;
  getValidEvents: () => StoryEvent[];
  onStateChange: (listener: StateChangeListener) => () => void;
  getHistory: () => StateChangeEvent[];
  reset: () => void;
  destroy: () => void;
};

export type StateMachineConfig = {
  initialState?: StoryState;
  guards?: Partial<Record<string, TransitionGuard>>;
  actions?: {
    onEnter?: Partial<Record<StoryState, StateAction>>;
    onExit?: Partial<Record<StoryState, StateAction>>;
  };
  trackHistory?: boolean;
  maxHistorySize?: number;
};

export const createStoryStateMachine = (
  config: StateMachineConfig = {},
): StoryStateMachine => {
  const {
    initialState = "IDLE",
    guards = {},
    actions = {},
    trackHistory = false,
    maxHistorySize = 50,
  } = config;

  let currentState: StoryState = initialState;
  let pausedFromState: StoryState | null = null; // Track where we paused from
  const listeners: StateChangeListener[] = [];
  const history: StateChangeEvent[] = [];

  const getTransitionKey = (state: StoryState, event: StoryEvent): string => {
    return `${state}:${event}`;
  };

  const canTransition = (event: StoryEvent): boolean => {
    const key = getTransitionKey(currentState, event);
    const nextState = TRANSITIONS[key];

    if (!nextState) {
      return false;
    }

    // Check guard if exists
    const guard = guards[key];
    if (guard && !guard({})) {
      return false;
    }

    return true;
  };

  const getValidEvents = (): StoryEvent[] => {
    const events: StoryEvent[] = [];
    const allEvents: StoryEvent[] = [
      "LOAD_CHAPTER",
      "CHAPTER_LOADED",
      "START_NARRATION",
      "START_MEDIA",
      "START_SILENT_PRESENTATION",
      "START_TRANSITION_DELAY",
      "PAUSE",
      "RESUME",
      "STOP",
      "END",
    ];

    for (const event of allEvents) {
      if (canTransition(event)) {
        events.push(event);
      }
    }

    return events;
  };

  const notifyListeners = (event: StateChangeEvent): void => {
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("[StateMachine] Error in state change listener:", err);
      }
    });
  };

  const addToHistory = (event: StateChangeEvent): void => {
    if (!trackHistory) return;

    history.push(event);

    // Trim history if needed
    if (history.length > maxHistorySize) {
      history.shift();
    }
  };

  const transition = (
    event: StoryEvent,
    context: TransitionContext = {},
  ): boolean => {
    const key = getTransitionKey(currentState, event);
    let nextState = TRANSITIONS[key];

    if (!nextState) {
      console.warn(
        `[StateMachine] Invalid transition: ${currentState} -> ${event}`,
      );
      return false;
    }

    // Check guard
    const guard = guards[key];
    if (guard && !guard(context)) {
      console.warn(
        `[StateMachine] Transition guard failed: ${currentState} -> ${event}`,
      );
      return false;
    }

    // Special handling for PAUSE/RESUME
    if (event === "PAUSE") {
      pausedFromState = currentState;
    } else if (event === "RESUME" && pausedFromState) {
      // Restore previous playing state instead of going to IDLE
      nextState = pausedFromState;
      pausedFromState = null;
    }

    const previousState = currentState;

    // Execute exit action
    const exitAction = actions.onExit?.[previousState];
    if (exitAction) {
      try {
        exitAction(context);
      } catch (err) {
        console.error(
          `[StateMachine] Error in exit action for ${previousState}:`,
          err,
        );
      }
    }

    // Transition to new state
    currentState = nextState;

    // Execute enter action
    const enterAction = actions.onEnter?.[currentState];
    if (enterAction) {
      try {
        enterAction(context);
      } catch (err) {
        console.error(
          `[StateMachine] Error in enter action for ${currentState}:`,
          err,
        );
      }
    }

    // Create state change event
    const stateChangeEvent: StateChangeEvent = {
      from: previousState,
      to: currentState,
      event,
      context,
      timestamp: Date.now(),
    };

    // Add to history
    addToHistory(stateChangeEvent);

    // Notify listeners
    notifyListeners(stateChangeEvent);

    return true;
  };

  const onStateChange = (listener: StateChangeListener): (() => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  };

  const getHistory = (): StateChangeEvent[] => {
    return [...history];
  };

  const reset = (): void => {
    currentState = initialState;
    pausedFromState = null;
    history.length = 0;
  };

  const destroy = (): void => {
    listeners.length = 0;
    history.length = 0;
    pausedFromState = null;
  };

  return {
    getState: () => currentState,
    transition,
    canTransition,
    getValidEvents,
    onStateChange,
    getHistory,
    reset,
    destroy,
  };
};

// ===== Helper Functions =====

/**
 * Check if current state represents an active playback state
 */
export const isPlayingState = (state: StoryState): boolean => {
  return (
    state === "PLAYING_NARRATION" ||
    state === "PLAYING_MEDIA" ||
    state === "PRESENTING_SILENT"
  );
};

/**
 * Check if current state represents a loading state
 */
export const isLoadingState = (state: StoryState): boolean => {
  return state === "LOADING_CHAPTER";
};

/**
 * Check if current state allows pausing
 */
export const canPause = (state: StoryState): boolean => {
  return (
    isPlayingState(state) ||
    state === "TRANSITION_DELAY" ||
    state === "PRESENTING_SILENT"
  );
};

/**
 * Check if current state allows stopping
 */
export const canStop = (state: StoryState): boolean => {
  return state !== "IDLE" && state !== "ENDED";
};

/**
 * Check if current state allows loading a new chapter
 */
export const canLoadChapter = (state: StoryState): boolean => {
  void state;
  return true; // Can always load a new chapter (will cancel current operation)
};
