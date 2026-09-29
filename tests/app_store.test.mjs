// Local persistence for the public app (id016, id017).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../app/en/js/store.js';

function memory(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k), _m: m,
  };
}

test('defaults when storage is empty, corrupted, or throwing', () => {
  store.reset();
  assert.equal(store.load(memory()).settings.count, 10);
  store.reset();
  assert.deepEqual(store.load(memory({ 'dopa-drill:v1': '{broken' })).history, []);
  store.reset();
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(store.load(bad).settings.sound, true);
  assert.equal(store.save(bad), false);
});

test('records group by day with best score and streak', () => {
  store.reset();
  const mem = memory();
  globalThis.localStorage = mem;
  store.load(mem);
  const d = (s) => new Date(`${s}T10:00:00`);
  store.addRecord({ mode: 'basic', score: 100 }, d('2026-09-25'));
  const e = store.addRecord({ mode: 'basic', score: 100 }, d('2026-09-26'));
  store.updateRecord(e.id, { score: 410 });
  store.addRecord({ mode: 'basic', score: 100 }, d('2026-09-26'));
  store.addRecord({ mode: 'basic', score: 130 }, d('2026-09-27'));
  const m = store.monthSummary(2026, 8);
  assert.equal(m['2026-09-26'].best, 410);
  assert.equal(m['2026-09-26'].plays, 2);
  assert.equal(store.streak(d('2026-09-27')), 3);
  assert.equal(store.streak(d('2026-09-28')), 3);
  assert.equal(store.streak(d('2026-09-30')), 0);
  // Persisted and reloadable.
  store.reset(null);
  assert.equal(store.load(mem).history.length, 4);
  delete globalThis.localStorage;
});

test('reset removes every dopa-drill-prefixed key and preserves unrelated keys', () => {
  const mem = memory({ other: 'keep', 'dopa-drill:v1': '{}', 'dopa-drill:v2': '{}', 'dopa-drill': 'old', 'dopa-drill-future': 'future', 'other-dopa-drill': 'keep too' });
  store.reset(mem);
  assert.deepEqual([...mem._m], [['other', 'keep'], ['other-dopa-drill', 'keep too']]);
});

test('reset clears cached settings and progress as well as persisted data', () => {
  store.reset(null);
  const mem = memory();
  const cached = store.load(mem);
  cached.settings.count = 14;
  cached.history.push({ score: 100 });
  cached.progress = { placed: true };
  store.save(mem);
  store.reset(mem);
  assert.notEqual(store.load(mem), cached);
  assert.deepEqual(store.load(mem), store.defaultState());
  assert.equal(mem.length, 0);
});

test('reset never throws on storage errors and still clears the cache', () => {
  const blocked = () => { throw new Error('blocked'); };
  for (const storage of [null, { get length() { return blocked(); } }, { length: 1, key: blocked }, { length: 1, key: () => 'dopa-drill:v1', removeItem: blocked }]) {
    store.load(memory()).history.push({ score: 100 });
    assert.doesNotThrow(() => store.reset(storage));
    assert.deepEqual(store.load(memory()), store.defaultState());
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: blocked });
    assert.doesNotThrow(() => store.reset());
    assert.deepEqual(store.load(), store.defaultState());
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('reset uses the browser storage by default and continues after a failed removal', () => {
  const mem = memory({ 'dopa-drill:v1': '{}', 'dopa-drill:blocked': '{}', unrelated: 'keep' });
  const remove = mem.removeItem;
  mem.removeItem = (key) => { if (key === 'dopa-drill:blocked') throw new Error('blocked'); remove(key); };
  globalThis.localStorage = mem;
  try {
    assert.doesNotThrow(() => store.reset());
    assert.equal(mem.getItem('dopa-drill:v1'), null);
    assert.equal(mem.getItem('unrelated'), 'keep');
  } finally { delete globalThis.localStorage; }
});

test('login bonus: once per day, 7-day card, restarts after a gap', () => {
  store.reset();
  const mem = memory();
  globalThis.localStorage = mem;
  store.load(mem);
  const d = (s) => new Date(`${s}T09:00:00`);
  const a = store.claimLogin(d('2026-09-01'));
  assert.deepEqual([a.run, a.slot, a.type], [1, 1, 'star']);
  assert.equal(store.claimLogin(d('2026-09-01')), null);
  let last;
  for (let i = 2; i <= 8; i++) last = store.claimLogin(d(`2026-09-${String(i).padStart(2, '0')}`));
  assert.equal(last.run, 8);
  assert.equal(last.slot, 1);
  assert.equal(store.stickerOn('2026-09-07'), 'crown');
  const gap = store.claimLogin(d('2026-09-12'));
  assert.equal(gap.run, 1);
  assert.equal(gap.total, 9);
  delete globalThis.localStorage;
});

test('best streak counts the longest run of played days', () => {
  store.reset();
  const mem = memory();
  globalThis.localStorage = mem;
  store.load(mem);
  const d = (s) => new Date(`${s}T10:00:00`);
  for (const day of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05', '2026-09-06']) store.addRecord({ mode: 'level', score: 100 }, d(day));
  assert.equal(store.bestStreak(), 3);
  delete globalThis.localStorage;
});

test('no-count hammer bridges missed days for streaks and the login card (id034)', () => {
  store.reset();
  const mem = memory();
  globalThis.localStorage = mem;
  store.load(mem);
  const d = (s) => new Date(`${s}T10:00:00`);
  for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) { store.claimLogin(d(day)); store.addRecord({ mode: 'level', score: 100 }, d(day)); }
  assert.equal(store.items().hammer, store.HAMMER.first); // one to start with
  // One missed day (9/4), one hammer: offered, keeps a 3-day streak.
  const offer = store.hammerOffer(d('2026-09-05'));
  assert.deepEqual(offer.days, ['2026-09-04']);
  assert.equal(offer.run, 3);
  assert.ok(store.useHammer(offer.days, d('2026-09-05')));
  assert.equal(store.items().hammer, 0);
  assert.equal(store.hammerOffer(d('2026-09-05')), null); // asked once a day
  assert.equal(store.streak(d('2026-09-05')), 3); // the no-count day is not counted
  store.addRecord({ mode: 'level', score: 100 }, d('2026-09-05'));
  assert.equal(store.streak(d('2026-09-05')), 4);
  assert.equal(store.bestStreak(), 4);
  assert.equal(store.claimLogin(d('2026-09-05')).run, 4); // the card continues too
  // Two missed days with a single hammer: not offered (it would not save the streak).
  assert.equal(store.addHammer(5), store.HAMMER.max); // capped
  store.items().hammer = 1;
  assert.equal(store.hammerOffer(d('2026-09-08')), null);
  store.items().hammer = 2;
  assert.deepEqual(store.hammerOffer(d('2026-09-08')).days, ['2026-09-06', '2026-09-07']);
  // Declining keeps the old behaviour: the streak breaks.
  store.declineHammer(d('2026-09-08'));
  assert.equal(store.hammerOffer(d('2026-09-08')), null);
  assert.equal(store.streak(d('2026-09-08')), 0);
  // Nothing beyond the reach (a week) and nothing for a 1-day streak.
  assert.equal(store.hammerOffer(d('2026-09-20')), null);
  store.addRecord({ mode: 'level', score: 100 }, d('2026-09-20'));
  assert.equal(store.hammerOffer(d('2026-09-22')), null);
  delete globalThis.localStorage;
});

test('guideSeen defaults to false for fresh, legacy, corrupt and invalid saves', () => {
  for (const raw of [null, '{broken', JSON.stringify({ version: 1 }), ...[false, 'true', 1, null].map((guideSeen) => JSON.stringify({ version: 1, guideSeen }))]) {
    store.reset(null);
    store.load(memory(raw ? { 'dopa-drill:v1': raw } : {}));
    assert.equal(store.hasSeenGuide(), false);
  }
});

test('markGuideSeen persists across reloads and unrelated settings updates', () => {
  const mem = memory();
  store.reset(null);
  globalThis.localStorage = mem;
  try {
    store.markGuideSeen();
    store.updateSettings({ volume: 0.25 });
    store.reset(null);
    assert.equal(store.hasSeenGuide(), true);
    assert.equal(store.settings().volume, 0.25);
    store.reset(mem);
    assert.equal(store.hasSeenGuide(), false);
  } finally { delete globalThis.localStorage; store.reset(null); }
});

test('guideSeen remains usable for this visit when storage cannot be written', () => {
  const mem = memory();
  mem.setItem = () => { throw new Error('blocked'); };
  store.reset(null);
  globalThis.localStorage = mem;
  try {
    assert.doesNotThrow(() => store.markGuideSeen());
    assert.equal(store.hasSeenGuide(), true);
    store.reset(null);
    assert.equal(store.hasSeenGuide(), false);
  } finally { delete globalThis.localStorage; store.reset(null); }
});
