import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';

interface Map {
  hello: string;
  count: number;
}

describe('EventBus', () => {
  it('emits to subscribed handlers', () => {
    const bus = new EventBus<Map>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('hello', a);
    bus.on('hello', b);
    bus.emit('hello', 'world');
    expect(a).toHaveBeenCalledWith('world');
    expect(b).toHaveBeenCalledWith('world');
  });

  it('off() removes a handler', () => {
    const bus = new EventBus<Map>();
    const a = vi.fn();
    const unsub = bus.on('count', a);
    unsub();
    bus.emit('count', 1);
    expect(a).not.toHaveBeenCalled();
  });

  it('allows handlers to unsubscribe during emit', () => {
    const bus = new EventBus<Map>();
    const calls: string[] = [];
    const unA = bus.on('hello', (p) => {
      calls.push(`a:${p}`);
      unA();
    });
    bus.on('hello', (p) => calls.push(`b:${p}`));
    bus.emit('hello', 'x');
    bus.emit('hello', 'y');
    expect(calls).toEqual(['a:x', 'b:x', 'b:y']);
  });
});
