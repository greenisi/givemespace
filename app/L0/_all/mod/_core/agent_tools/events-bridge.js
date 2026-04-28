// space.events.* — workflow event bus for Phase 8 self-evolving learning.
//
// STATUS: Phase 8 stub. The real implementation:
//   - emit(eventType, target, params) writes a row to event_log table
//   - emits a CustomEvent on globalThis for live listeners (UI, ghost
//     cursor coordinator, etc.)
//   - server-side pattern detector reads the table on a daily/Nth-event
//     cadence to surface skill-candidate suggestions
//
// Tonight: the API shape is locked, the implementation is no-op so calls
// don't break in skill files that pre-emptively start emitting events.

let listeners = [];

export function emit(eventType, target, params) {
  const event = {
    type: String(eventType || ""),
    target: String(target || ""),
    params: params && typeof params === "object" ? params : {},
    ts: Date.now()
  };
  // No-op write to event_log for now (Phase 8 wires the table).
  // Notify any in-process subscribers (e.g. ghost cursor).
  listeners.forEach((fn) => {
    try { fn(event); } catch {}
  });
  try {
    globalThis.dispatchEvent?.(
      new CustomEvent("gms:agent-event", { detail: event })
    );
  } catch {}
}

export function subscribe(fn) {
  if (typeof fn !== "function") return () => {};
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export default { emit, subscribe };
