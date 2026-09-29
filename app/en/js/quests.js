// Daily quests (id035): two very easy ones and one that takes a little more,
// all done in about 15 minutes of play. The day's list is chosen from the
// date (so it is the same all day) and from what this child can do today.
// Pure logic; main.js feeds play events and saves the state.

import { SKILL } from './skills.js';

export const QUEST_MINUTES = 15;

// Rough minutes for one play: 18 s a problem, the 90 s extra when the child
// usually reaches it, and half a minute for results and transitions.
export const playMinutes = (count, withExtra) => (count * 18 + (withExtra ? 90 : 0) + 30) / 60;
const reviewMinutes = (ctx) => (Math.min(10, Math.max(1, ctx.review)) * 18 + 30) / 60;

// metric: which play event moves it (see questEvent). mode: where it can be
// done ('any' play, or only a review / grade / practice play). plays: how many
// plays it takes for this child. need: whether it can be offered today.
const cellsPerPlay = (c) => c.count * c.avgCells;
export const QUESTS = [
  { id: 'play1', tier: 'easy', metric: 'play', goal: 1, text: () => 'Play once', mode: 'any', plays: () => 1 },
  { id: 'combo5', tier: 'easy', metric: 'combo', goal: 5, text: () => 'Get a 5 combo', mode: 'any', plays: () => 1 },
  { id: 'first5', tier: 'easy', metric: 'firstTry', goal: 5, text: () => 'Get 5 right on the first try', mode: 'any', plays: (c) => Math.ceil(5 / (c.count * 0.7)) },
  { id: 'review1', tier: 'easy', metric: 'review', goal: 1, text: () => 'Review 1 problem', mode: 'review', plays: () => 1, need: (c) => c.review > 0 },
  { id: 'new1', tier: 'easy', metric: 'newSkill', goal: 1, text: () => 'Solve 1 from a NEW skill', mode: 'any', plays: () => 1, need: (c) => c.hasNew },
  { id: 'extra', tier: 'hard', metric: 'extraReach', goal: 1, text: () => 'Reach Extra', mode: 'any', plays: () => 1, need: (c) => c.extraOk },
  { id: 'extra5', tier: 'hard', metric: 'extraSolved', goal: 5, text: () => 'Solve 5 in Extra', mode: 'any', plays: () => 1, need: (c) => c.extraOk },
  { id: 'combo20', tier: 'hard', metric: 'combo', goal: 20, text: () => 'Get a 20 combo', mode: 'any', plays: () => 2, need: (c) => cellsPerPlay(c) >= 26 },
  { id: 'play2', tier: 'hard', metric: 'play', goal: 2, text: () => 'Play twice', mode: 'any', plays: () => 2 },
  { id: 'grade1', tier: 'hard', metric: 'gradePlay', goal: 1, text: () => 'Play one Grade drill', mode: 'grade', plays: () => 1 },
  { id: 'learn10', tier: 'hard', metric: 'learning', goal: 10, text: () => 'Solve 10 from skills you are learning', mode: 'any', plays: (c) => Math.ceil(10 / (c.count * 0.6)), need: (c) => c.hasLearning && c.placed },
];
export const QUEST = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// Extra quest kinds added by other features (e.g. polishing a rusty skill,
// id040) register here: { ...fields, pick(ctx, rng) -> extra fields or null }.
export const DYNAMIC = [
  // Polish a rusty skill (id040): now and then, at most twice a week, only
  // when a skill is rusty. Tapping it on the title starts that practice.
  { id: 'polish', tier: 'hard', metric: 'skill', goal: 3, mode: 'practice', plays: () => 1,
    text: (q) => { const name = SKILL[q.skill] ? SKILL[q.skill].name : ''; return `Polish "${name}" (3 problems)`; },
    pick(ctx, rng) {
      const chance = rng();
      if (!ctx.rusty || !ctx.rusty.length || (ctx.polishWeek || 0) >= POLISH.perWeek || chance >= POLISH.chance) return null;
      return { skill: ctx.rusty[0] };
    } },
];
export const POLISH = { perWeek: 2, chance: 0.5 };
export const questDef = (q) => QUEST[q.id] || DYNAMIC.find((d) => d.id === q.id);

// Minutes to finish a list: quests for 'any' play ride along on grade or
// practice plays; review plays are short and do not count for them.
export function questMinutes(list, ctx) {
  const pm = playMinutes(ctx.count, ctx.extraOk);
  let any = 0; let total = 0; let shared = 0;
  const special = {};
  for (const q of list) {
    const n = q.plays(ctx);
    if (q.mode === 'any') any = Math.max(any, n);
    else special[q.mode] = Math.max(special[q.mode] || 0, n);
  }
  for (const [mode, n] of Object.entries(special)) {
    if (mode === 'review') total += n * reviewMinutes(ctx);
    else { total += n * pm; shared += n; }
  }
  return total + Math.max(0, any - shared) * pm;
}

function hashDay(day) { let h = 2166136261; for (const ch of day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed) { let s = seed || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
const shuffle = (list, rng) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ctx: { count, review, hasNew, hasLearning, placed, extraOk, avgCells, ... }
export function dailyQuests(day, ctx) {
  const rng = rngFrom(hashDay(day));
  const extras = DYNAMIC.map((d) => { const f = d.pick ? d.pick(ctx, rng) : null; return f ? { ...d, ...f } : null; }).filter(Boolean);
  const avail = [...QUESTS.filter((q) => !q.need || q.need(ctx)), ...extras];
  const easy = shuffle(avail.filter((q) => q.tier === 'easy'), rng);
  // A dynamic quest (when offered today) goes first in the hard pool.
  const hard = [...extras.filter((q) => q.tier === 'hard'), ...shuffle(avail.filter((q) => q.tier === 'hard' && !extras.includes(q)), rng)];
  for (const h of hard) {
    for (let i = 0; i < easy.length; i++) {
      for (let j = i + 1; j < easy.length; j++) {
        const list = [easy[i], easy[j], h];
        if (new Set(list.map((q) => q.metric)).size < 3) continue;
        if (questMinutes(list, ctx) <= QUEST_MINUTES) return list.map((q) => ({ id: q.id, goal: q.goal, prog: 0, done: false, ...(q.skill ? { skill: q.skill } : {}) }));
      }
    }
  }
  return ['play1', 'combo5', 'play2'].map((id) => ({ id, goal: QUEST[id].goal, prog: 0, done: false }));
}

export const questText = (q) => { const d = questDef(q); return d ? d.text(q) : ''; };

// The saved state keeps today's list; a new day brings a new one.
export function ensureDay(state, day, ctx) {
  if (state.day === day && Array.isArray(state.list)) return false;
  state.day = day;
  state.list = dailyQuests(day, ctx);
  if (state.list.some((q) => q.id === 'polish')) state.polishDays = [...(state.polishDays || []), day].slice(-14);
  state.rewarded = false;
  state.doneDays = state.doneDays || {};
  return true;
}

// Play events: { type: 'solve', firstTry, review, extra, skill, skillState }
// | { type: 'combo', value } | { type: 'play', mode } | { type: 'extra' }.
// Returns the quests completed by this event.
export function questEvent(state, ev) {
  const done = [];
  for (const q of state.list || []) {
    if (q.done) continue;
    const d = questDef(q);
    if (!d) continue;
    const before = q.prog;
    switch (d.metric) {
      case 'play': if (ev.type === 'play') q.prog += 1; break;
      case 'gradePlay': if (ev.type === 'play' && ev.mode === 'grade') q.prog += 1; break;
      case 'combo': if (ev.type === 'combo') q.prog = Math.max(q.prog, Math.min(q.goal, ev.value)); break;
      case 'firstTry': if (ev.type === 'solve' && ev.firstTry) q.prog += 1; break;
      case 'review': if (ev.type === 'solve' && ev.review) q.prog += 1; break;
      case 'newSkill': if (ev.type === 'solve' && ev.skillState === 'new') q.prog += 1; break;
      case 'learning': if (ev.type === 'solve' && (ev.skillState === 'new' || ev.skillState === 'learning')) q.prog += 1; break;
      case 'extraReach': if (ev.type === 'extra') q.prog += 1; break;
      case 'extraSolved': if (ev.type === 'solve' && ev.extra) q.prog += 1; break;
      case 'skill': if (ev.type === 'solve' && ev.firstTry && ev.skill === q.skill) q.prog += 1; break;
      default: break;
    }
    q.prog = Math.min(q.goal, q.prog);
    if (q.prog >= q.goal && before < q.goal) { q.done = true; done.push(q); }
  }
  return done;
}

export const allDone = (state) => !!(state.list && state.list.length && state.list.every((q) => q.done));

// The day's reward is given once, when all three are done. The caller adds
// the hammer (store.addHammer, capped at the limit). No further rewards today.
export function claimReward(state) {
  if (!allDone(state) || state.rewarded) return false;
  state.rewarded = true;
  state.doneDays = state.doneDays || {};
  state.doneDays[state.day] = true;
  return true;
}
