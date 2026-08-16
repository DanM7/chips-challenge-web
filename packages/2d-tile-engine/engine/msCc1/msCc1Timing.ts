import { MS_MOVES_PER_GAME_SECOND } from "./msCc1Monsters.js";

/**
 * MS in-game seconds remaining after `moveBoundary` ticks (5 ticks = 1 second).
 * @see https://wiki.bitbusters.club/In-game_second
 */
export function msSecondsRemaining(
  timeLimitSeconds: number,
  moveBoundary: number,
): number {
  if (timeLimitSeconds <= 0) {
    return 0;
  }
  const elapsed = Math.floor(moveBoundary / MS_MOVES_PER_GAME_SECOND);
  return Math.max(0, timeLimitSeconds - elapsed);
}
