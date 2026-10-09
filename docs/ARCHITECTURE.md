# Architecture

## Why TypeScript and Three.js, not Unity

The brief preferred Unity. The build environment had no Unity editor, no Android SDK and no Xcode, and it could not reach the npm registry. The practical choice was a TypeScript game that compiles with the TypeScript compiler alone and runs in any modern browser. 3D rendering uses Three.js r160, vendored into `public/js/vendor/` (no package manager needed) and loaded on demand, with automatic fallback to the 2D renderer. The simulation is engine-agnostic: if the project moves to Unity later, `src/sim` and `src/data` port directly to C#, and the tests describe the expected behaviour.

## Layers

```
data  ─▶  sim (battle, ai)  ─▶  render  ─▶  ui/screens
  │            │                              ▲
  └──────▶  meta (progression, save)  ────────┘
```

| Layer | Folder | Depends on | Rules |
| --- | --- | --- | --- |
| Content | `src/data` | nothing | Pure data. Add a unit, pilot, map or mission here without touching engine code. |
| Simulation | `src/sim/battle.ts` | data | Deterministic fixed step (`DT = 0.05`), seeded RNG, no DOM, no `Math.random`. All input goes through `deploy()` and `useAbility()`, which validate and return an error code. Output is state plus an `events` array per step. |
| AI | `src/sim/ai.ts` | sim, data | Uses only the public sim API, plays by the same rules and supply as the player. Own seeded RNG, so battles stay reproducible. |
| Meta | `src/meta` | data | Profile progression as pure functions; versioned save envelope with checksum, backup and recovery, behind a key-value interface. |
| Render | `src/render` | sim (read-only) | `view.ts` defines the `BattleView` interface and picks an implementation: `renderer3d.ts` (Three.js, default) or `renderer.ts` (2D canvas fallback). `models3d.ts` builds original unit models. Reads battle state, spawns effects from events, never mutates the battle. |
| Audio | `src/audio` | none | WebAudio synth; plays sounds mapped from events by the battle screen. |
| UI | `src/ui` | everything | Screen factories (`(app) => { el, destroy?, back? }`), a tiny `h()` DOM builder, no framework. |

## Battle step order

1. Supply regeneration, pilot cooldowns, overclock timers.
2. Per unit: decay, stun, heal, target selection (effectiveness-weighted, sticky), fire or move. Shells are queued with a delay.
3. Shells land (splash with falloff).
4. Collision resolution against obstacles and other units (air and ground are separate layers).
5. Deaths: spire or boss death ends the battle immediately.
6. Hardpoint capture and scoring.
7. Mode-specific victory checks and time-out resolution.

## Determinism

The same seed and the same sequence of inputs at the same steps produce an identical battle. The battle screen generates a random seed at launch; the AI derives its own RNG from it. This makes replays, server-side verification and regression tests possible later.

## Saves

`save.ts` writes `{ format, version, savedAt, checksum, profile }`. On load:

1. Parse and verify the checksum, migrate older versions, then sanitise every field.
2. If that fails, keep the damaged copy under `.corrupt` and restore from `.bak` (the previous good save).
3. If both fail, start a new profile.

Rewards are applied through `applyBattleResult`, keyed by a unique battle id, and saved in the same call, so a reload can never pay twice.

## Extending

- **New unit:** add to `UNITS`. If it has a new behaviour, add a `role` branch in `goalFor` (sim) and in `deployOptions` (AI).
- **New ability:** add to `ABILITIES` and a `case` in `useAbility`, the renderer's `drawFx`, and AI `tryAbilities`.
- **New mission:** add to `MISSIONS` (and a map in `MAPS` if needed). Rewards, unlocks and AI profile are all fields.
- **Multiplayer (future):** the deterministic sim supports lockstep. Send `{step, deploy|ability, args}` inputs; both clients step identically.
