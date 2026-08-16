#!/usr/bin/env python3
"""Export CC1-ms.dac.tws to integration/data/cc1-ms-tws-records.json (tick + direction)."""
import json
import sys
from pathlib import Path

from cc_tools.tws_handler import TWSHandler

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TWS = ROOT / ".tmp/tws/CC1-ms.dac.tws"
OUT = ROOT / "integration/data/cc1-ms-tws-records.json"

DIR_NAMES = ("up", "left", "down", "right")


def main() -> int:
    tws_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TWS
    if not tws_path.is_file():
        print(f"TWS not found: {tws_path}", file=sys.stderr)
        print("Run: node scripts/fetchCc1MsTws.mjs", file=sys.stderr)
        return 1

    replay_set = TWSHandler(str(tws_path)).decode()
    solutions = []
    for rep in replay_set.replays:
        moves = [
            {"tick": m.tick, "direction": m.direction, "dir": DIR_NAMES[m.direction]}
            for m in rep.moves
            if 0 <= m.direction <= 3
        ]
        solutions.append(
            {
                "number": rep.level_number,
                "password": rep.password,
                "moveCount": len(moves),
                "moves": moves,
            }
        )

    doc = {
        "source": str(tws_path),
        "levelset": replay_set.levelset_name,
        "ruleset": replay_set.header.get("ruleset"),
        "solutionCount": len(solutions),
        "solutions": solutions,
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(solutions)} solutions -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
