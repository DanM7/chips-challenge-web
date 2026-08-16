import type { Direction } from "./types.js";

/** Uppercase move letters; `W` = idle monster tick (no Chip step). */
export type SolutionMoveLetter = "U" | "D" | "L" | "R" | "W";

export type SolutionAction = Direction | "wait";

const TO_LETTER: Record<Direction, Exclude<SolutionMoveLetter, "W">> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

const TO_DIRECTION: Record<Exclude<SolutionMoveLetter, "W">, Direction> = {
  U: "up",
  D: "down",
  L: "left",
  R: "right",
};

const LEGACY: Record<string, Direction> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

export function encodeSolutionMoves(
  moves: readonly (SolutionAction | SolutionMoveLetter)[],
): SolutionMoveLetter[] {
  return moves.map((move) => {
    if (move === "wait" || move === "W") {
      return "W";
    }
    if (move in TO_DIRECTION) {
      return move as Exclude<SolutionMoveLetter, "W">;
    }
    return TO_LETTER[move as Direction];
  });
}

export function decodeSolutionMoves(moves: readonly string[]): SolutionAction[] {
  return moves.map((move) => {
    if (move === "W" || move === "wait" || move === ".") {
      return "wait";
    }
    const fromLetter = TO_DIRECTION[move as Exclude<SolutionMoveLetter, "W">];
    if (fromLetter) {
      return fromLetter;
    }
    const legacy = LEGACY[move];
    if (legacy) {
      return legacy;
    }
    throw new Error(`Invalid solution move: ${move}`);
  });
}
