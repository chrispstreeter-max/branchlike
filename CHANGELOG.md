# Changelog

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
