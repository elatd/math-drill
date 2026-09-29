// Unlockable show (id041-id044).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATS, ITEMS, ITEM, pickLook, unlockedIn, isUnlocked, defaultEquip, variant } from '../app/en/js/unlocks.js';
import { TROPHY } from '../app/en/js/trophies.js';

test('catalogue: one base item per category, rewards point at real trophies, no trophy gives two', () => {
  for (const c of CATS) assert.equal(ITEMS.filter((it) => it.cat === c.key && it.base).length, 1, c.key);
  const seen = new Set();
  for (const it of ITEMS.filter((x) => !x.base)) {
    assert.ok(TROPHY[it.trophy], `${it.id} -> ${it.trophy}`);
    assert.equal(TROPHY[it.trophy].reward, it.id);
    assert.ok(!seen.has(it.trophy), `${it.trophy} used twice`); seen.add(it.trophy);
  }
  assert.equal(new Set(ITEMS.map((it) => it.id)).size, ITEMS.length);
  for (const c of CATS) assert.ok(ITEMS.filter((it) => it.cat === c.key).length >= 2, `${c.key} has a variant`);
});

test('the look: fixed choices stay, auto picks among unlocked ones only', () => {
  const got = { 'days-1': 1, 'streak-3': 1 };
  assert.ok(isUnlocked(ITEM['costume:cap'], got));
  assert.ok(!isUnlocked(ITEM['color:blue'], got));
  assert.deepEqual(unlockedIn('bg', got).map((it) => it.id), ['bg:classic', 'bg:night']);
  const eq = { ...defaultEquip(), bg: 'bg:night', color: 'color:blue' }; // blue is not unlocked: falls back to auto
  const seenBg = new Set(); const seenCostume = new Set();
  let r = 0;
  const rng = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  for (let i = 0; i < 40; i++) {
    const look = pickLook(eq, got, rng);
    seenBg.add(look.bg); seenCostume.add(look.costume);
    assert.equal(look.color, 'color:pink');
    for (const c of CATS) assert.ok(isUnlocked(ITEM[look[c.key]], got));
  }
  assert.deepEqual([...seenBg], ['bg:night']);
  assert.deepEqual([...seenCostume].sort(), ['costume:cap', 'costume:none']);
  assert.equal(variant('bg:night'), 'night');
});
