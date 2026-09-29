// Trophies (id036).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TROPHIES, TROPHY, SERIES, CATS, trophyMetrics, evaluate, seriesView, earnedCount } from '../app/en/js/trophies.js';
import { emptyProgress, masterWithAncestors } from '../app/en/js/session.js';
import { emptyStats } from '../app/en/js/growth.js';
import { SKILLS } from '../app/en/js/skills.js';

test('the catalogue: more than 100 trophies, unique ids, rising steps, known categories', () => {
  assert.ok(TROPHIES.length >= 100, `${TROPHIES.length}`);
  assert.equal(new Set(TROPHIES.map((t) => t.id)).size, TROPHIES.length);
  for (const s of SERIES) {
    assert.ok(CATS.includes(s.cat), s.cat);
    const byMetric = {};
    for (const t of s.items) { if (byMetric[t.metric] != null) assert.ok(t.need > byMetric[t.metric], t.id); byMetric[t.metric] = t.need; }
    assert.ok(s.items.every((t) => t.name && t.desc && t.rank), s.key);
  }
  // Streak and day series are denser than raw volume ones.
  const steps = (k) => SERIES.find((s) => s.key === k).items.length;
  assert.ok(steps('days') >= steps('plays'));
});

test('earning: conditions met, kept forever, first run is a quiet batch', () => {
  const stats = emptyStats();
  Object.assign(stats, { problems: 120, plays: 6, days: 4, maxCombo: 12, bestDopaL: 4.3, playMs: 40 * 60000, flags: { sunday: true } });
  const prog = emptyProgress();
  masterWithAncestors(prog, 'g1-add-c');
  const m = trophyMetrics({ stats, prog, bestStreak: 3, stickers: 4 });
  const st = {};
  assert.deepEqual(evaluate(st, m, 1), []); // first call: batch, no pop-ups
  assert.ok(st.batch.includes('problems-100') && st.batch.includes('streak-3') && st.batch.includes('dopa-4') && st.batch.includes('secret-sunday'));
  assert.ok(!st.got['problems-200'] && !st.got['dopa-5']);
  assert.ok(st.got['mastered-3'] && st.got['unlocked-5']);
  stats.problems = 205;
  assert.deepEqual(evaluate(st, trophyMetrics({ stats, prog, bestStreak: 1 }), 2).map((t) => t.id), ['problems-200']);
  assert.ok(st.got['streak-3']); // kept after the streak broke
  const v = seriesView(SERIES.find((s) => s.key === 'problems'), st, trophyMetrics({ stats, prog }));
  assert.equal(v.top.id, 'problems-200');
  assert.equal(v.next.id, 'problems-300');
  assert.equal(v.value, 205);
  assert.equal(earnedCount(st), Object.keys(st.got).length);
});

test('grade and lane completion, all modes', () => {
  const prog = emptyProgress();
  for (const s of SKILLS.filter((x) => x.grade === 1)) masterWithAncestors(prog, s.id);
  const stats = emptyStats();
  stats.modes = { level: 1, grade: 2, practice: 1, review: 1 };
  const m = trophyMetrics({ stats, prog });
  assert.equal(m.gradeDone1, 1);
  assert.equal(m.gradeDone2, 0);
  assert.equal(m.allModes, 1);
  assert.ok(TROPHY['gradeDone-1'] && TROPHY['secret-allmodes'].secret);
});

test('expanded catalogue (id045): 300+, new series measured, rewards all resolvable', async () => {
  const { ITEMS } = await import('../app/en/js/unlocks.js');
  assert.ok(TROPHIES.length >= 300, `${TROPHIES.length}`);
  for (const it of ITEMS.filter((x) => !x.base)) assert.equal(TROPHY[it.trophy].reward, it.id);
  assert.ok(Math.max(...SERIES.find((s) => s.key === 'items').items.map((x) => x.need)) <= ITEMS.length);
  const prog = emptyProgress();
  for (const s of SKILLS.filter((x) => x.grade === 1)) { masterWithAncestors(prog, s.id); prog.skills[s.id].stars = 3; }
  prog.skills['g1-add-nc'].stars = 5;
  const stats = { ...emptyStats(), polished: 2, capsules: 1, capsuleFaster: 1, grew: 5 };
  const m = trophyMetrics({ stats, prog, extra: { questDays: 7, questRun: 3, hammerUsed: 1, itemsOwned: 12, catComplete: 1 } });
  assert.equal(m.starsTotal, 3 * SKILLS.filter((x) => x.grade === 1).length + 2);
  assert.equal(m.star5, 1);
  assert.equal(m.gradeStar31, 1);
  const st = { init: true };
  const got = evaluate(st, m).map((t) => t.id);
  for (const id of ['questDays-7', 'questRun-3', 'hammer-1', 'starsTotal-5', 'star5-1', 'gradeStar3-1', 'polished-1', 'capsules-1', 'capsuleFaster-1', 'grew-5', 'items-10', 'catComplete-1']) assert.ok(got.includes(id), id);
});
