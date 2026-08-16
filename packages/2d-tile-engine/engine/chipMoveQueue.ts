import type { Direction } from "./types.js";

/**
 * Coalesces rapid direction events (key repeat) into at most one pending step.
 * Flush on key release cancels queued steps so held-input floods do not run after let-go.
 */
export class ChipMoveQueue {
  private pending: Direction | null = null;
  private chain: Promise<void> = Promise.resolve();
  private drainScheduled = false;
  private generation = 0;

  enqueue(direction: Direction, perform: (direction: Direction) => Promise<void>): void {
    this.pending = direction;
    this.scheduleDrain(perform);
  }

  /** Drop queued steps; in-flight perform still finishes once. */
  flush(): void {
    this.generation += 1;
    this.pending = null;
    this.chain = Promise.resolve();
    this.drainScheduled = false;
  }

  private scheduleDrain(perform: (direction: Direction) => Promise<void>): void {
    if (this.drainScheduled) {
      return;
    }
    this.drainScheduled = true;
    const gen = this.generation;
    void (this.chain = this.chain.then(async () => {
      this.drainScheduled = false;
      if (gen !== this.generation) {
        return;
      }
      while (this.pending !== null) {
        const direction = this.pending;
        this.pending = null;
        await perform(direction);
        if (gen !== this.generation) {
          return;
        }
      }
    }));
  }
}
