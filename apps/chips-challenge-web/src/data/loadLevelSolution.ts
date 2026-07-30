import type { Direction } from "@engine/types";
import { decodeSolutionMoves } from "@engine/solutionMoves";
import { GAME_PACK_BASE } from "../config/gamePack";

interface SolutionEntry {
  levelId: string;
  moves: string[] | null;
  moveVerified?: boolean;
}

let solutionCache = new Map<number, Promise<Direction[] | null>>();

function loadLevelSolutionEntry(levelNumber: number): Promise<SolutionEntry | null> {
  const id = String(levelNumber).padStart(3, "0");
  return fetch(`${GAME_PACK_BASE}/data/cc1-ms-solutions/level-${id}.json?v=14`)
    .then((res) => {
      if (!res.ok) {
        console.warn(`Failed to load solution for level ${levelNumber}: ${res.status}`);
        return null;
      }
      return res.json() as Promise<SolutionEntry>;
    })
    .catch((err) => {
      console.warn(`Failed to load solution for level ${levelNumber}:`, err);
      return null;
    });
}

/** Recorded solution moves for auto-play / integration (may be null while unsolved). */
export async function loadSolutionMoves(levelNumber: number): Promise<Direction[] | null> {
  let pending = solutionCache.get(levelNumber);
  if (!pending) {
    pending = loadLevelSolutionEntry(levelNumber).then((entry) => {
      if (
        !entry ||
        entry.moveVerified !== true ||
        !Array.isArray(entry.moves) ||
        entry.moves.length === 0
      ) {
        return null;
      }
      return decodeSolutionMoves(entry.moves);
    });
    solutionCache.set(levelNumber, pending);
  }
  return pending;
}

/** Clear cached solutions (e.g. after data file updates in dev). */
export function resetSolutionsCache(): void {
  solutionCache = new Map();
}
