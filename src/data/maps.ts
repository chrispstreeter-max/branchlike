import type { MapDef } from './types.js';

// World space is 360 × 640. The player (team 0) holds the bottom edge,
// Halcyon (team 1) the top. Obstacles create choke points between lanes.
export const WORLD_W = 360;
export const WORLD_H = 640;
export const CORE_POS = [{ x: 180, y: 600 }, { x: 180, y: 40 }];
export const DEPLOY_LINE = [440, 200]; // player deploys at y >= 440, enemy at y <= 200
export const FORWARD_DEPLOY_RADIUS = 46; // may also deploy near a hardpoint you hold
export const POINT_RADIUS = 32;

export const MAPS: Record<string, MapDef> = {
  relay_ridge: {
    id: 'relay_ridge', name: 'Relay Ridge', palette: 'dust',
    desc: 'A hillside transit district under three relay masts. Office blocks split the streets into lanes.',
    points: [{ id: 'A', x: 66, y: 322 }, { id: 'B', x: 180, y: 314 }, { id: 'C', x: 294, y: 322 }],
    obstacles: [{ x: 124, y: 236, r: 24 }, { x: 236, y: 236, r: 24 }, { x: 124, y: 404, r: 24 }, { x: 236, y: 404, r: 24 }],
  },
  foundry_gate: {
    id: 'foundry_gate', name: 'Foundry Gate', palette: 'foundry',
    desc: 'A slag-choked foundry yard. The centre lane is a narrow gate between furnace stacks.',
    points: [{ id: 'A', x: 60, y: 300 }, { id: 'B', x: 180, y: 330 }, { id: 'C', x: 300, y: 300 }],
    obstacles: [{ x: 130, y: 330, r: 30 }, { x: 230, y: 330, r: 30 }, { x: 180, y: 222, r: 20 }, { x: 180, y: 430, r: 20 }],
  },
  kessel_yard: {
    id: 'kessel_yard', name: 'Kessel Yard', palette: 'ice',
    desc: 'Frozen rail yard. Points sit close to the Union line; Halcyon has room to mass.',
    points: [{ id: 'A', x: 74, y: 372 }, { id: 'B', x: 180, y: 352 }, { id: 'C', x: 286, y: 372 }],
    obstacles: [{ x: 110, y: 270, r: 22 }, { x: 250, y: 270, r: 22 }, { x: 180, y: 452, r: 18 }],
  },
  spire_approach: {
    id: 'spire_approach', name: 'Spire Approach', palette: 'night',
    desc: 'The road to the Halcyon command spire, lit by its own floodlights.',
    points: [{ id: 'A', x: 70, y: 300 }, { id: 'B', x: 180, y: 280 }, { id: 'C', x: 290, y: 300 }],
    obstacles: [{ x: 124, y: 220, r: 22 }, { x: 236, y: 220, r: 22 }, { x: 110, y: 400, r: 24 }, { x: 250, y: 400, r: 24 }, { x: 180, y: 380, r: 14 }],
  },
};
