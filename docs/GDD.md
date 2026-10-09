# BRANCHLIKE — Game Design Document

Living document. Version 0.1 (vertical slice).

## 1. Pitch

Short, tactical, real-time battles on a phone. Two commanders drop units onto a three-lane battlefield. Units fight on their own; the player's skill is in **what** to deploy, **where**, **when**, and **when to fire abilities**. Easy to read, hard to master.

## 2. World

**Setting.** The Branch is a chain of colony systems linked by gates. The **Cinder Reach** is the industrial branch that feeds every frame foundry in the chain.

**Factions.**

- **Corsair Union** (player, amber): a coalition of independent haulers, miners and gate crews who took up arms when the Reach was sealed.
- **Halcyon Directorate** (enemy, violet): the corporation that owns the gates. It sealed the Reach to break a strike and treats the war as a quarterly target.
- **The Ashen Covenant** (planned): scavengers who strip both sides' wrecks; a third party for later chapters.

**Premise.** Halcyon has locked the Reach gate behind a chain of command spires. Chapter I follows the Union's push from Relay Ridge to the last spire.

**Characters.**

- *Juno Vale* — "LAMPLIGHTER". Ex-courier who knows every supply corridor.
- *Ruk Okonkwo-Hale* — "FOUNDRY". Demolitions engineer who built the spires.
- *Sable Ito* — "NIGHTJAR". Halcyon signals defector carrying EMP schematics.
- *Castellan Mire* — Halcyon field director; recurring antagonist.

## 3. Core loop

1. Review the battlefield and the hand of 4 cards (from an 8-card squad).
2. Supply regenerates at 1 per 1.4 s, up to 10. Each card costs supply.
3. Drag a card to where you want the unit to go. It drops at your line (or beside a hardpoint you fully hold) and moves to that **rally point**. Aim behind the line to drop exactly there. Strike cards land exactly where you aim, anywhere on the field.
4. Units pick targets and objectives automatically.
5. Fire pilot and hero abilities at the right moment.
6. Win by objective or by destroying the enemy spire.

Artillery and marksman units (Mortar Crawler, VESPER) **hold at their rally point**; everything else resumes its normal orders on arrival. Frames and heroes **march down their lane on the enemy spire**, fighting whatever they meet, and they arrive by **frame-fall** from orbit. In the **final minute** supply production doubles (except in defend missions).

Heavy cards (frames and heroes) need **frame clearance**, which arrives partway into a mission (shown on the card and the briefing). Heroes are unique on the field.

## 4. Battlefield

- World is 360 × 640, three lanes, three hardpoints (A, B, C) across the middle.
- Rock spurs and stacks between lanes form choke points; ground units path around them, drones fly over.
- Each side has a **Command Spire** with a defence cannon. Losing it loses the battle in every mode.
- Hardpoint capture: about 5 s to take a neutral point with one capturer, 5 s to neutralise an enemy point, faster with more capture power. Contested points freeze.

## 5. Mission modes

| Mode | Win | Lose |
| --- | --- | --- |
| Hardpoint | First to the score target (1 point / 4 s per held point), or enemy spire destroyed | Enemy reaches target first, or spire lost. A draw at time-out is not a win. |
| Assault | Destroy the enemy spire. Held points boost supply regeneration by 8% each. | Spire lost; at time-out the side with the healthier spire wins. |
| Defend | Survive the timer | Spire lost |
| Boss | Destroy the boss unit | Spire lost or time-out |

## 6. Units and counters

Damage type × armour class multipliers (`src/data/units.ts`):

| Weapon \ Armour | Light | Air | Armoured | Structure |
| --- | --- | --- | --- | --- |
| Kinetic | 1.0 | 0.75 | 0.45 | 0.5 |
| Anti-armour | 0.4 | — | 1.8 | 1.3 |
| Explosive | 1.3 | — | 0.8 | 1.1 |
| Energy | 1.0 | 1.0 | 1.0 | 0.9 |

| Unit | Cost | Role | Counters | Countered by |
| --- | --- | --- | --- | --- |
| Rifle Squad | 2 | Capture, anti-infantry | Infantry, drones | Hounds, mortars |
| Breaker Team | 3 | Anti-armour | Vehicles, frames, spires | Rifles, drones (can't hit air) |
| Wasp Drone | 2 | Fast capper | Captures 2×; immune to rockets and shells | Rifles, Hounds, turrets |
| Hound | 4 | Assault vehicle | Infantry, drones | Breakers |
| Mortar Crawler | 4 | Artillery | Clumped infantry, structures | Drones, anything inside its blind spot |
| Mender Rig | 3 | Support | Sustains frames | Focus fire |
| Bastion Turret | 4 | Temporary structure | Holds a point ~1 min | Mortars, Breakers |
| Missile Strike | 2 | Strike card | Lands anywhere; clumped infantry, structures | Can't hit drones |
| Supply Depot | 3 | Economy structure | +15% supply for ~2 min | Anything that reaches it |
| Warden Frame | 6 | Line mech | Infantry | Breakers, MONOLITH, VESPER |
| KESTREL-9 | 7 | Hero skirmisher | Everything; Rocket Salvo vs clumps | Breakers |
| MONOLITH | 8 | Hero juggernaut | Armour; Aegis Dome | Drones (can't hit air) |
| VESPER | 7 | Hero marksman | Armour at range; Rail Lance lines | Drones, rush |

Design rule: a heavy unit must never automatically beat the same supply of its counter. This is enforced by an automated test (Warden vs 2 Breaker Teams).

## 6b. Reference: Titanfall: Assault gameplay principles

Gathered from gameplay-video write-ups, reviews, card guides and the community wiki (October 2026). Used as genre principles only.

| Principle | BRANCHLIKE |
| --- | --- |
| Drop and rally point: drag a card to where the unit should go | Done (0.4) |
| Heavy units march on the enemy base | Done (0.4) |
| Frantic final minute with faster resource generation | Done (0.4): supply doubles in the last 60 s |
| One-shot strike cards and economy structures | Done (0.4): Missile Strike, Supply Depot |
| Units with rally effects hold their ground | Done (0.4): Mortar Crawler, VESPER |
| Capture effects (reinforcements on capture), deploy effects, death effects | Backlog |
| Pilots that cross terrain (wall-running) | Backlog |
| Maps that change during play | Backlog |
| Squad of 10 (3 pilots, 3 titans, 4 burn cards) | Different by design: 8-card squad, any mix |
| Ranked ladder, caches, card rarity, guilds | Out of scope for the offline single-player slice |

## 7. Abilities

| Ability | Source | Effect | Cooldown |
| --- | --- | --- | --- |
| Overclock | Juno Vale | Your units fire 35% faster for 7 s | 45 s |
| Barrage | Ruk Okonkwo-Hale | 5 shells on target area | 40 s |
| EMP Lance | Sable Ito | Stun enemies in area 3.5 s (bosses 1.5 s) | 50 s |
| Rocket Salvo | KESTREL-9 | 6 rockets on an area within 230 | 20 s |
| Aegis Dome | MONOLITH | Nearby allies take 60% less damage for 6 s | 25 s |
| Rail Lance | VESPER | Piercing beam, 280 long | 18 s |
| Ground Quake | HALBERD PRIME | Automatic stomp: damage and stun nearby | 14 s |

## 8. AI

A utility-scoring commander (`src/sim/ai.ts`). On each think it:

1. Considers abilities and fires one if the target value clears a bar.
2. Assesses the field: opponent composition by armour class, threat near each hardpoint, threat to its spire.
3. Scores every card in hand against every target (each hardpoint lane, spire defence) using role fit, counter fit, objective value, urgency, mission profile and cost.
4. Saves supply toward the best card if it is unaffordable, unless a cheaper play is nearly as good, the spire is under threat, or supply is capped.

Difficulty changes behaviour only:

| Knob | Recruit | Veteran | Elite |
| --- | --- | --- | --- |
| Think interval | 2.2 s | 1.3 s | 0.7 s |
| Decision noise | high | medium | low |
| Counter-picking weight | 0.2 | 0.8 | 1.3 |
| Defence weight | 0.35 | 0.9 | 1.3 |
| Ability use | rare, high bar | usual | always, lower bar |
| Forward deployment | no | yes | yes |
| Saves for big cards | rarely | yes | yes, patient |

Mission **escalation** (0 → 0.75 across the campaign) sharpens every knob, and mission **profiles** (passive, balanced, aggressive, siege) bias card choice.

## 9. Progression

- **XP and levels:** missions grant XP; each level needs 100 + 60 × (level − 1) XP and pays 50 credits.
- **Credits:** first clears pay the most; replays pay a smaller amount scaled by difficulty (0.75× / 1× / 1.5×).
- **Unlocks:** missions unlock units and pilots on first clear (see `src/data/missions.ts`).
- **Upgrades:** units level 1 → 5, +8% health and damage per level, cost 120 × current level.
- **Stars:** 1 = win, 2 = spire ≥ 50%, 3 = spire ≥ 75% within par time.
- **Squad rules:** 8 cards, ≤ 2 copies of a regular unit, 1 copy of each hero, ≤ 2 heroes.
- **Integrity:** each battle has a unique id; a result can only be applied once, so reloading cannot duplicate rewards. No real-money purchases.

## 10. Campaign — Chapter I · The Cinder Reach

| # | Mission | Mode | Map | First-clear unlocks |
| --- | --- | --- | --- | --- |
| T | First Drop | Hardpoint (40) tutorial | Relay Ridge | Hound |
| 1 | Relay Ridge | Hardpoint (100) | Relay Ridge | Mortar Crawler, MONOLITH |
| 2 | Foundry Gate | Assault | Foundry Gate | Mender Rig, pilot Ruk |
| 3 | Holdout at Kessel | Defend 3:00 | Kessel Yard | VESPER, pilot Sable |
| 4 | The Iron Halberd | Boss | Foundry Gate | — |
| 5 | Breach the Spire | Hardpoint (100) | Spire Approach | — |

## 11. Art and audio direction

- **Interface:** gunmetal surfaces, condensed stencil-style caps, a single warm signal colour (Union amber) against Halcyon violet; restraint everywhere except the battlefield.
- **Battlefield:** tilted 2.5D camera; silhouettes first — infantry capsules, wedge vehicles, box-torso frames, distinct hero silhouettes (winged KESTREL, shield-shouldered MONOLITH, long-railed VESPER). Health bars always readable; range rings on inspect and while deploying.
- **Audio:** synthesised in real time; low pad music that adds a pulse in battle.
- **Next:** commissioned 2D sprites or 3D renders per unit, map-specific props, voiced pilot barks.
