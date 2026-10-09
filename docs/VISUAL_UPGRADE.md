# Visual upgrade: 3D isometric battlefield

Status: **phase 1 done** (real-time 3D renderer with original procedural assets). Phase 2 needs approval: see [Decisions needed](#decisions-needed).

## 1. Existing architecture (before this upgrade)

| Area | Implementation | State |
| --- | --- | --- |
| Engine | TypeScript, no framework, no runtime dependencies | Functional |
| Simulation | `src/sim/battle.ts`: deterministic fixed step, no DOM | Functional, 41 tests |
| AI | `src/sim/ai.ts`: utility scoring, 3 difficulties | Functional, tested |
| Progression and saves | `src/meta/*` | Functional, tested |
| Screens and UI | `src/ui/*`: DOM screens, CSS design system | Functional; card art is SVG placeholder |
| Battle rendering | `src/render/renderer.ts`: 2D canvas faking a tilted view | **Placeholder**: flat shapes, no lighting, no buildings |
| Camera | Fixed 2D projection formula | Placeholder |
| Audio | `src/audio/audio.ts`: synthesised WebAudio | Functional placeholder |
| Renderer interface | 6 calls from the battle screen: `fit`, `toWorld`, `pick`, `reset`, `ingest`, `draw` | Clean seam, which made the swap safe |

## 2. Asset gap analysis

| Category | Needed for target quality | Before | Now (phase 1) | Gap remaining |
| --- | --- | --- | --- | --- |
| 3D environment | Lit terrain, roads, lane markings, hazard lines | 2D fills | Procedural ground texture (concrete panels, asphalt roads, oil, cracks, hazard bands), terrain plane, fog | Hand-painted or photo-sourced texture set; height variation |
| Modular buildings | Futuristic blocks framing the field | None | Procedural city blocks with setbacks, rooftop units, antennas, lit window strips; per-map landmarks (furnace stacks, tanks, floodlight masts) | Authored modular kit with detail and decals |
| Cover and objectives | Readable cover, hardpoints, bases | Polygons | Themed obstacles per map (rocks, furnace stacks, container stacks, bunkers) matching collision circles; hardpoint pads with pylons, capture arc, beacon column, floating marker; spire towers with rotating turret | Animated capture machinery, destructible cover |
| Mechs | Original, distinct silhouettes, animated | Flat shapes | Procedural low-poly models: Warden, KESTREL-9 (reverse-joint, wings), MONOLITH (shoulder shields), VESPER (long rail), HALBERD PRIME (four-legged siege frame). Walk cycles, aiming, recoil, drop-in | **Commissioned hero models** with textures, rigs and authored animation |
| Pilots and infantry | Characters with idle, run, fire, death | Flat capsules | Procedural troopers and breakers with bob and aim | Rigged humanoids; Mixamo animation set |
| Vehicles and drones | Hound, Mortar Crawler, Mender Rig, Wasp | Flat shapes | Procedural models; turret yaw, mortar recoil, hover bob and bank, walker legs | Authored models |
| Weapons and projectiles | Tracers, rockets, shells | 2D lines | Gradient tracers, rocket and shell projectiles with smoke trails, muzzle flashes, impact sparks, rail beam | Mesh projectiles, unique per weapon |
| VFX | Explosions, smoke, abilities | 2D rings | GPU point-sprite particles (additive fire, alpha smoke), shockwave rings, drop beams, scorch decals, flash lights, screen shake, damage smoke | Flipbook explosions, distortion, three.quarks |
| Lighting | Sun, sky, shadows, atmosphere | None | Hemisphere and directional light, soft shadow map, ACES tone mapping, fog, per-map lighting looks, emissive windows and lamps | Baked light probes, bloom (cost-checked) |
| Camera | Isometric 3D, fits phones | Formula | Perspective camera at 50° fitted between HUD and tray; screen shake; dynamic view offset | Optional pinch-zoom or pan; cinematic intro |
| Mobile UI | HUD and cards that suit the 3D view | Opaque bars | Full-bleed scene with gradient HUD and tray, hex cost badges, unit-class tags, hero styling, in-world health bars, hero and boss name tags, hardpoint markers with capture progress, target line, range rings, deploy-zone highlight, ghost preview | Final card illustrations (renders of the commissioned models) |
| Audio | Weapon, explosion, mech and UI sounds | Synth | Synth (unchanged) | Sonniss GDC bundle sounds |

## 3. Research: compatible assets and plugins

Checked 9 October 2026. Prices change, so confirm them at purchase.

| Option | Type | Licence | Price | Fit | Verdict |
| --- | --- | --- | --- | --- | --- |
| [Three.js r160](https://github.com/mrdoob/three.js) | WebGL engine | MIT | Free | Runs in browser and Capacitor apps | **Adopted** (vendored, 670 KB) |
| [Quaternius Modular Sci-Fi MegaKit](https://quaternius.itch.io/modular-sci-fi-megakit) | 270+ modular sci-fi pieces, glTF/FBX/OBJ | CC0 | Free standard tier; Pro $9.99+; Source $14.99+ | glTF loads directly in Three.js | **Recommended** for buildings and props |
| [Quaternius Sci-Fi Essentials Kit](https://quaternius.com/packs/scifiessentialskit.html) | Props | CC0 | Free | glTF | Optional |
| [Kenney Space Station Kit](https://kenney-assets.itch.io/space-station-kit) | Modular sci-fi interior pieces | CC0 | Free | glTF | Optional |
| Kenney GitHub starter kits (City Builder, FPS, Racing) | Cartoon city and vehicles | CC0 | Free | glTF | **Rejected**: cartoon suburban style |
| [Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) | Humanoid rigging and animation | Royalty-free for games | Free with Adobe ID | FBX; convert to glTF | **Recommended** for pilots and infantry |
| [three.quarks](https://libraries.io/npm/three.quarks) | Particle and VFX engine for Three.js | MIT | Free | Batched rendering, Unity Shuriken import | Optional, phase 3 |
| [Sonniss GDC 2026 bundle](https://rekkerd.org/sonniss-releases-gdc-2026-game-audio-bundle/) | 7.47 GB of sound effects | Royalty-free, no attribution | Free | WAV; compress to OGG/M4A | **Recommended** |
| [Synty POLYGON Sci-Fi Worlds](https://syntystore.com/en-gb/products/polygon-sci-fi-worlds) | 1,200 prefabs, 20 characters, 16 vehicles | Synty one-time licence, 5 seats | £462.64 (page showed "Sold out") | Built for Unity, Unreal and Godot; FBX available | **Not recommended**: cost, widely used style, heavy for mobile web |
| [Synty POLYGON Sci-Fi City (Unity)](https://assetstore.unity.com/packages/3d/environments/sci-fi/polygon-sci-fi-city-pack-art-by-synty-115950) | City pack | Unity Asset Store EULA | $24.99 (sale, normally $49.99) | Unity only under that EULA | Only if moving to Unity |
| [Modular Robot: Mecha (Unity)](https://assetstore.unity.com/packages/3d/characters/robots/modular-robot-mecha-52868) | Mech kit | Unity Asset Store EULA | $49.99 | Last updated 2017 | **Rejected**: dated |
| [Mech Constructor: Heavy Robot (Reallusion)](https://reallusion.com/ContentStore/Pack/mech-constructor-heavy-robot) | Mech kit | Reallusion content licence | $9.80 (sale) | Requires iClone or Character Creator; export terms unclear | **Rejected**: tool lock-in |

**Conclusion on mechs:** no off-the-shelf mech pack is both current, mobile-friendly and distinctive. The mechs are the identity of BRANCHLIKE, so they should be original commissions.

## 4. Recommended stack (smallest coherent set)

| Layer | Choice | Cost | Status |
| --- | --- | --- | --- |
| Renderer | Three.js r160 (vendored) | Free | ✅ Done |
| Hero and line frames | Commissioned glTF models: KESTREL-9, MONOLITH, VESPER, Warden, HALBERD PRIME (≤ 6k triangles each, one 1024² texture atlas per team, rigged with leg and gun bones) | Needs quotes | ⏳ Needs your approval |
| Infantry and pilots | One commissioned trooper base mesh, rigged for Mixamo | Needs quote; animations free | ⏳ Needs your approval and an Adobe ID |
| Environment kit | Quaternius Modular Sci-Fi MegaKit (CC0) | Free, or $9.99+ to support | ⏳ Manual download (blocked from this workspace) |
| Sound effects | Sonniss GDC 2026 bundle (royalty-free) | Free | ⏳ Manual download (7.5 GB; pick about 40 sounds) |
| VFX | Built-in particle system now; three.quarks later | Free | ✅ / optional |

Everything is wired so commissioned assets drop in per unit: `buildModel()` in `src/render/models3d.ts` is the single entry point. A glTF loader goes there, and the procedural model stays as the fallback.

## 5. Mobile optimisation in place

- **Shared resources:** geometry is shared per unit type and team, and all units use 2 materials (vertex-coloured standard, plus unlit glow). Each unit costs 1–5 draw calls.
- **Merged map:** the static map is merged into about 8 draw calls (ground, terrain, city, windows, obstacles, glow).
- **Particles:** a fixed pool of point sprites in 2 draw calls. Rings, beams, decals and lights are pooled; nothing is allocated per shot.
- **Measured (headless Chromium):** 33 draw calls at battle start, 92–112 with 40–53 units, 24k–29k triangles, 3 textures.
- **Quality setting:** *Battery saver* turns off shadows and MSAA, renders at 1.25× pixel ratio and halves particles.
- **Dynamic resolution:** on *High quality*, the pixel ratio steps down automatically if frames stay above about 36 ms for 3 seconds.
- **Fallback:** the 2D renderer loads automatically without WebGL, or on request with `?render=2d`.

## 6. Decisions needed

1. **Commissioning the mechs** (largest visual gain). Approve a brief to 3D artists for 5 frames, plus 1 infantry base mesh. Rough scope per model: concept turnaround, a game-ready mesh of 6k triangles or fewer, a texture atlas, a rig with walk, aim, fire, death and idle animations, and glTF delivery. I can write the artist brief and a style sheet from the current procedural silhouettes.
2. **Engine path for store release.** Option A: stay on Three.js and ship with Capacitor (current path; cheapest; good for this art style). Option B: port to Unity URP for higher-end effects and the Unity asset ecosystem (bigger job; needs a desktop machine; the sim ports to C#). My recommendation is A until a playtest shows the 3D look is what's holding the game back.

## 7. Manual actions (cannot be done from this workspace)

- [ ] Download the Quaternius Modular Sci-Fi MegaKit (standard, glTF) and add the files to `public/assets/quaternius/`. This workspace blocks itch.io.
- [ ] Download the Sonniss GDC 2026 bundle and choose weapons, explosions, mech servos and UI sounds.
- [ ] Create an Adobe ID for Mixamo if you approve rigged infantry.
- [ ] Test on two real phones (one older Android, one recent iPhone) with both graphics settings, and note the frame rate.
