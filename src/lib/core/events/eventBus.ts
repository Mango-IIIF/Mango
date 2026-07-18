import type { ViewerEventBus, ViewerEventMap } from "../types/events";

export type { EventBus, ViewerEventBus, ViewerEventMap } from "../types/events";

export const createEventBus = (): ViewerEventBus => {
  const listeners = new Map<
    keyof ViewerEventMap,
    Set<(payload: unknown) => void>
  >();

  const on: ViewerEventBus["on"] = (event, handler) => {
    const set = listeners.get(event) ?? new Set();
    set.add(handler as (payload: unknown) => void);
    listeners.set(event, set);
    return () => {
      set.delete(handler as (payload: unknown) => void);
    };
  };

  const off: ViewerEventBus["off"] = (event, handler) => {
    const set = listeners.get(event);
    set?.delete(handler as (payload: unknown) => void);
  };

  const emit: ViewerEventBus["emit"] = (event, payload) => {
    const set = listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  };

  return { on, off, emit };
};
