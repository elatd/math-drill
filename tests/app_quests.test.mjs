// Daily quests (id035).
import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEST, QUEST_MINUTES, dailyQuests, questMinutes, questEvent, ensureDay, allDone, claimReward, questDef } from '../app/en/js/quests.js';

const base = { count: 10, review: 3, hasNew: true, hasLearning: true, placed: true, extraOk: true, avgCells: 2.5 };
const days = Array.from({ length: 120 }, (_, i) => { const d = new Date(2026, 0, 1 + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

test('each day: two very easy quests and one harder one, fixed by the date', () => {
  const a = dailyQuests('2026-09-27', base);
  assert.deepEqual(a.map((q) => QUEST[q.id].tier), ['easy', 'easy', 'hard']);
  assert.deepEqual(dailyQuests('2026-09-27', base), a);
  const kinds = new Set(days.map((d) => dailyQuests(d, base).map((q) => q.id).join()));
  assert.ok(kinds.size > 10, 'lists vary from day to day');
  const st = {};
  assert.ok(ensureDay(st, '2026-09-27', base));
  assert.ok(!ensureDay(st, '2026-09-27', { ...base, review: 0 })); // same day keeps its list
  assert.ok(ensureDay(st, '2026-09-28', base));
});

test('only quests this child can do are offered, and all three fit in 15 minutes', () => {
  const ctxs = [];
  for (const count of [6, 10, 14]) for (const extraOk of [true, false]) for (const review of [0, 12]) for (const hasNew of [true, false]) for (const avgCells of [1.2, 3]) for (const placed of [true, false]) ctxs.push({ ...base, count, extraOk, review, hasNew, avgCells, placed });
  for (const ctx of ctxs) for (const d of days.slice(0, 40)) {
    const list = dailyQuests(d, ctx);
    const defs = list.map(questDef);
    assert.ok(questMinutes(defs, ctx) <= QUEST_MINUTES, `${d} ${JSON.stringify(ctx)} ${list.map((q) => q.id)}`);
    assert.equal(new Set(defs.map((q) => q.metric)).size, 3);
    for (const q of defs) assert.ok(!q.need || q.need(ctx), `${q.id} offered for ${JSON.stringify(ctx)}`);
    if (!ctx.extraOk) assert.ok(!list.some((q) => q.id.startsWith('extra')));
    if (!ctx.review) assert.ok(!list.some((q) => q.id === 'review1'));
  }
});

test('play events move the quests; the reward is given once', () => {
  const st = { day: '2026-09-27', list: [{ id: 'combo5', goal: 5, prog: 0, done: false }, { id: 'first5', goal: 5, prog: 0, done: false }, { id: 'extra5', goal: 5, prog: 0, done: false }] };
  assert.deepEqual(questEvent(st, { type: 'combo', value: 3 }), []);
  assert.equal(questEvent(st, { type: 'combo', value: 9 })[0].id, 'combo5');
  for (let i = 0; i < 4; i++) questEvent(st, { type: 'solve', firstTry: true });
  questEvent(st, { type: 'solve', firstTry: false });
  assert.equal(st.list[1].prog, 4);
  assert.equal(questEvent(st, { type: 'solve', firstTry: true, extra: true })[0].id, 'first5');
  assert.ok(!allDone(st) && !claimReward(st));
  for (let i = 0; i < 4; i++) questEvent(st, { type: 'solve', firstTry: false, extra: true });
  assert.ok(allDone(st));
  assert.ok(claimReward(st));
  assert.ok(!claimReward(st)); // once a day
  assert.equal(st.doneDays['2026-09-27'], true);
  // Nothing more today: finished quests stay finished.
  assert.deepEqual(questEvent(st, { type: 'combo', value: 50 }), []);
});

test('grade, review, new and learning quests count the right plays', () => {
  const st = { list: ['grade1', 'review1', 'new1', 'learn10'].map((id) => ({ id, goal: QUEST[id].goal, prog: 0, done: false })) };
  questEvent(st, { type: 'play', mode: 'level' });
  assert.equal(st.list[0].prog, 0);
  questEvent(st, { type: 'play', mode: 'grade' });
  questEvent(st, { type: 'solve', review: true, skillState: 'mastered' });
  questEvent(st, { type: 'solve', skillState: 'new' });
  questEvent(st, { type: 'solve', skillState: 'learning' });
  assert.deepEqual(st.list.map((q) => q.prog), [1, 1, 1, 2]);
});

test('polish quest: only with a rusty skill, now and then, at most twice a week (id040)', () => {
  const ctx = { ...base, rusty: ['g2-kuku25'], polishWeek: 0 };
  const lists = days.map((d) => dailyQuests(d, ctx));
  const withPolish = lists.filter((l) => l.some((q) => q.id === 'polish'));
  assert.ok(withPolish.length > 10 && withPolish.length < days.length * 0.8, `${withPolish.length}`);
  for (const l of withPolish) { const q = l.find((x) => x.id === 'polish'); assert.equal(q.skill, 'g2-kuku25'); assert.equal(questDef(q).tier, 'hard'); }
  assert.ok(days.every((d) => !dailyQuests(d, { ...ctx, polishWeek: 2 }).some((q) => q.id === 'polish')));
  assert.ok(days.every((d) => !dailyQuests(d, { ...ctx, rusty: [] }).some((q) => q.id === 'polish')));
  // Its progress counts first-try answers of that skill only.
  const st = { list: [{ id: 'polish', skill: 'g2-kuku25', goal: 3, prog: 0, done: false }] };
  questEvent(st, { type: 'solve', firstTry: true, skill: 'g1-add-nc' });
  questEvent(st, { type: 'solve', firstTry: false, skill: 'g2-kuku25' });
  questEvent(st, { type: 'solve', firstTry: true, skill: 'g2-kuku25' });
  assert.equal(st.list[0].prog, 1);
  // Recording the day keeps the weekly limit countable.
  const s2 = {};
  const d = days.find((x) => dailyQuests(x, ctx).some((q) => q.id === 'polish'));
  ensureDay(s2, d, ctx);
  assert.deepEqual(s2.polishDays, [d]);
});
