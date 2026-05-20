import type { Direction } from "@engine/types";

export const MS_TILES_KEY = "ms_tiles";

export const CHIP_WALK_FRAME: Record<Direction, string> = {
  up: "chip_n",
  down: "chip_s",
  left: "chip_w",
  right: "chip_e",
};

export const CHIP_SWIM_FRAME: Record<Direction, string> = {
  up: "chip_swim_n",
  down: "chip_swim_s",
  left: "chip_swim_w",
  right: "chip_swim_e",
};
