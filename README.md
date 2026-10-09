# BRANCHLIKE

Tactical real-time mech strategy for mobile. You command the Corsair Union against the Halcyon Directorate across the Cinder Reach: drop units onto a three-lane battlefield, hold hardpoints, bring down enemy spires, and call in hero frames when the moment is right.

BRANCHLIKE is an original game. It takes high-level genre principles from lane-and-hardpoint card strategy games and uses none of their code, art, characters, maps, text, sound or branding.

## Status

| Stage | State |
| --- | --- |
| Playable prototype (web, phone-first) | **Yes.** Full campaign loop, 6 missions, hangar, upgrades, saves. |
| Native mobile build (iOS / Android) | Not yet. Configured for Capacitor; needs a Mac/Xcode or Android Studio. See [Mobile builds](#mobile-builds). |
| Production release | No. Placeholder art and synthesised audio; balance tuned by simulation, not yet by player testing. |

## What's in the vertical slice

- Title screen, main menu, campaign map, mission briefing, squad editor, hangar with unit and pilot details, upgrades, profile, settings, battle, results.
- 8 combat units across infantry, anti-armour, scout drone, assault vehicle, artillery, support, structure and line mech roles.
- 3 hero frames with signature abilities: KESTREL-9 (Rocket Salvo), MONOLITH (Aegis Dome), VESPER (Rail Lance).
- 3 pilots with passives and active abilities: Juno Vale (Overclock), Ruk Okonkwo-Hale (Barrage), Sable Ito (EMP Lance).
- 6 missions: tutorial, hardpoint, assault, defend, boss (HALBERD PRIME), finale.
- Utility-scoring AI with three behavioural difficulty levels. The AI uses the same supply and rules as the player.
- Progression: XP and levels, credits, first-clear and replay rewards, unit unlocks, pilot unlocks, unit upgrades to level 5, star ratings.
- Versioned local saves with checksum, rolling backup and automatic recovery.
- Procedural WebAudio sound effects and music, with volume controls.

## Run it

Requirements: Node.js 20 or newer and TypeScript 5 or newer (`npm i -g typescript`, or `npm i -D typescript` in this folder). There are no runtime dependencies.

```bash
npm run build      # compile TypeScript to build/ and assemble the web app in dist/
npm run serve      # serve dist/ at http://localhost:5173
npm test           # 41+ unit and simulation tests (node:test)
npm run smoke      # end-to-end play-test in headless Chromium (needs Playwright)
npm run sim        # AI-vs-AI balance report across all missions and difficulties
```

Open `http://localhost:5173` on a phone on the same network, or use your browser's device toolbar. Add `?debug=1` to expose test hooks (`?debug=1&speed=4` runs battles faster).

## Controls

- Drag a card onto the battlefield, or tap a card then tap the ground. You can deploy below the dashed line, or next to a hardpoint you fully hold.
- Tap a unit to see its health, range and current target.
- Tap an ability button. Targeted abilities then need a tap on the battlefield; tap the button again to cancel.
- Keyboard: `1`–`4` select cards, `Esc` cancels or pauses, `Space` pauses.

## Mobile builds

The game is a static web app in `dist/`, so it can be wrapped as a native app with [Capacitor](https://capacitorjs.com). `capacitor.config.json` is already in the repo.

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android
npm run build
npx cap add android && npx cap sync android && npx cap open android   # Android Studio
npx cap add ios && npx cap sync ios && npx cap open ios               # macOS + Xcode
```

For a native build, swap `browserKV()` in `src/meta/save.ts` for Capacitor Preferences so saves survive OS storage clean-up.

## Project layout

```
src/data/      units, pilots, maps, missions, shared types (all content is data)
src/sim/       deterministic battle simulation and AI (no DOM)
src/meta/      progression and save/load (no DOM)
src/render/    canvas battlefield renderer
src/audio/     WebAudio synthesiser
src/ui/        app shell, components, screens
tests/         node:test suites
tools/         build, static server, browser smoke test, balance simulator
public/        index.html, styles.css, manifest
docs/          design document, architecture, backlog, testing, assets
```

## Documentation

- [Game design document](docs/GDD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Testing guide](docs/TESTING.md)
- [Backlog](docs/BACKLOG.md)
- [Asset provenance and licences](docs/ASSETS.md)
- [Changelog](CHANGELOG.md)
