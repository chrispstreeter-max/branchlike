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

## Next up (highest impact first)

- ⬜ Human playtest pass on real phones; tune supply rate, clearance times and mission 4/5 difficulty.
- ⬜ Replace placeholder silhouettes with commissioned unit art (keep silhouettes and team colours).
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
- Drop shadows separate from bodies during the 0.35 s drop-in animation (intended, but reads oddly in still frames).
- The music synth plays the same four-chord loop; needs more variation.
