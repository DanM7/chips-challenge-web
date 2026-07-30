import { readFileSync, writeFileSync } from "fs";

const p =
  "apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-005.json";
const letters =
  "UURUUUULLLLLRRRRRDDDDDDDLLLLLLLUUUWWWWDDDRRURUURRRRUUUULLLLLLLUUURRLLUUURRWWWLLUULLL".split(
    "",
  );
const entry = {
  levelId: "level-005",
  passwordMs: "TQKB",
  title: "Lesson 5",
  timeLimitSeconds: 100,
  boldTimeRemaining: 85,
  minChipMoves: 77,
  moves: letters,
  source: "https://scores.bitbusters.club/levels/cc1/5/ms",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldRouteHint:
    "Open green toggle, rush red key (wait for fireballs), door, brown2 then brown1, wait for glider → exit; 85 left",
  moveVerified: true,
  meetsBoldBudget: true,
  moveSource: "StrategyWiki Lesson 5 bold; engine-verified 85s left (bold 85)",
  simulatedTicks: 76,
  simulatedSecondsRemaining: 85,
};
writeFileSync(p, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
console.log("wrote", p, "moves", letters.length);
