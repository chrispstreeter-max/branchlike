# BRANCHLIKE

Tactical real-time mech strategy for mobile. You command the Corsair Union against the Halcyon Directorate across the Cinder Reach: drop units onto a three-lane battlefield, hold hardpoints, bring down enemy spires, and call in hero frames when the moment is right.

BRANCHLIKE is an original game. It takes high-level genre principles from lane-and-hardpoint card strategy games and uses none of their code, art, characters, maps, text, sound or branding.

## Status

| Stage | State |
| --- | --- |
| Playable prototype (web, phone-first) | **Yes.** Full campaign loop, 6 missions, hangar, upgrades, saves. 3D battlefield (Three.js) with 2D fallback. |
| Native mobile build (iOS / Android) | Not yet. Configured for Capacitor; needs a Mac/Xcode or Android Studio. See [Mobile builds](#mobile-builds). |
| Production release | No. Original in-code 3D models (frames fully designed; other units simpler), synthesised audio; balance tuned by simulation, not yet by player testing. See [Visual upgrade](docs/VISUAL_UPGRADE.md). |

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

Requirements: Node.js 20 or newer and TypeScript 5 or newer (`npm i -g typescript`, or `npm i -D typescript` in this folder). The only runtime library, Three.js r160, is vendored in `public/js/vendor/`.

```bash
npm run build      # compile TypeScript to build/ and assemble the web app in dist/
npm run serve      # serve dist/ at http://localhost:5173
npm test           # 41+ unit and simulation tests (node:test)
npm run smoke      # end-to-end play-test in headless Chromium (needs Playwright)
npm run sim        # AI-vs-AI balance report across all missions and difficulties
```

Open `http://localhost:5173` on a phone on the same network, or use your browser's device toolbar. Add `?debug=1` to expose test hooks (`?debug=1&speed=4` runs battles faster) and `?render=2d` to force the 2D renderer.

## Controls

- Drag a card onto the battlefield, or tap a card then tap the ground. Aim anywhere: the unit drops below the dashed line (or next to a hardpoint you fully hold) and moves to the point you aimed at, its rally point. Strike cards land exactly where you aim.
- Tap a unit to see its health, range and current target.
- Tap an ability button. Targeted abilities then need a tap on the battlefield; tap the button again to cancel.
- Keyboard: `1`–`4` select cards, `Esc` cancels or pauses, `Space` pauses.

## Mobile builds

### Android (automatic)

Every push to `main` builds the Android app on GitHub (`.github/workflows/android.yml`, Capacitor 8) and publishes it to the [`android-latest` pre-release](https://github.com/chrispstreeter-max/branchlike/releases/tag/android-latest).

To install on an Android phone: open that page on the phone, download `BRANCHLIKE-<version>.apk`, open it, and allow installs from your browser when Android asks. New builds install over the old one and keep your progress. This is a test build signed with a debug key, not a Play Store release.

### iPhone

iOS builds need a Mac with Xcode and an Apple Developer account (US$99 a year) to install on a phone:

```bash
npm install
npm run build
npx cap add ios && npx cap sync ios && npx cap open ios   # then Run in Xcode
```

### Icon and splash

`assets/` holds the app icon and splash screen, rendered from the Warden model by `npm run app:assets`. The workflow turns them into every Android size with `@capacitor/assets`.

### Saves

Saves use the WebView's local storage, which persists on Android until the app's data is cleared. Before an App Store release, move saves to Capacitor Preferences, because iOS can clear WebView storage when the phone is short of space.

## Project layout

```
src/data/      units, pilots, maps, missions, shared types (all content is data)
src/sim/       deterministic battle simulation and AI (no DOM)
src/meta/      progression and save/load (no DOM)
src/render/    3D renderer (Three.js), procedural models, 2D fallback
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
- [Visual upgrade: gap analysis and asset stack](docs/VISUAL_UPGRADE.md)
- [Frame design sheet](docs/MECHS.md)
- [Asset provenance and licences](docs/ASSETS.md)
- [Changelog](CHANGELOG.md)
