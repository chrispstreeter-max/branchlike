import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProfile, applyBattleResult, upgradeUnit, upgradeInfo, validateDeck, setDeck, isMissionUnlocked, computeStars, setPilot, sanitizeProfile, START_UNITS, DEFAULT_DECK, type BattleOutcome } from '../src/meta/progression.js';
import { serialize, deserialize, loadProfile, saveProfile, memoryKV, SAVE_KEY, checksum } from '../src/meta/save.js';
import { MISSIONS } from '../src/data/missions.js';

const win = (missionId: string, battleId: string, extra: Partial<BattleOutcome> = {}): BattleOutcome => ({ battleId, missionId, won: true, time: 120, coreHpFrac: 0.9, difficulty: 'veteran', kills: 10, deployed: 8, ...extra });

test('new profile starts with the starter roster and a valid deck', () => {
  const p = newProfile();
  assert.deepEqual(p.unlockedUnits, START_UNITS);
  assert.equal(validateDeck(p, p.deck), null);
  assert.equal(p.pilot, 'juno_vale');
});

test('missions unlock in sequence', () => {
  const p = newProfile();
  assert.ok(isMissionUnlocked(p, MISSIONS[0]));
  assert.ok(!isMissionUnlocked(p, MISSIONS[1]));
  applyBattleResult(p, win(MISSIONS[0].id, 'b1'));
  assert.ok(isMissionUnlocked(p, MISSIONS[1]));
  assert.ok(!isMissionUnlocked(p, MISSIONS[2]));
});

test('first-clear rewards are paid once and unlock content', () => {
  const p = newProfile();
  const m = MISSIONS[1];
  p.missions[MISSIONS[0].id] = { cleared: true, stars: 3, bestTime: 1, plays: 1, wins: 1, bestDifficulty: 'veteran' };
  const r1 = applyBattleResult(p, win(m.id, 'battle-A'));
  assert.ok(r1.firstClear);
  assert.ok(r1.credits >= m.firstClear.credits);
  assert.ok(p.unlockedUnits.includes('mortar_crawler'));
  const credits = p.credits;
  const r2 = applyBattleResult(p, win(m.id, 'battle-B'));
  assert.ok(!r2.firstClear);
  assert.equal(p.credits - credits, r2.credits);
  assert.ok(r2.credits < m.firstClear.credits);
});

test('the same battle can never be rewarded twice (reload/restart safety)', () => {
  const p = newProfile();
  const o = win(MISSIONS[0].id, 'battle-X');
  applyBattleResult(p, o);
  const snapshot = JSON.stringify(p);
  const again = applyBattleResult(p, o);
  assert.ok(again.duplicate);
  assert.equal(JSON.stringify(p), snapshot);
  // also after a save/load round-trip
  const kv = memoryKV();
  saveProfile(kv, p);
  const loaded = loadProfile(kv).profile;
  assert.ok(applyBattleResult(loaded, o).duplicate);
});

test('losses give a little XP, no credits and no clear', () => {
  const p = newProfile();
  const r = applyBattleResult(p, win(MISSIONS[0].id, 'L1', { won: false }));
  assert.equal(r.credits, 0);
  assert.equal(r.xp, 10);
  assert.ok(!p.missions[MISSIONS[0].id].cleared);
});

test('difficulty scales repeat rewards', () => {
  const p = newProfile();
  applyBattleResult(p, win(MISSIONS[0].id, 'first'));
  const rec = applyBattleResult(p, win(MISSIONS[0].id, 'r', { difficulty: 'recruit' }));
  const eli = applyBattleResult(p, win(MISSIONS[0].id, 'e', { difficulty: 'elite' }));
  assert.ok(eli.credits > rec.credits);
});

test('stars reflect spire health and par time', () => {
  const m = MISSIONS[1];
  assert.equal(computeStars(m, false, 1, 10), 0);
  assert.equal(computeStars(m, true, 0.3, 10), 1);
  assert.equal(computeStars(m, true, 0.6, 10), 2);
  assert.equal(computeStars(m, true, 0.8, m.parTime + 1), 2);
  assert.equal(computeStars(m, true, 0.8, m.parTime), 3);
});

test('levelling up grants credits', () => {
  const p = newProfile();
  let n = 0;
  for (let i = 0; i < 20; i++) n += applyBattleResult(p, win(MISSIONS[0].id, 'lv' + i, { difficulty: 'elite' })).levelUps.length;
  assert.ok(p.level > 1 && n === p.level - 1);
});

test('upgrades cost credits, raise level and stop at max', () => {
  const p = newProfile();
  assert.equal(upgradeUnit(p, 'rifle_squad'), 'credits');
  p.credits = 10000;
  for (let i = 0; i < 4; i++) assert.equal(upgradeUnit(p, 'rifle_squad'), null);
  assert.equal(p.unitLevels.rifle_squad, 5);
  assert.equal(upgradeUnit(p, 'rifle_squad'), 'max');
  assert.equal(upgradeUnit(p, 'vesper'), 'locked');
  assert.equal(p.credits, 10000 - (120 + 240 + 360 + 480));
  assert.equal(upgradeInfo(p, 'breaker_team').cost, 120);
});

test('deck rules: size, unlocks, copies and heroes', () => {
  const p = newProfile();
  assert.equal(validateDeck(p, DEFAULT_DECK.slice(0, 7)), 'size');
  assert.equal(validateDeck(p, [...DEFAULT_DECK.slice(0, 7), 'vesper']), 'locked');
  assert.equal(validateDeck(p, ['rifle_squad', 'rifle_squad', 'rifle_squad', 'wasp_drone', 'bastion_turret', 'warden_frame', 'kestrel', 'breaker_team']), 'copies');
  assert.equal(validateDeck(p, ['rifle_squad', 'kestrel', 'kestrel', 'wasp_drone', 'bastion_turret', 'warden_frame', 'breaker_team', 'breaker_team']), 'hero_copies');
  assert.equal(setDeck(p, ['core', ...DEFAULT_DECK.slice(1)]), 'unknown');
  assert.deepEqual(p.deck, DEFAULT_DECK);
  assert.equal(setPilot(p, 'sable_ito'), false);
});

test('save/load round-trips the full profile', () => {
  const p = newProfile();
  p.credits = 777; p.unitLevels.rifle_squad = 3;
  applyBattleResult(p, win(MISSIONS[0].id, 's1'));
  const kv = memoryKV();
  saveProfile(kv, p);
  const { profile, status } = loadProfile(kv);
  assert.equal(status, 'loaded');
  assert.deepEqual(profile, p);
});

test('corrupted save falls back to the backup, and keeps the damaged copy', () => {
  const kv = memoryKV();
  const p = newProfile(); p.credits = 100;
  saveProfile(kv, p);
  p.credits = 200;
  saveProfile(kv, p); // previous save moves to backup
  kv.set(SAVE_KEY, kv.get(SAVE_KEY)!.slice(0, 50)); // truncate
  const r = loadProfile(kv);
  assert.equal(r.status, 'recovered');
  assert.equal(r.profile.credits, 100);
  assert.ok(kv.get(SAVE_KEY + '.corrupt'));
});

test('tampered checksum is detected; missing save gives a new profile', () => {
  const p = newProfile();
  const text = serialize(p).replace('"credits":0', '"credits":99999');
  assert.equal(deserialize(text), null);
  assert.equal(loadProfile(memoryKV()).status, 'new');
  assert.equal(checksum('abc'), checksum('abc'));
});

test('sanitize repairs nonsense values', () => {
  const p = sanitizeProfile({ credits: -5, xp: 'lots', unitLevels: { rifle_squad: 99 }, deck: ['nope'], pilot: 'sable_ito', unlockedUnits: ['core', 'vesper'], settings: { music: 7, difficulty: 'godlike' } });
  assert.equal(p.credits, 0);
  assert.equal(p.xp, 0);
  assert.equal(p.unitLevels.rifle_squad, 5);
  assert.deepEqual(p.deck, DEFAULT_DECK);
  assert.equal(p.pilot, 'juno_vale');
  assert.ok(!p.unlockedUnits.includes('core'));
  assert.ok(p.unlockedUnits.includes('vesper'));
  assert.equal(p.settings.music, 1);
  assert.equal(p.settings.difficulty, 'veteran');
});
