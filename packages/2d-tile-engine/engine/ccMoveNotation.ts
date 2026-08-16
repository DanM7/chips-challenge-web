import type { Direction } from "./types.js";

const DIR_MAP: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
  l: "left",
  r: "right",
  u: "up",
  d: "down",
};

const MS_DIR_MAP: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};

function skipWaitChars(raw: string, i: number): number {
  while (i < raw.length && (raw[i] === " " || raw[i] === "," || raw[i] === ".")) {
    i += 1;
  }
  return i;
}

/**
 * Parse CC player / TWS move strings (see tws2json format.txt).
 * Waits (`,` `.`) are ignored — only chip direction inputs are returned.
 */
export function parseCcMoveString(raw: string): Direction[] {
  const moves: Direction[] = [];
  let i = 0;
  while (i < raw.length) {
    i = skipWaitChars(raw, i);
    if (i >= raw.length) break;

    const numMatch = /^\d+/.exec(raw.slice(i));
    let count = 1;
    if (numMatch) {
      count = Number.parseInt(numMatch[0], 10);
      i += numMatch[0].length;
    }
    i = skipWaitChars(raw, i);
    if (i >= raw.length) break;

    const dirCh = raw[i]!;
    const dir = DIR_MAP[dirCh];
    if (dir) {
      for (let n = 0; n < count; n += 1) {
        moves.push(dir);
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return moves;
}

/**
 * MS ruleset: only uppercase LRUD are full chip steps; lowercase is sub-frame
 * timing and is ignored for headless replay (see tws2json format.txt).
 */
export function parseCcMoveStringMs(raw: string): Direction[] {
  const moves: Direction[] = [];
  let i = 0;
  while (i < raw.length) {
    i = skipWaitChars(raw, i);
    if (i >= raw.length) break;

    const numMatch = /^\d+/.exec(raw.slice(i));
    let count = 1;
    if (numMatch) {
      count = Number.parseInt(numMatch[0], 10);
      i += numMatch[0].length;
      i = skipWaitChars(raw, i);
      if (i >= raw.length) break;
    }

    const dirCh = raw[i]!;
    const dir = MS_DIR_MAP[dirCh];
    if (dir) {
      for (let n = 0; n < count; n += 1) {
        moves.push(dir);
      }
      i += 1;
      if (raw[i] === "3" && raw[i + 1] === ",") {
        i += 2;
      }
      continue;
    }
    i += 1;
  }
  return moves;
}
