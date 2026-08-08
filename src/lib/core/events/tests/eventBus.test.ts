import { describe, it, expect } from 'vitest';
import { createEventBus } from '../eventBus';

describe('eventBus', () => {
  it('subscribes and emits payloads', () => {
    const bus = createEventBus();
    let called = false;
    const unsubscribe = bus.on('manifestChange', (payload) => {
      called = payload.manifestId === 'demo';
    });

    bus.emit('manifestChange', { manifestId: 'demo' });
    expect(called).toBe(true);

    unsubscribe();
    called = false;
    bus.emit('manifestChange', { manifestId: 'demo' });
    expect(called).toBe(false);
  });
});
