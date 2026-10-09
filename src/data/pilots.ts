import type { PilotDef } from './types.js';

export const PILOTS: Record<string, PilotDef> = {
  juno_vale: {
    id: 'juno_vale', name: 'Juno Vale', callsign: 'LAMPLIGHTER',
    bio: 'Former Branch-gate courier who knows every supply corridor in the Reach. Calm on the comms, ruthless with logistics.',
    passive: { id: 'supply', label: 'Supply regeneration +10%', value: 0.1 },
    ability: 'overclock',
  },
  ruk_okonkwo: {
    id: 'ruk_okonkwo', name: 'Ruk Okonkwo-Hale', callsign: 'FOUNDRY',
    bio: 'Demolitions engineer who built half the Union\'s forward spires and knows how to bring down the rest.',
    passive: { id: 'fortify', label: 'Turrets and spire +20% health', value: 0.2 },
    ability: 'barrage',
  },
  sable_ito: {
    id: 'sable_ito', name: 'Sable Ito', callsign: 'NIGHTJAR',
    bio: 'Signals officer who defected from Halcyon with the Directorate\'s EMP schematics in her head.',
    passive: { id: 'capture', label: 'Capture speed +25%', value: 0.25 },
    ability: 'emp',
  },
  // Enemy commanders (not unlockable)
  dir_castellan: {
    id: 'dir_castellan', name: 'Castellan Mire', callsign: 'DIRECTORATE',
    bio: 'Halcyon field director for the Cinder Reach. Treats every battle as a quarterly target.',
    passive: { id: 'supply', label: 'Supply regeneration +10%', value: 0.1 },
    ability: 'barrage',
  },
};

export const PLAYER_PILOTS = ['juno_vale', 'ruk_okonkwo', 'sable_ito'];
