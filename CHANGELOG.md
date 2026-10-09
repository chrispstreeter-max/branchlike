# Changelog

## 0.3.0 — Reference pass: urban battlefield and landscape

### Added
- Landscape support: on a landscape screen the camera moves to the side of the field (player left, Halcyon right) with tighter framing, and the HUD and card tray become a compact single row. Portrait still works.
- Urban battlefields (`src/render/environment3d.ts`): cover is now city buildings built inside each collision footprint, with window bands, cornices, rooftop plant, water tanks, antennas, neon corner strips, lit storefronts and neon signs using BRANCHLIKE names. Streets, sidewalks, curbs, crosswalks, plazas and parking bays painted on the ground; trees and street lights; district landmarks (relay masts, furnace stacks, tanks, floodlights).
- Brighter daylight lighting per district, with the sun kept on the camera's side.
- Hex hardpoint pads, hex markers with capture progress, segmented health bars with hex level badges on every non-infantry unit.

### Unchanged
- Gameplay, AI, progression and saves. Collision shapes are the same; only their visuals changed.

## 0.2.0 — 3D battlefield (visual upgrade, phase 1)

### Added
- Real-time 3D battlefield using Three.js r160 (vendored, MIT): perspective camera at 50°, fitted between HUD and card tray; hemisphere and sun lighting with soft shadows; ACES tone mapping; fog.
- Procedural environments: painted concrete, roads and hazard-band ground textures; city blocks with lit windows; per-map landmarks and themed cover matching the collision shapes.
- Original procedural 3D models for all 11 units, spires and HALBERD PRIME, with walk cycles, aiming, recoil, hover and drop-in animation.
- Effects: tracers, rockets, artillery shells with arcs, muzzle flashes, sparks, explosions, smoke, shockwaves, scorch decals, flash lights, drop beams, capture pulses, damage smoke, and ability effects for all 7 abilities.
- In-world health bars, hero and boss name tags, level pips, stun and shield indicators, hardpoint markers with capture progress, target lines, range rings, deploy-zone highlight, ghost preview.
- Full-bleed battle layout with gradient HUD and tray; redesigned cards with hex cost badges and unit-class tags.
- Graphics setting (High quality / Battery saver) and automatic dynamic resolution.
- `docs/VISUAL_UPGRADE.md`: architecture review, asset gap analysis, researched asset stack, decisions and manual actions.

### Kept
- The 2D renderer, as an automatic fallback (`?render=2d` forces it).
- All gameplay, AI, progression and save code unchanged; all 41 tests still pass.

## 0.1.0 — First playable vertical slice

### Added
- Deterministic combat simulation: deploy validation, effectiveness-weighted targeting, damage-type counters, splash and delayed shells, obstacle steering and collisions, hardpoints, spires, four mission modes, time-out rules.
- Units: Rifle Squad, Breaker Team, Wasp Drone, Hound, Mortar Crawler, Mender Rig, Bastion Turret, Warden Frame. Hero frames KESTREL-9, MONOLITH, VESPER. Boss HALBERD PRIME.
- Pilots Juno Vale, Ruk Okonkwo-Hale and Sable Ito with passives and abilities.
- Utility-scoring AI with Recruit, Veteran and Elite behaviour, campaign escalation and mission profiles.
- Campaign Chapter I: six missions including a tutorial and a boss fight.
- Progression: XP, levels, credits, unlocks, upgrades, star ratings, squad editor and validation.
- Save system: checksum, rolling backup, recovery, sanitising, migration hook.
- Screens: title, menu, campaign, briefing, squad, hangar, unit and pilot details, profile, settings, battle (HUD, drag-and-drop deploy, abilities, unit inspection, tutorial coach, pause), results.
- Tilted 2.5D battlefield renderer with effects; procedural audio.
- 41 automated tests, headless-browser smoke test, AI-vs-AI balance tool.

### Balance (from simulation)
- Retuned the boss (6,000 health, lighter shells, slower), spires (7,000 health) and per-unit stats after AI-vs-AI testing.
- Mender Rigs can no longer repair the boss.
- Breaker range raised to 100 so the Warden no longer out-ranges its counter.
- VESPER range cut to 128 so it can't out-range the spire cannon.
- Fixed an AI economy bug where it spent every cheap card at once and never afforded heavy cards.
