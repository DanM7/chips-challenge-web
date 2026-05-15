# Game data model (generic engine input)

This document defines how MS Chip's Challenge data becomes **JSON-driven** simulation and UI, without hardcoded classes like `BlueKey` or `BallMonster` in the engine.

See also: [ui-and-hud.md](./ui-and-hud.md) for how level and run state feed the status panel.

## Design goal

The runtime should load three kinds of data:

| Layer | Example path | Purpose |
|-------|----------------|---------|
| **Ruleset** | `rulesets/grid-arcade-v1.json` | Generic mechanics: `collectible`, `gate`, `actor`, systems |
| **Content pack** | `content/ms-cc1.json` | Maps MS object codes → archetypes, params, presentation |
| **Level** | `levels/level-001.json` | One playfield: objectives, entities, links, HUD seed |

```text
CHIPS.DAT → dat parser → ChipLevel (MS-faithful)
              → level compiler (+ content + ruleset) → EngineLevel JSON
              → simulation (future) + presentation (Phaser) + HUD (DOM)
```

The engine never imports `door_blue`; the **content pack** maps `ms:0x16` → `gate` with `{ keyVariant: "blue" }`.

## Archetypes (engine vocabulary)

| Archetype | Role | MS examples (content pack only) |
|-----------|------|----------------------------------|
| `floor` | Walkable default | empty, gravel |
| `obstacle` | Blocks movement | wall, closed toggle |
| `hazard` | Damages actor | fire, water |
| `terrain` | Movement modifier | ice, force, teleport |
| `collectible` | Pickup; may count toward goal | chip, key |
| `tool` | Inventory passive | flippers, fire boots |
| `gate` | Blocks until condition | doors, socket |
| `switch` | Changes world state | buttons, toggle walls |
| `actor` | Autonomous mover | bug, ball, tank |
| `container` | Trap / clone machine | trap, cloner |
| `goal` | Win tile | exit |
| `interactive` | Special scripts | thief, bomb |

Behavior lives in the **ruleset** (`onEnter`, `tryConsumeMatchingKey`, `actorStep`). Variants live in **instance `params`**.

## Ruleset sketch

```json
{
  "id": "grid-arcade-v1",
  "systems": ["grid_movement", "inventory", "gates", "actors", "switches", "objectives", "timer"],
  "archetypes": {
    "collectible": { "onEnter": ["pickup", "maybeCountObjective"] },
    "gate": { "blocksActor": true, "onBlockedByActor": ["tryConsumeMatchingKey"] },
    "actor": { "blocksActor": true, "tick": ["actorStep"] }
  },
  "objectiveTypes": {
    "collectCount": { "tag": "objectiveChip" },
    "reachExit": {}
  }
}
```

## Content pack sketch (`content/ms-cc1.json`)

Maps each MS object code (or stable `ms:0xNN` id) to archetype + tags + presentation:

```json
{
  "id": "ms-cc1",
  "ruleset": "grid-arcade-v1",
  "tiles": {
    "ms:0x64": {
      "archetype": "collectible",
      "tags": ["key"],
      "params": { "keyVariant": "blue" },
      "presentation": { "spritesheet": "ms_tiles", "frameFromObjectCode": true }
    },
    "ms:0x16": {
      "archetype": "gate",
      "params": { "keyVariant": "blue" },
      "blocksActor": true
    }
  },
  "gateMatching": { "rule": "inventoryConsumesMatchingKeyVariant" },
  "actorProfiles": {
    "ms.bug": { "movePolicy": "faceDirectionUntilBlocked" }
  }
}
```

Bulk-generate `tiles` from `src/dat/tiles.ts` plus a hand-maintained overlay for `params.ai` and tags.

## Level JSON (`EngineLevel`)

Compiled output for simulation + HUD seed:

```json
{
  "schemaVersion": 1,
  "id": "level-001",
  "ruleset": "grid-arcade-v1",
  "contentPack": "ms-cc1",
  "size": { "width": 32, "height": 32 },
  "objectives": [
    { "type": "collectCount", "count": 11, "tag": "objectiveChip" },
    { "type": "reachExit" }
  ],
  "limits": { "timeSeconds": 100 },
  "player": { "start": { "x": 12, "y": 14 } },
  "hud": {
    "levelTitle": "LESSON 1",
    "timer": { "mode": "countDown", "initialSeconds": 100 },
    "chipCounter": { "mode": "remaining", "initial": 11 },
    "inventorySlots": ["key_blue", "key_red", "key_green", "key_yellow", "flippers", "fire_boots", "ice_skates", "suction_boots"]
  },
  "entities": [],
  "links": []
}
```

Static cells can stay as a dense grid of content-pack keys during migration; **entities** carry actors; **links** carry optional DAT fields 4 and 5 (trap/clone buttons).

## Extraction sources (MS)

| Source | Data | Today | Target |
|--------|------|-------|--------|
| Layer RLE | Upper/lower object codes | `layers.*` MS strings | Compiled cells / entities |
| Header | time, chips required | `timeLimit`, `chipsRequired` | `limits`, `hud`, `objectives` |
| Field 10 | Monster positions | `monsters[]` | `entities` with `archetype: actor` |
| Field 4 | Brown button ↔ trap | Discarded in parser | `links[]` type `switchOpens` |
| Field 5 | Red button ↔ clone | Discarded | `links[]` type `switchSpawns` |
| Field 3/7 | title, hint | `metadata` | `hud.levelTitle`, UI hint dialog (later) |

Rules (how keys open doors, how bugs move) are **not** in DAT; they live in **ruleset + content pack**, derived once from MS behavior docs / Tile World / `CHIPS.EXE` disassembly.

## Compiler (`src/compile/` — planned)

```text
parseDat → ChipLevel
enrichOptionalFields → trapLinks, cloneLinks
scanGrid → placed tiles
compileLevel(chip, contentPack, ruleset) → EngineLevel
```

Keep `ChipLevel` + `TILE_NAMES` for regression tests. Only compiler output is engine-generic.

## Runtime shape (planned)

```text
Simulation (pure TS)
  WorldGrid, InventorySystem, InteractionSystem, ActorSystem, SwitchSystem, ObjectiveSystem, TimerSystem
PresentationAdapter (Phaser)
  ms_tiles frames from content pack presentation.*
GameHud (DOM)
  Binds to RunState + level.hud seed (see ui-and-hud.md)
```

## Phased rollout

| Phase | Focus |
|-------|--------|
| **UI** | MS-style HUD from extracted level fields ([ui-and-hud.md](./ui-and-hud.md)) |
| **1** | Content pack + compiler; keys, gates, chips, exit, inventory |
| **2** | Links from DAT fields 4/5 |
| **3** | Actors from field 10 + profiles |
| **4** | Terrain (ice, force, teleports) |
| **5** | Tools, hazards, thief, socket |

## Relation to current `LevelData`

Today's `public/.../levels/level-001.json` still uses `layers.upper[]` with MS tile ids for rendering. Migration:

1. Add optional `hud` block at compile time (done in `chipToGameLevel` for static fields).
2. Introduce `EngineLevel` alongside legacy JSON.
3. Move simulation off MS strings; keep presentation resolver in content pack.
