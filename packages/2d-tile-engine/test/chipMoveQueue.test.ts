import { describe, expect, it } from "vitest";
import { ChipMoveQueue } from "../engine/chipMoveQueue.js";

describe("ChipMoveQueue", () => {
  it("coalesces rapid enqueues into one perform per drain cycle", async () => {
    const queue = new ChipMoveQueue();
    const performed: string[] = [];

    queue.enqueue("right", async () => {
      performed.push("right");
    });
    queue.enqueue("right", async () => {
      performed.push("right-2");
    });
    queue.enqueue("right", async () => {
      performed.push("right-3");
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(performed).toEqual(["right"]);
  });

  it("flush cancels queued steps after release", async () => {
    const queue = new ChipMoveQueue();
    const performed: string[] = [];
    let resolveMove: (() => void) | null = null;
    const moveStarted = new Promise<void>((resolve) => {
      resolveMove = resolve;
    });

    queue.enqueue("right", async () => {
      performed.push("start");
      await moveStarted;
      performed.push("done");
    });
    queue.enqueue("right", async () => {
      performed.push("queued");
    });

    await Promise.resolve();
    expect(performed).toEqual(["start"]);

    queue.flush();
    queue.enqueue("up", async () => {
      performed.push("up");
    });
    resolveMove?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(performed).toEqual(["start", "up", "done"]);
    expect(performed).not.toContain("queued");
  });
});
