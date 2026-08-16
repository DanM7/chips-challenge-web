import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DirectionInput } from "../engine/DirectionInput.js";
import { GameEventBus } from "../engine/GameEventBus.js";

const windowListeners = new Map<string, Set<EventListener>>();

function keyEvent(key: string, repeat = false): KeyboardEvent {
  return { key, repeat, preventDefault: () => {} } as KeyboardEvent;
}

function dispatchKey(type: "keydown" | "keyup", key: string, repeat = false): void {
  const event = keyEvent(key, repeat);
  windowListeners.get(type)?.forEach((listener) => listener(event));
}

describe("DirectionInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    windowListeners.clear();
    vi.stubGlobal("window", {
      addEventListener(type: string, listener: EventListener) {
        let set = windowListeners.get(type);
        if (!set) {
          set = new Set();
          windowListeners.set(type, set);
        }
        set.add(listener);
      },
      removeEventListener(type: string, listener: EventListener) {
        windowListeners.get(type)?.delete(listener);
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("repeats direction while an arrow key is held", () => {
    const bus = new GameEventBus();
    const input = new DirectionInput(bus);
    const steps: string[] = [];
    bus.onDirection((d) => steps.push(d));
    input.bindKeyboard();

    dispatchKey("keydown", "ArrowRight");
    expect(steps).toEqual(["right"]);

    vi.advanceTimersByTime(200);
    expect(steps).toEqual(["right", "right"]);

    vi.advanceTimersByTime(200);
    expect(steps).toEqual(["right", "right", "right"]);

    dispatchKey("keyup", "ArrowRight");
    vi.advanceTimersByTime(500);
    expect(steps).toHaveLength(3);

    input.dispose();
  });

  it("ignores OS key-repeat keydown events", () => {
    const bus = new GameEventBus();
    const input = new DirectionInput(bus);
    const steps: string[] = [];
    bus.onDirection((d) => steps.push(d));
    input.bindKeyboard();

    dispatchKey("keydown", "ArrowRight");
    expect(steps).toHaveLength(1);

    dispatchKey("keydown", "ArrowRight", true);
    dispatchKey("keydown", "ArrowRight", true);
    vi.advanceTimersByTime(60);
    expect(steps).toHaveLength(1);

    vi.advanceTimersByTime(200);
    expect(steps).toHaveLength(2);

    input.dispose();
  });

  it("switches to the most recently pressed direction", () => {
    const bus = new GameEventBus();
    const input = new DirectionInput(bus);
    const steps: string[] = [];
    bus.onDirection((d) => steps.push(d));
    input.bindKeyboard();

    dispatchKey("keydown", "ArrowRight");
    dispatchKey("keydown", "ArrowDown");
    expect(steps).toEqual(["right", "down"]);

    vi.advanceTimersByTime(200);
    expect(steps.at(-1)).toBe("down");

    dispatchKey("keyup", "ArrowDown");
    vi.advanceTimersByTime(200);
    expect(steps.at(-1)).toBe("right");

    input.dispose();
  });

  it("emits one step from a horizontal swipe on the playfield", () => {
    const bus = new GameEventBus();
    const input = new DirectionInput(bus);
    const steps: string[] = [];
    bus.onDirection((d) => steps.push(d));

    const listeners = new Map<string, Set<(e: PointerEvent) => void>>();
    const el = {
      addEventListener(type: string, fn: (e: PointerEvent) => void) {
        let set = listeners.get(type);
        if (!set) {
          set = new Set();
          listeners.set(type, set);
        }
        set.add(fn);
      },
      removeEventListener(type: string, fn: (e: PointerEvent) => void) {
        listeners.get(type)?.delete(fn);
      },
    } as unknown as HTMLElement;

    input.bindSwipe(el);
    listeners.get("pointerdown")?.forEach((fn) =>
      fn({ pointerId: 1, clientX: 100, clientY: 100, button: 0 } as PointerEvent),
    );
    listeners.get("pointerup")?.forEach((fn) =>
      fn({ pointerId: 1, clientX: 140, clientY: 105, button: 0 } as PointerEvent),
    );
    expect(steps).toEqual(["right"]);

    input.dispose();
  });
});
