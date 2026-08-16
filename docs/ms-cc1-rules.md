# MS Chip's Challenge rules checklist

Living reference for **Microsoft CC1** gameplay behavior in this project. Use it to find gaps before playtesting, to add regression tests, and to align `content/ms-cc1.json` with `tryMsCc1Move` in **packages/2d-tile-engine**.

Related: [game-data-model.md](./game-data-model.md) (target JSON/ruleset architecture), [ui-and-hud.md](./ui-and-hud.md) (HUD only).

## Status legend

| Mark | Meaning |
|------|---------|
| **done** | Implemented and covered by at least one automated test |
| **partial** | Some cases work; MS edge cases or tick systems missing |
| **todo** | Documented in content pack or appears on exported levels; not simulated |
| **n/a** | Not used in current level export range |

## Where behavior lives today

| Layer | Location |
|-------|----------|
| Player step (keys, doors, socket, blocks, exit) | `packages/2d-tile-engine/engine/msCc1/msCc1Movement.ts` → `tryMsCc1Move` |
| Static blocking / layers | `packages/2d-tile-engine/engine/levelRuntime.ts` |
| Tile ids, door↔key, green key rule | `packages/2d-tile-engine/tile-engine/tiles.ts` |
| Content mapping (intended behavior) | `apps/.../content/ms-cc1.json` |
| Phaser wiring | `apps/chips-challenge-web/src/scenes/PlayScene.ts` |
| Regression tests | `packages/2d-tile-engine/test/msCc1Movement.test.ts`, `msKeyRules.test.ts` |
| DAT fidelity (counts, not rules) | `cc1-asset-extraction-pipeline/test/lesson1Keys.test.ts` |

Long term, rows below should compile from **ruleset + content pack** instead of growing ad-hoc branches in `tryMsCc1Move`.

---

## How to detect missing rules (without playtesting every level)

1. **Level hint** — `levels/level-NNN.json` → `metadata.hint`. If the hint mentions a verb (push, swim, dodge), that mechanic should be **done** or explicitly **todo** with a smoke test planned.
2. **Tile inventory** — Scan `layers.upper` / `layers.lower` for tile ids not marked **done** in the matrix below. First lesson level that introduces a tile is the best smoke-test source.
3. **Content pack gap** — Entry in `ms-cc1.json` with `archetype` / `params` but no matching branch in `tryMsCc1Move` → implementation debt.
4. **Archetype vs engine** — [game-data-model.md](./game-data-model.md) archetypes (`hazard`, `actor`, `terrain`) without a system → **todo**.
5. **Add a test when fixing** — Prefer a minimal grid in `msCc1Movement.test.ts` or a DAT-derived layout (coordinates from exported JSON).

---

## Rules matrix (Chip movement & interaction)

### Objectives & win

| Rule | MS behavior | Status | Test / notes |
|------|-------------|--------|----------------|
| Collect chip | Pick up `chip`; decrement chips remaining | **done** | `tryMsCc1Move` + run session counter |
| Chip socket | Block Chip while any chips remain on map; clear socket when 0 | **done** | `msCc1Movement.test.ts` socket case |
| Exit | Enter exit only when chips remaining = 0; complete level | **done** | exit blocked / complete tests |
| Timer | Level fails when time hits 0 | **todo** | HUD shows timer; no fail state |
| Password / score | MS password screen | **n/a** | Out of scope for web prototype |

### Keys & doors

| Rule | MS behavior | Status | Test / notes |
|------|-------------|--------|----------------|
| Pick up key | Add to inventory; remove from map | **done** | LESSON 1 |
| Open door with matching key | Door removed; Chip steps in | **done** | |
| Blue / red / yellow key consumed | Key removed from inventory on use | **done** | `msKeyRules.test.ts` |
| Green key reusable | Not consumed; opens many green doors | **done** | `msCc1Movement.test.ts` green doors |
| Wrong key / no key | Movement blocked | **done** | |

### Blocks & terrain (LESSON 2+)

| Rule | MS behavior | Status | Test / notes |
|------|-------------|--------|----------------|
| Push `block_movable` | Chip moves into block cell if push succeeds | **done** | LESSON 2 layout test (21,12)→left |
| Push into empty floor | Block moves one cell | **done** | |
| Push into water | **Wet dirt**: dirt on upper, water stays on lower | **done** | wet dirt tests |
| Chip steps on dirt | Dries to permanent floor (removes dirt + under-water) | **done** | stays dry after leave |
| Push onto dirt / wet dirt | Blocks cannot push onto dirt | **done** | wet dirt + placed dirt tests |
| Push blocked | Wall, door, socket (chips left), monster, another block, chip, key | **done** | wall block test |
| Block chain (2+ blocks in row) | All slide if destination clear | **todo** | Single-block push only |
| Push into fire / bomb / trap | MS interactions | **todo** | |
| `block_blue_tile` / `block_blue_wall` | MS block variants | **todo** | |
| `block_toggle_open` / `block_toggle_closed` | Toggle walls | **todo** | |
| Walk on dirt / gravel | Walkable | **done** | Treated as floor for push dest |
| Start cell `chip_*` marker | Clears to floor when Chip leaves | **done** | `clearChipMarkerOnDepart` |
| Walk on water (no flippers) | Drown; water → `chip_drowning`; Oops + BUMMER; restart | **done** | `MS_DEATH_NO_FLIPPERS`, PlayScene |
| Flippers | Swim on water (no drown) | **done** | Inventory `tools`; HUD shows flippers |
| Fire / fire boots | Burn vs immunity | **todo** | |
| Ice / ice skates | Slide until floor or ice corner; skates cancel slide | **done** | `msCc1Sliding.ts`, movement tests |
| Force floors | Slide in arrow direction without suction boots | **done** | `force_n/s/e/w` |
| Force override | MS: Chip walks against/off a force floor with voluntary input; involuntary slides still ride the arrow | **done** | `msCc1Movement.test.ts` override cases; Trinity (11,20)→north |
| Teleport | Blue teleport network (see **Blue teleport (MS CC1)** below) | **done** | `msCc1Teleports.ts`, `msCc1Teleports.test.ts` |
| Thin walls (`blocked_*`) | Directional blocking | **todo** | In `BLOCKING_TILE_IDS` for static block only |
| Invisible wall | Blocks like wall | **partial** | Blocked if in `BLOCKING_TILE_IDS` |
| `wall_appearing` ($2C) | Chip may step once → permanent `wall` | **done** | `MS_POPUP_WALL_TILE_IDS` |
| `hint_tile` ($2E pass-once) | Same as pop-up wall (DAT id is a misnomer) | **done** | Lesson 7 recessed walls |

### Monsters & actors

| Rule | MS behavior | Status | Test / notes |
|------|-------------|--------|----------------|
| Monsters block Chip | Step or post-move collision → death | **done** (bugs) | `MS_DEATH_CREATURES`; monster tick after Chip move |
| Monster tick / movement | DAT list order; **5 moves per game second** (200 ms) | **partial** | Bugs, tanks, glider, fireball, ball, **walker**, **teeth (frog)** |
| Teeth (`frog_*`) | Chase Chip; odd/even step on **Chip-move** ticks only; dirt + gravel block; ignore Chip on ice/force slide | **done** | `advanceTeethBoundary` in `tickMsCc1Monsters`; idle clock moves fire/other monsters |
| Monster vs block | Blocks stop monsters; MS kill rules | **partial** | Dirt + gravel block monsters; water kills bug |
| Clone / trap / brown-red buttons | DAT fields 4–5 links | **todo** | Parser can expose links later |

### Tools & specials

| Rule | MS behavior | Status | Test / notes |
|------|-------------|--------|----------------|
| Thief | Steals all boots (not keys); tile stays | **done** | `applyThiefSteal` in `msCc1Movement.ts` |
| Bomb | Explosion chain | **todo** | |
| Hint tile | Show level hint | **todo** | Hint only in metadata today |
| Suction boots | MS suction behavior | **todo** | |

### Input & session

| Rule | MS behavior | Status | Test / notes |
|------|-------------|--------|----------------|
| Grid step (one cell per successful move) | No diagonal | **done** | |
| Hold arrow to repeat | Repeat step on interval | **done** | `DirectionInput.ts` |
| Level advance on exit | Load next level in index | **done** | `PlayScene` |

---

## Content pack ↔ implementation

`apps/chips-challenge-web/public/games/chips-challenge-1/content/ms-cc1.json` (phase 1 subset):

| Tile id | Archetype | Params | Engine status |
|---------|-----------|--------|----------------|
| `chip` | collectible | objectiveChip | **done** |
| `key_*` | collectible | keyVariant | **done** |
| `door_*` | gate | keyVariant, consumesKey | **done** (green `consumesKey: false`) |
| `socket` | gate | requiresChipsRemaining: 0 | **done** |
| `exit` | goal | requiresChipsRemaining: 0 | **done** |
| `block_movable` | obstacle | pushable | **done** (no chain) |
| `water` | hazard | blockBecomesDirt | **done** (block→dirt; Chip drown→`chip_drowning`) |
| `dirt` | floor | — | **done** |

Tiles on maps but not in content pack yet should get entries when behavior is implemented.

---

## Level smoke tests (exported CC1 lessons)

Run engine tests: `npm run test:engine -- test/msCc1Movement.test.ts`

| Level | Title | Hint (abridged) | Scenarios to keep green | Status |
|-------|-------|-----------------|-------------------------|--------|
| 001 | LESSON 1 | Chips, socket, keys, doors | Pick chips; socket blocks until 0; green key opens two green doors; exit when done | **done** (manual + unit tests) |
| 002 | LESSON 2 | Push blocks into water; monsters | From Chip start `(21,12)`, push left: block → water → dirt at `(19,12)` | **done** (push); monsters **todo** |
| 003 | LESSON 3 | Boots: suction, fire, flippers, skates | Exported; rules TBD | **todo** |
| 004 | LESSON 4 | (per `metadata.hint`) | Exported | **todo** |
| 005–006 | LESSON 5–6 | (per hint) | Exported | **todo** |
| 007 | LESSON 7 | Teleports, thief, appearing walls | Teleport **done**; thief at (13,10), (17,18) **done**; walls **todo** |
| 008 | LESSON 8 | Teeth, gravel vs dirt | Teeth chase **done** | `frog_n` at (9,14); even-step default |
| 009 | NUTS AND BOLTS | (per hint) | Exported | **todo** |
| 010 | BRUSHFIRE | (per hint) | Exported | **todo** |

### LESSON 1 — regression checklist

- [x] Cannot pass socket with chips remaining on map.
- [x] Socket clears when stepping on it with 0 chips left.
- [x] Green key stays in inventory after opening two green doors.
- [x] Exit completes only when chips remaining = 0.
- [x] DAT: 1× `key_green`, 2× `door_green` (extraction) — `lesson1Keys.test.ts`.

### LESSON 2 — regression checklist

- [x] Push `block_movable` west from `(21,12)` into water → dirt at `(19,12)`.
- [x] Bugs move (left-wall) after each Chip step; field-10 list order.
- [x] Chip dies on bug contact (step on bug or bug steps on Chip).
- [x] Chip drowns on water without flippers (splash tile + Oops + BUMMER + restart).

---

## Blue teleport (MS CC1)

Tile id: `teleport` (object code `0x29`). CC1 has only this color; all blue teleports on a level share one **unwired** network.

**Sources:** [BitBusters — Blue teleport](https://wiki.bitbusters.club/Blue_teleport), [Reading order](https://wiki.bitbusters.club/Reading_order), [Partial posting](https://wiki.bitbusters.club/Partial_posting), [StrategyWiki general hints](https://strategywiki.org/wiki/Chip%27s_Challenge/General_hints), [Tile World MS vs Lynx](http://www.muppetlabs.com/~breadbox/software/tworld/rulecomp.html).

### When it triggers

- Applies to **movable objects** (Chip, monsters, blocks) that **enter** a teleport tile as part of a move (walking or **involuntary slide** from ice, force floor, or another teleport).
- Behaves like a **sliding tile** for movement timing (involuntary); in MS, Chip can **boost** on the move immediately after a teleport exit ([BitBusters](https://wiki.bitbusters.club/Blue_teleport)).

### Destination search (reverse wrappable reading order)

1. Let `T_in` be the entrance teleport cell and `D` the direction the object was moving **into** `T_in` (e.g. sliding south → `D = south`).
2. Find the **next** teleport in **reverse wrappable reading order** after `T_in`:
   - Within a row: decreasing `x` (right → left).
   - At column 0: continue at `x = 31` on the row **above** (`y - 1`).
   - At northwest `(0, 0)`: **wrap** to southeast `(31, 31)` and continue.
3. For each candidate `T_out` (in order), try to use it as the exit:
   - **Exit side:** object leaves `T_out` on the face **opposite** to `D` (entered from north → exit south from `T_out`).
   - **Validity:** skip `T_out` if any of these fail (search continues to the next teleport):
     - `T_out` is **not a functioning teleport** (see below).
     - The cell on the exit face of `T_out` is **blocked** for that object (walls, closed door, block, etc.).
     - In MS, the teleport is **covered** (something on the upper layer hides it — hidden teleports act as ice; see StrategyWiki “General hints”).
     - The **Twice Step Glitch** is active (edge case; ignore until base behavior works).
4. **First valid** `T_out` wins: object is moved to `T_out` and continues out the exit face (same tick / slide chain as MS ice).

> **Note:** Level editors (CCLD, etc.) draw a line to the “next” teleport in sequence; that link can be **illegal** if the exit face is blocked — the game keeps searching forward in reverse RO ([Partial posting](https://wiki.bitbusters.club/Partial_posting)).

### No valid exit (search returns to `T_in`)

| Object | MS behavior |
|--------|-------------|
| **Chip** | Teleport acts like **non-directional ice**: slide across `T_in` if legal, otherwise **bounce back** to the tile before `T_in` ([Tile World rulecomp](http://www.muppetlabs.com/~breadbox/software/tworld/rulecomp.html)). |
| **Block / monster** | If the “bounce back” case applies, the object can **stick on** `T_in` and that teleport **stops working** ([BitBusters](https://wiki.bitbusters.club/Blue_teleport)). |
| **Any (Lynx)** | Differs: often treats as floor / stuck Chip; not our target ruleset. |

### Non-functioning teleports (MS)

| Case | Behavior |
|------|----------|
| **`teleport` on lower layer only** | Does not teleport; acts as **ice** (same as self-redirect) ([BitBusters](https://wiki.bitbusters.club/Blue_teleport)). |
| **Hidden / covered** (upper object hides teleport) | Acts as **ice**; does not participate in network ([StrategyWiki](https://strategywiki.org/wiki/Chip%27s_Challenge/General_hints)). |
| **Stuck block/monster** on teleport | That cell’s teleport ceases to function. |

LESSON 7 exports all four teleports on **upper** at `(15,14)`, `(17,14)`, `(15,16)`, `(17,16)`.

### Partial posting (design technique)

Blocking the **exit face** of a teleport (block, wall, chip, closed toggle, etc.) forces the network to skip that `T_out` and use the **next** teleport in reverse RO — used in level “Partial Post” ([wiki](https://wiki.bitbusters.club/Partial_posting)). Not a separate tile type; falls out of the search rules above.

### Interaction with other systems

| System | Interaction |
|--------|-------------|
| **Ice / force** | Can slide **into** teleports; teleport exit continues slide chain. |
| **Force → teleport → force** | MS: second force in sequence can be **overridden** on the tick after teleport (boost / voluntary move); Lynx differs ([BitBusters](https://wiki.bitbusters.club/Blue_teleport)). |
| **Monsters** | Same search; MS may hold creature on entrance teleport if no exit ([rulecomp](http://www.muppetlabs.com/~breadbox/software/tworld/rulecomp.html)). |
| **Blocks** | Can be pushed through teleports; partial posting uses blocks to block exits. |
| **Audio** | `TELEPORT.WAV` on use (`assets.json` → `teleport`). |

### Implementation (engine)

- `packages/2d-tile-engine/engine/msCc1/msCc1Teleports.ts` — `reverseWrappableNext`, `resolveBlueTeleport`, `canChipStepOnto`.
- `tryMsCc1Move` — `tryTeleportAfterLanding` after each step onto a pad (warp / through / bounce).
- Tests: `packages/2d-tile-engine/test/msCc1Teleports.test.ts`.
- PlayScene: optional `teleport` sound on non-adjacent step (if wired).

### CC2-only (out of scope)

Red / green / yellow teleports, wires, logic gates — see [BitBusters Teleport](https://wiki.bitbusters.club/Teleport).

---

## Hint keywords → rules

Use when scanning new levels or writing tests:

| Hint phrase (examples) | Rule ids to verify |
|------------------------|-------------------|
| collect chips / chip socket | chips, socket, exit |
| keys / doors | keys, doors, green reusable |
| push blocks / water / dirt | block push, water→dirt, block chain |
| monsters / bugs | actor tick, blocking, death |
| swim / flippers | water hazard, flippers tool |
| fire / boots | fire hazard, fire_boots |
| ice / slide | ice, force floors |
| teleport | teleport pairs |
| buttons / traps / clone | switches, links (DAT 4–5) |

---

## Adding a new rule (workflow)

1. Add a row to the **Rules matrix** above (status **todo**).
2. Map tile(s) in `content/ms-cc1.json` if not already present.
3. Implement in `tryMsCc1Move` (or future ruleset system).
4. Add a focused test in `packages/2d-tile-engine/test/msCc1Movement.test.ts` (minimal grid) or pipeline DAT test if extraction-related.
5. If a lesson level teaches it, add a **Level smoke tests** checklist line and coordinates.
6. Mark row **done** in this file.

---

## References (MS fidelity)

- [Tile World](https://wiki.tileworld.dev/) / CC1 behavior notes
- Original `CHIPS.EXE` (disassembly / comparison) — ultimate arbiter for disputes
- `packages/2d-tile-engine/tile-engine/tiles.ts` — `TILE_NAMES` for all object codes `$00–$6F`
