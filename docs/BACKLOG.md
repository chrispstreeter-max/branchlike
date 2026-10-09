# Backlog

Status key: ✅ done · 🔄 in progress · ⬜ to do · ⛔ blocked

## Phase status

| Phase | Status | Notes |
| --- | --- | --- |
| 1 Environment | ✅ | Node 22, TypeScript, headless Chromium. No Unity, Android SDK, Xcode or npm registry access. |
| 2 Foundation | ✅ | Zero-dependency TS project, data-driven content, original world. |
| 3 Playable combat | ✅ | Deploy, combat, supply, hardpoints, spires, 4 modes, abilities. |
| 4 AI | ✅ | Utility AI, 3 behavioural difficulties, escalation, profiles. |
| 5 Progression | ✅ | XP, credits, unlocks, upgrades, stars, idempotent rewards, saves. |
| 6 Presentation | ✅ | All screens, battle HUD, renderer, FX, synth audio, tutorial. Placeholder art. |
| 7 Testing | ✅ | 41 unit/sim tests, browser smoke test, balance simulator. |
| 8 Mobile readiness | 🔄 | Touch, layout and performance checked in mobile emulation. Native build ⛔ (needs Xcode / Android Studio). |
| 9 Iteration | 🔄 | See below. |
| 10 Visual upgrade (3D) | 🔄 | Phase 1 done: Three.js renderer, procedural original models, VFX, lighting, HUD and card redesign. Phase 2 (commissioned models, glTF loading, Sonniss audio) awaiting approval. See `docs/VISUAL_UPGRADE.md`. |

## Next up (highest impact first)

- ⬜ Capture, deploy and death effects on cards (for example reinforcements when a point is taken). From the Titanfall: Assault research, see GDD 6b.
- ⬜ Pilots that cross terrain (wall-running infantry ignoring building footprints).
- ⬜ Maps that change during play (collapsing buildings, opening routes).
- ⬜ Human playtest pass on real phones; tune supply rate, clearance times and mission 4/5 difficulty.
- ✅ Original frame designs with jointed rigs and walk cycles (0.5.0, `docs/MECHS.md`).
- ⬜ Optional: commissioned textured frames as glTF via a GLTFLoader path in `buildModel()`.
- ⬜ Render card portraits for vehicles, infantry and structures from their 3D models too.
- ⬜ Card illustrations rendered from the 3D models.
- ⬜ Real-device frame-rate pass on older Android and recent iPhone.
- ⬜ Capacitor native build; swap localStorage for Capacitor Preferences; haptics on deploy.
- ⬜ Pilot unlock for Castellan Mire's rival in Chapter II; the Ashen Covenant third faction.
- ⬜ Mission modifiers (fog, supply drought, double clearance) for replay variety.
- ⬜ Daily challenge using a fixed seed (the sim is deterministic).
- ⬜ Enemy hero frames with abilities in more missions; boss phase 2.
- ⬜ Accessibility: colour-blind team palette option; larger text option.
- ⬜ Battle replay viewer (record inputs per step).
- ⬜ Ground pathfinding upgrade (flow field) if larger maps are added.

## Known issues

- Units steer around obstacles locally and can briefly hug rocks in crowded lanes.
- Tracers are drawn on a 2D overlay above the 3D scene, so they are not hidden behind buildings.
- In the 3D view, units use flat team colours rather than authored textures (placeholder until commissioned models).
- The music synth plays the same four-chord loop; needs more variation.
