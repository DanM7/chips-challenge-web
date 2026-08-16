import { describe, expect, it, vi } from "vitest";
import { RunSession } from "../engine/RunSession.js";

describe("RunSession", () => {
  it("emits initial state and counts down play clock", () => {
    vi.useFakeTimers();
    const states: Array<{ playClockSeconds: number | null; collectiblesLeftCount: number }> = [];
    const session = new RunSession(
      {
        levelNumber: 1,
        playClockInitialSeconds: 3,
        collectiblesInitialCount: 5,
      },
      (s) => states.push({ playClockSeconds: s.playClockSeconds, collectiblesLeftCount: s.collectiblesLeftCount }),
    );

    const scene = {
      time: {
        addEvent: (config: { delay: number; loop: boolean; callback: () => void }) => {
          const id = setInterval(config.callback, config.delay);
          return { destroy: () => clearInterval(id) };
        },
      },
    } as unknown as Phaser.Scene;

    session.start(scene);
    expect(states[0]).toEqual({ playClockSeconds: 3, collectiblesLeftCount: 5 });

    vi.advanceTimersByTime(1000);
    expect(states.at(-1)?.playClockSeconds).toBe(3);

    session.startPlayClock(scene);
    vi.advanceTimersByTime(1000);
    expect(states.at(-1)?.playClockSeconds).toBe(2);

    session.collectOne();
    expect(states.at(-1)?.collectiblesLeftCount).toBe(4);

    expect(session.tryAddKey("key_blue")).toBe(true);
    expect(session.getState().inventory?.keys).toEqual(["key_blue"]);
    expect(session.tryAddKey("key_blue")).toBe(true);
    expect(session.getState().inventory?.keys).toEqual(["key_blue", "key_blue"]);
    expect(session.tryAddKey("key_red")).toBe(true);
    expect(session.getState().inventory?.keys).toEqual([
      "key_blue",
      "key_blue",
      "key_red",
    ]);

    expect(session.consumeKey("key_blue")).toBe(true);
    expect(session.getState().inventory?.keys).toEqual(["key_blue", "key_red"]);
    expect(session.hasKey("key_blue")).toBe(true);

    session.stop();
    vi.useRealTimers();
  });
});
