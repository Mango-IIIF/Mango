import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createStoryStateMachine,
  isPlayingState,
  isLoadingState,
  canPause,
  canStop,
  canLoadChapter,
  type StoryStateMachine,
  type StateChangeEvent,
} from '../storyStateMachine';

describe('StoryStateMachine', () => {
  let machine: StoryStateMachine;

  beforeEach(() => {
    machine = createStoryStateMachine();
  });

  describe('Initial State', () => {
    it('should start in IDLE state by default', () => {
      expect(machine.getState()).toBe('IDLE');
    });

    it('should allow custom initial state', () => {
      const customMachine = createStoryStateMachine({
        initialState: 'LOADING_CHAPTER',
      });
      expect(customMachine.getState()).toBe('LOADING_CHAPTER');
    });
  });

  describe('Valid Transitions', () => {
    it('should transition from IDLE to LOADING_CHAPTER on LOAD_CHAPTER', () => {
      expect(machine.transition('LOAD_CHAPTER')).toBe(true);
      expect(machine.getState()).toBe('LOADING_CHAPTER');
    });

    it('should transition from LOADING_CHAPTER to PLAYING_NARRATION', () => {
      machine.transition('LOAD_CHAPTER');
      expect(machine.transition('START_NARRATION')).toBe(true);
      expect(machine.getState()).toBe('PLAYING_NARRATION');
    });

    it('should transition from LOADING_CHAPTER to PLAYING_MEDIA', () => {
      machine.transition('LOAD_CHAPTER');
      expect(machine.transition('START_MEDIA')).toBe(true);
      expect(machine.getState()).toBe('PLAYING_MEDIA');
    });

    it('should transition from LOADING_CHAPTER to PRESENTING_SILENT', () => {
      machine.transition('LOAD_CHAPTER');
      expect(machine.transition('START_SILENT_PRESENTATION')).toBe(true);
      expect(machine.getState()).toBe('PRESENTING_SILENT');
    });

    it('should transition from playing states to PAUSED', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      expect(machine.transition('PAUSE')).toBe(true);
      expect(machine.getState()).toBe('PAUSED');
    });

    it('should transition from PAUSED back to previous playing state on RESUME', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      machine.transition('PAUSE');
      expect(machine.transition('RESUME')).toBe(true);
      expect(machine.getState()).toBe('PLAYING_NARRATION');
    });

    it('should transition from playing states to TRANSITION_DELAY', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      expect(machine.transition('START_TRANSITION_DELAY')).toBe(true);
      expect(machine.getState()).toBe('TRANSITION_DELAY');
    });

    it('should transition from TRANSITION_DELAY to LOADING_CHAPTER', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      machine.transition('START_TRANSITION_DELAY');
      expect(machine.transition('LOAD_CHAPTER')).toBe(true);
      expect(machine.getState()).toBe('LOADING_CHAPTER');
    });

    it('should transition to ENDED from various states', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      expect(machine.transition('END')).toBe(true);
      expect(machine.getState()).toBe('ENDED');
    });

    it('should transition to IDLE on STOP from playing states', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      expect(machine.transition('STOP')).toBe(true);
      expect(machine.getState()).toBe('IDLE');
    });
  });

  describe('Invalid Transitions', () => {
    it('should reject invalid transitions', () => {
      // Can't start narration from IDLE
      expect(machine.transition('START_NARRATION')).toBe(false);
      expect(machine.getState()).toBe('IDLE');
    });

    it('should reject PAUSE from IDLE', () => {
      expect(machine.transition('PAUSE')).toBe(false);
      expect(machine.getState()).toBe('IDLE');
    });

    it('should reject RESUME from non-PAUSED states', () => {
      machine.transition('LOAD_CHAPTER');
      expect(machine.transition('RESUME')).toBe(false);
      expect(machine.getState()).toBe('LOADING_CHAPTER');
    });

    it('should not change state on invalid transition', () => {
      const initialState = machine.getState();
      machine.transition('START_NARRATION'); // Invalid from IDLE
      expect(machine.getState()).toBe(initialState);
    });
  });

  describe('Transition Guards', () => {
    it('should respect guard functions', () => {
      const guardMachine = createStoryStateMachine({
        guards: {
          'IDLE:LOAD_CHAPTER': (context) => {
            return context.chapterIndex !== undefined && context.chapterIndex >= 0;
          },
        },
      });

      // Should fail without valid context
      expect(guardMachine.transition('LOAD_CHAPTER')).toBe(false);
      expect(guardMachine.getState()).toBe('IDLE');

      // Should succeed with valid context
      expect(guardMachine.transition('LOAD_CHAPTER', { chapterIndex: 0 })).toBe(true);
      expect(guardMachine.getState()).toBe('LOADING_CHAPTER');
    });

    it('should allow transition when guard passes', () => {
      const guardMachine = createStoryStateMachine({
        guards: {
          'IDLE:LOAD_CHAPTER': () => true,
        },
      });

      expect(guardMachine.transition('LOAD_CHAPTER')).toBe(true);
      expect(guardMachine.getState()).toBe('LOADING_CHAPTER');
    });

    it('should block transition when guard fails', () => {
      const guardMachine = createStoryStateMachine({
        guards: {
          'IDLE:LOAD_CHAPTER': () => false,
        },
      });

      expect(guardMachine.transition('LOAD_CHAPTER')).toBe(false);
      expect(guardMachine.getState()).toBe('IDLE');
    });
  });

  describe('State Actions', () => {
    it('should execute onEnter actions', () => {
      const onEnter = vi.fn();
      const actionMachine = createStoryStateMachine({
        actions: {
          onEnter: {
            LOADING_CHAPTER: onEnter,
          },
        },
      });

      actionMachine.transition('LOAD_CHAPTER');
      expect(onEnter).toHaveBeenCalledOnce();
    });

    it('should execute onExit actions', () => {
      const onExit = vi.fn();
      const actionMachine = createStoryStateMachine({
        actions: {
          onExit: {
            IDLE: onExit,
          },
        },
      });

      actionMachine.transition('LOAD_CHAPTER');
      expect(onExit).toHaveBeenCalledOnce();
    });

    it('should pass context to actions', () => {
      const onEnter = vi.fn();
      const actionMachine = createStoryStateMachine({
        actions: {
          onEnter: {
            LOADING_CHAPTER: onEnter,
          },
        },
      });

      const context = { chapterIndex: 5 };
      actionMachine.transition('LOAD_CHAPTER', context);
      expect(onEnter).toHaveBeenCalledWith(context);
    });

    it('should handle action errors gracefully', () => {
      const onEnter = vi.fn(() => {
        throw new Error('Action failed');
      });
      const actionMachine = createStoryStateMachine({
        actions: {
          onEnter: {
            LOADING_CHAPTER: onEnter,
          },
        },
      });

      // Should still complete the transition even if action fails
      expect(actionMachine.transition('LOAD_CHAPTER')).toBe(true);
      expect(actionMachine.getState()).toBe('LOADING_CHAPTER');
    });
  });

  describe('State Change Listeners', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      machine.onStateChange(listener);

      machine.transition('LOAD_CHAPTER');

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'IDLE',
          to: 'LOADING_CHAPTER',
          event: 'LOAD_CHAPTER',
        })
      );
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      machine.onStateChange(listener1);
      machine.onStateChange(listener2);

      machine.transition('LOAD_CHAPTER');

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it('should unsubscribe listener', () => {
      const listener = vi.fn();
      const unsubscribe = machine.onStateChange(listener);

      machine.transition('LOAD_CHAPTER');
      expect(listener).toHaveBeenCalledOnce();

      unsubscribe();
      machine.transition('START_NARRATION');
      expect(listener).toHaveBeenCalledOnce(); // Still 1, not called again
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener failed');
      });
      const goodListener = vi.fn();

      machine.onStateChange(errorListener);
      machine.onStateChange(goodListener);

      // Should still notify other listeners even if one fails
      machine.transition('LOAD_CHAPTER');
      expect(errorListener).toHaveBeenCalledOnce();
      expect(goodListener).toHaveBeenCalledOnce();
    });
  });

  describe('canTransition', () => {
    it('should check if transition is valid', () => {
      expect(machine.canTransition('LOAD_CHAPTER')).toBe(true);
      expect(machine.canTransition('START_NARRATION')).toBe(false);
    });

    it('should update as state changes', () => {
      expect(machine.canTransition('START_NARRATION')).toBe(false);
      machine.transition('LOAD_CHAPTER');
      expect(machine.canTransition('START_NARRATION')).toBe(true);
    });
  });

  describe('getValidEvents', () => {
    it('should return all valid events for current state', () => {
      const events = machine.getValidEvents();
      expect(events).toContain('LOAD_CHAPTER');
      expect(events).toContain('END');
      expect(events).not.toContain('START_NARRATION');
    });

    it('should update as state changes', () => {
      machine.transition('LOAD_CHAPTER');
      const events = machine.getValidEvents();
      expect(events).toContain('START_NARRATION');
      expect(events).toContain('START_MEDIA');
      expect(events).toContain('START_SILENT_PRESENTATION');
    });
  });

  describe('History Tracking', () => {
    it('should not track history by default', () => {
      machine.transition('LOAD_CHAPTER');
      expect(machine.getHistory()).toEqual([]);
    });

    it('should track history when enabled', () => {
      const historyMachine = createStoryStateMachine({ trackHistory: true });
      historyMachine.transition('LOAD_CHAPTER');
      historyMachine.transition('START_NARRATION');

      const history = historyMachine.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        from: 'IDLE',
        to: 'LOADING_CHAPTER',
        event: 'LOAD_CHAPTER',
      });
      expect(history[1]).toMatchObject({
        from: 'LOADING_CHAPTER',
        to: 'PLAYING_NARRATION',
        event: 'START_NARRATION',
      });
    });

    it('should limit history size', () => {
      const historyMachine = createStoryStateMachine({
        trackHistory: true,
        maxHistorySize: 2,
      });

      historyMachine.transition('LOAD_CHAPTER');
      historyMachine.transition('START_NARRATION');
      historyMachine.transition('PAUSE');

      const history = historyMachine.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].to).toBe('PLAYING_NARRATION');
      expect(history[1].to).toBe('PAUSED');
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      expect(machine.getState()).toBe('PLAYING_NARRATION');

      machine.reset();
      expect(machine.getState()).toBe('IDLE');
    });

    it('should clear history on reset', () => {
      const historyMachine = createStoryStateMachine({ trackHistory: true });
      historyMachine.transition('LOAD_CHAPTER');
      expect(historyMachine.getHistory()).toHaveLength(1);

      historyMachine.reset();
      expect(historyMachine.getHistory()).toHaveLength(0);
    });
  });

  describe('Destroy', () => {
    it('should clear listeners on destroy', () => {
      const listener = vi.fn();
      machine.onStateChange(listener);
      machine.destroy();

      machine.transition('LOAD_CHAPTER');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Helper Functions', () => {
    describe('isPlayingState', () => {
      it('should return true for playing states', () => {
        expect(isPlayingState('PLAYING_NARRATION')).toBe(true);
        expect(isPlayingState('PLAYING_MEDIA')).toBe(true);
        expect(isPlayingState('PRESENTING_SILENT')).toBe(true);
      });

      it('should return false for non-playing states', () => {
        expect(isPlayingState('IDLE')).toBe(false);
        expect(isPlayingState('LOADING_CHAPTER')).toBe(false);
        expect(isPlayingState('PAUSED')).toBe(false);
      });
    });

    describe('isLoadingState', () => {
      it('should return true for loading state', () => {
        expect(isLoadingState('LOADING_CHAPTER')).toBe(true);
      });

      it('should return false for non-loading states', () => {
        expect(isLoadingState('IDLE')).toBe(false);
        expect(isLoadingState('PLAYING_NARRATION')).toBe(false);
      });
    });

    describe('canPause', () => {
      it('should return true for pausable states', () => {
        expect(canPause('PLAYING_NARRATION')).toBe(true);
        expect(canPause('PLAYING_MEDIA')).toBe(true);
        expect(canPause('PRESENTING_SILENT')).toBe(true);
        expect(canPause('TRANSITION_DELAY')).toBe(true);
      });

      it('should return false for non-pausable states', () => {
        expect(canPause('IDLE')).toBe(false);
        expect(canPause('LOADING_CHAPTER')).toBe(false);
        expect(canPause('PAUSED')).toBe(false);
      });
    });

    describe('canStop', () => {
      it('should return true for stoppable states', () => {
        expect(canStop('LOADING_CHAPTER')).toBe(true);
        expect(canStop('PLAYING_NARRATION')).toBe(true);
        expect(canStop('PAUSED')).toBe(true);
      });

      it('should return false for non-stoppable states', () => {
        expect(canStop('IDLE')).toBe(false);
        expect(canStop('ENDED')).toBe(false);
      });
    });

    describe('canLoadChapter', () => {
      it('should return true for all states', () => {
        expect(canLoadChapter('IDLE')).toBe(true);
        expect(canLoadChapter('LOADING_CHAPTER')).toBe(true);
        expect(canLoadChapter('PLAYING_NARRATION')).toBe(true);
        expect(canLoadChapter('PAUSED')).toBe(true);
        expect(canLoadChapter('ENDED')).toBe(true);
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle full playback cycle', () => {
      // Start
      expect(machine.transition('LOAD_CHAPTER')).toBe(true);
      expect(machine.getState()).toBe('LOADING_CHAPTER');

      // Start playing
      expect(machine.transition('START_NARRATION')).toBe(true);
      expect(machine.getState()).toBe('PLAYING_NARRATION');

      // Pause
      expect(machine.transition('PAUSE')).toBe(true);
      expect(machine.getState()).toBe('PAUSED');

      // Resume
      expect(machine.transition('RESUME')).toBe(true);
      expect(machine.getState()).toBe('PLAYING_NARRATION');

      // Transition to next chapter
      expect(machine.transition('START_TRANSITION_DELAY')).toBe(true);
      expect(machine.getState()).toBe('TRANSITION_DELAY');

      expect(machine.transition('LOAD_CHAPTER')).toBe(true);
      expect(machine.getState()).toBe('LOADING_CHAPTER');
    });

    it('should handle stop during playback', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      expect(machine.transition('STOP')).toBe(true);
      expect(machine.getState()).toBe('IDLE');
    });

    it('should handle end story', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      expect(machine.transition('END')).toBe(true);
      expect(machine.getState()).toBe('ENDED');
    });

    it('should handle restart from ended state', () => {
      machine.transition('LOAD_CHAPTER');
      machine.transition('START_NARRATION');
      machine.transition('END');
      
      // Can load chapter again from ended
      expect(machine.transition('LOAD_CHAPTER')).toBe(true);
      expect(machine.getState()).toBe('LOADING_CHAPTER');
    });
  });
});
