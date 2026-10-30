import type { EventBus, ViewerEventMap } from "../types/events";

export type { EventBus, ViewerEventBus, ViewerEventMap } from "../types/events";

export const createEventBus = <
  EventMap extends Record<string, unknown> = ViewerEventMap,
>(): EventBus<EventMap> => {
  const listeners = new Map<
    keyof EventMap,
    Set<(payload: unknown) => void>
  >();

  const on: EventBus<EventMap>["on"] = (event, handler) => {
    const set = listeners.get(event) ?? new Set();
    set.add(handler as (payload: unknown) => void);
    listeners.set(event, set);
    return () => {
      set.delete(handler as (payload: unknown) => void);
    };
  };

  const off: EventBus<EventMap>["off"] = (event, handler) => {
    const set = listeners.get(event);
    set?.delete(handler as (payload: unknown) => void);
  };

  const emit: EventBus<EventMap>["emit"] = (event, payload) => {
    const set = listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  };

  return { on, off, emit };
};
