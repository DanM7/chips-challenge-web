import type { Direction } from "./types";

/**
 * Lightweight bus so DOM input and Phaser scenes stay decoupled.
 * Any future game can reuse this for UI ↔ core communication.
 */
export class GameEventBus extends EventTarget {
  emitDirection(direction: Direction): void {
    this.dispatchEvent(new CustomEvent("direction", { detail: direction }));
  }

  emitDirectionRelease(): void {
    this.dispatchEvent(new CustomEvent("direction-release"));
  }

  onDirection(handler: (direction: Direction) => void): () => void {
    const listener = (event: Event): void => {
      const { detail } = event as CustomEvent<Direction>;
      handler(detail);
    };
    this.addEventListener("direction", listener);
    return () => this.removeEventListener("direction", listener);
  }

  onDirectionRelease(handler: () => void): () => void {
    const listener = (): void => handler();
    this.addEventListener("direction-release", listener);
    return () => this.removeEventListener("direction-release", listener);
  }
}
