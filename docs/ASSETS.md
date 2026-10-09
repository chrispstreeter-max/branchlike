# Asset provenance and licences

All art and audio in BRANCHLIKE 0.2 is original and generated in code. One third-party library is bundled: Three.js.

| Asset | Source | Licence |
| --- | --- | --- |
| Three.js r160 (`public/js/vendor/three.module.min.js`) | github.com/mrdoob/three.js, tag r160, obtained by git sparse checkout | MIT, licence text in `public/js/vendor/THREE-LICENSE.txt` |
| 3D unit, spire and hardpoint models (`src/render/models3d.ts`) | Built procedurally from primitives in code | Project-owned |
| 3D city, ground texture, obstacles and effects (`src/render/renderer3d.ts`) | Generated at runtime (canvas texture, merged primitives, particles) | Project-owned |
| Unit, pilot and UI icons (`src/ui/art.ts`) | Hand-written SVG in this repo | Project-owned |
| Battlefield, units and effects (`src/render/renderer.ts`) | Drawn procedurally on canvas | Project-owned |
| BRANCHLIKE wordmark | SVG in `src/ui/art.ts` | Project-owned; trademark search not yet done |
| Sound effects and music (`src/audio/audio.ts`) | Synthesised at runtime with WebAudio | Project-owned |
| Typefaces | Device system fonts (Bahnschrift, DIN Alternate, Roboto Condensed, Arial Narrow, system UI) | Not bundled; each device's own licence |
| Names, lore, characters, factions, maps | Written for this project | Project-owned |

## Rules

- Never import assets extracted from existing games.
- Every new asset gets a row here: source, author, licence, date.
- Frame models (`src/render/mechs3d.ts`) and their card portraits (`public/img/units/*.png`, rendered by `tools/render-cards.mjs`) are original BRANCHLIKE work created in this repository.
- Commissioned art must come with a written transfer of rights or a licence that allows commercial distribution in app stores.
- Before release, run a trademark search on "BRANCHLIKE", unit names and faction names.
