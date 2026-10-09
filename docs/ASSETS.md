# Asset provenance and licences

Every asset in BRANCHLIKE 0.1 is original and generated in code. No third-party art, audio, fonts or code are bundled.

| Asset | Source | Licence |
| --- | --- | --- |
| Unit, pilot and UI icons (`src/ui/art.ts`) | Hand-written SVG in this repo | Project-owned |
| Battlefield, units and effects (`src/render/renderer.ts`) | Drawn procedurally on canvas | Project-owned |
| BRANCHLIKE wordmark | SVG in `src/ui/art.ts` | Project-owned; trademark search not yet done |
| Sound effects and music (`src/audio/audio.ts`) | Synthesised at runtime with WebAudio | Project-owned |
| Typefaces | Device system fonts (Bahnschrift, DIN Alternate, Roboto Condensed, Arial Narrow, system UI) | Not bundled; each device's own licence |
| Names, lore, characters, factions, maps | Written for this project | Project-owned |

## Rules

- Never import assets extracted from existing games.
- Every new asset gets a row here: source, author, licence, date.
- Commissioned art must come with a written transfer of rights or a licence that allows commercial distribution in app stores.
- Before release, run a trademark search on "BRANCHLIKE", unit names and faction names.
