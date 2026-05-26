/**
 * EventBus — minimal typed pub/sub.
 *
 * One bus per Chart instance. No globals.
 */
export type EventHandler<P> = (payload: P) => void;

export class EventBus<EventMap extends Record<string, unknown> = Record<string, unknown>> {
  private handlers: Map<keyof EventMap, Set<EventHandler<unknown>>> = new Map();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // snapshot to allow handlers to unsubscribe during emit
    for (const h of [...set]) (h as EventHandler<EventMap[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
