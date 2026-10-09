# Testing guide

## Automated

| Command | What it covers |
| --- | --- |
| `npm test` | Unit and simulation tests in `tests/` with Node's built-in runner. |
| `npm run smoke` | End-to-end play-test in headless Chromium at phone size (390 × 844, touch). Pass `-- --shots=dir` to save screenshots. |
| `npm run sim` | AI-vs-AI balance report: player-side AI vs each mission's enemy at three difficulty pairings, 20 seeds each. |

### `tests/combat.test.ts`

- Battle setup, supply regeneration and cap.
- Deploy spends supply once and cycles the hand; invalid deploys (zone, terrain, no card, locked, no supply, hero already active) are rejected with no side effects.
- Forward deployment only next to a fully held hardpoint.
- Units fire only inside weapon range; anti-armour and mortars cannot hit drones.
- Counter table: breakers vs armour, rifles vs infantry per supply; a Warden loses to the same supply of Breaker Teams.
- Hardpoints: uncontested capture, contested freeze, neutralise before flip, scoring and score victory.
- Spire destruction, defend survival, boss kill, time-out draw is not a win.
- Pilot and hero abilities: cooldowns, targeting, range, EMP radius and spire immunity.
- Determinism: same seed gives an identical battle; different seed differs.
- Every mission runs to completion in AI-vs-AI with both sides deploying.
- Drop and rally: aiming past the line drops at the nearest legal spot and sets a rally point; rally holders stay, others resume orders on arrival.
- Missile Strike damage and placement anywhere; final-minute supply surge; Supply Depot boost; frames march on the enemy spire.

### `tests/ai.test.ts`

- Difficulty knobs are ordered and behavioural only.
- Elite beats Recruit in mirror matches from either side.
- Higher difficulty makes more decisions.
- The AI deploys to defend a threatened spire.
- The AI plays anti-armour more often against an armour-heavy opponent than against infantry (16 seeds).
- The AI can never spend supply it doesn't have.

### `tests/progression.test.ts`

- New profile, mission unlock order, first-clear rewards once, repeat rewards.
- The same battle id can never pay twice, including after a save and load.
- Losses, difficulty scaling, stars, level-ups.
- Upgrades: cost, max level, locked units.
- Squad rules.
- Save round-trip, corrupted save recovery from backup, checksum detection, sanitising nonsense values.

### `tools/smoke.mjs`

Title → menu → campaign (5 locked missions) → briefing → battle with tutorial → drag-and-drop deploy → tap on enemy ground deploys with a rally point → tap outside the field rejected with a message → pilot ability → pause and resume → forced win → results and rewards → reload keeps progress without paying twice → hangar upgrade → pilots → squad remove/add/save validation → settings persist → profile → second mission launches → 3D draw-call budget → landscape layout → 2D fallback. Also checks for horizontal overflow on each screen and fails on any console error.

## Manual checklist (per release)

- [ ] Play First Drop on a real phone in portrait; drag and tap deploys both work.
- [ ] Clear Relay Ridge on Veteran; Mortar Crawler and MONOLITH unlock.
- [ ] Kill the app mid-battle; reopen; no reward is granted and nothing is lost.
- [ ] Set music and effects to 0%, then back; audio follows instantly.
- [ ] Turn on reduce motion; no screen shake.
- [ ] Rotate to landscape on a tablet; layout stays usable (portrait is the target).

## Known limits of the tests

- Balance is checked by AI-vs-AI simulation, which is a proxy for human play. Human playtesting is the next step.
- Audio is not tested beyond "no errors" (headless browsers have no output device).
