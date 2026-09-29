// Game flow, input, scoring, and the "director" that turns every event into
// escalating visuals and sound.
import { startClock, onFrame, wait, tween, clamp, lerp, rand, pick, chance, centerOf, params,
  easeOutBack, easeOutCubic, easeInCubic, easeInOutCubic, easeOutQuint } from './core.js';
import { makeRng, generate, makeProblem, signature, BASIC_SETS, EXTRA_TIERS } from './problems.js';
import { AudioEngine } from './audio.js';
import { Dopakichi, COSTUMES, dopakichiSVG } from './dopakichi.js';
import { FX } from './fx.js';
import { Backdrop } from './bg.js';
import * as store from './store.js';
import { createGuide } from './guide.js';
import { SKILLS, SKILL, LANES, DEPTH } from './skills.js';
import { ORDER, emptyProgress, recordResult, stateOf, masteryRatio, starsOf, nextStar, STAR_MAX, pickCapsule, useCapsule, rustyOf, gradePlan, levelPlan, reviewPlan, problemFor, frontier, isUnlocked, relockTargets, relockSkill, TREE_LAYOUT } from './session.js';
import * as growth from './growth.js';
import * as qs from './quests.js';
import * as tr from './trophies.js';
import * as ul from './unlocks.js';
import { BASIC_SCORE, extraPoints, basicDopaL, extraProblemGain, addDopa, comboMult, comboMaxed, comboWindowMs, comboMilestone, fmtDopa, unitOf, unitLabel } from './scoring.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const capture = params.has('capture');
const EXTRA_MS = Number(params.get('extra') || 90) * 1000;
const audio = new AudioEngine({ capture });
const fx = new FX($('#fx'), 300);
const fxBack = new FX($('#fx-back'), 520);
const bg = new Backdrop($('#bg'), $('#rays-fallback'));
const backLayer = $('#actors-back');
const frontLayer = $('#actors-front');
const hero = new Dopakichi(backLayer, { scale: 0.72, front: frontLayer });
const actors = [hero];
const crowd = [];
const body = document.body;
const sheet = $('#sheet');
const card = $('#card');
const stage = $('#stage');
const padButtons = Object.fromEntries($$('#pad button').map((b) => [b.dataset.key, b]));

const S = {
  screen: 'title', N: 10, rng: null, qi: 0, problems: [], problem: null, step: 0,
  E: 0.06, visualE: 0.02, level: 0, ready: false, reach: false, shownWrong: null, wrongInQ: false,
  firstTry: 0, solved: 0, misses: 0, combo: 0, comboEnd: 0, comboLimit: 1, startT: 0, endT: 0, targetMs: 0, mode: 'basic',
  extra: { score: 0, solved: 0, misses: 0, end: 0, over: false }, digitsDone: 0, digitsTotal: 1,
  dopa: { L: 0, shown: 0, unit: '' }, reduced: false, motion: 1, settingsOpen: false,
  run: 0, muted: false, kick: 0, flash: 0, shake: 0, cells: {}, lines: {}, idleAt: 0, busyUntil: 0,
};
window.__dopa = { S, audio };
const guide = createGuide({ hero, reduced: () => S.reduced, onClose: () => {
  store.markGuideSeen();
  S.guideOpen = false;
  requestAnimationFrame(layoutActors);
  checkLoginBonus();
} });
function openGuide(help = false) {
  if (S.demo || S.screen !== 'title' || S.guideOpen || S.settingsOpen || S.bonusOpen || S.hammerOpen || S.trophyOpen || S.confirm || S.scene) return;
  clearTimeout(titleRewardTimer);
  S.guideOpen = true;
  guide.open({ help });
}

// ---------------------------------------------------------------- utilities
const fmtTime = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// "1 skill", "3 skills".
const nOf = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// "A", "A and B", "A, B and C".
const listJoin = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
// Shrink a one-line banner (inline font size) so it fits the screen width.
function fitWidth(el, max = innerWidth - 24) {
  const w = el.offsetWidth;
  if (w > max) el.style.fontSize = `${(parseFloat(el.style.fontSize) * max) / w}px`;
}
const now = () => performance.now();

function setLevelClasses(L) {
  for (let i = 0; i <= 10; i++) body.classList.toggle(`lv${i}`, i <= L);
}

function showScreen(name) {
  S.screen = name;
  $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === `screen-${name}`));
  const el = $(`#screen-${name}`);
  if (!S.reduced) tween(260, (k) => { el.style.opacity = k; el.style.transform = `translateY(${(1 - k) * 18}px)`; }).then(() => { el.style.transform = ''; });
  requestAnimationFrame(layoutActors);
}

function layoutActors() {
  // A scripted scene (the hammer) moves the hero itself.
  if (S.scene || S.guideOpen) return;
  // Cancel any running body action so it does not drag the hero back to old coordinates.
  hero.begin();
  let r;
  if (S.settingsOpen || S.bonusOpen || S.confirm || S.hammerOpen || S.trophyOpen || S.skillInfo) {
    const c = $(S.bonusOpen ? '#bonus .modal-card' : S.confirm ? '#confirm .modal-card' : S.hammerOpen ? '#hammer .modal-card' : S.trophyOpen ? '#trophy-got .modal-card' : S.skillInfo ? '#skill-info .modal-card' : '#settings .modal-card').getBoundingClientRect();
    hero.S = 0.5; hero.place(c.left + c.width * 0.78, c.top + 4); hero.lift = 0; hero.rot = 0;
    return;
  }
  if (S.screen === 'trophy') {
    // Between the title and the count, clear of the filter buttons.
    const h = $('#screen-trophy .tree-head').getBoundingClientRect();
    const c = $('#trophy-count').getBoundingClientRect();
    hero.S = 0.3; hero.place(c.left - 34, h.bottom - 16); hero.lift = 0; hero.rot = 0;
    crowd.forEach((m, i) => placeCrowd(m, i));
    return;
  }
  if (S.screen === 'collect') {
    const b = $('#co-preview').getBoundingClientRect();
    hero.S = clamp(b.height / 260, 0.4, 0.62); hero.place(b.left + b.width / 2, b.bottom - 14); hero.lift = 0; hero.rot = 0;
    return;
  }
  if (S.screen === 'tree') {
    const h = $('#screen-tree .tree-head').getBoundingClientRect();
    hero.S = 0.36; hero.place(h.right - 110, h.bottom + 2); hero.lift = 0; hero.rot = 0;
    crowd.forEach((c, i) => placeCrowd(c, i));
    return;
  }
  if (S.screen === 'title') r = $('#title-stage').getBoundingClientRect();
  else if (S.screen === 'play') r = stage.getBoundingClientRect();
  else r = $(`#screen-${S.screen} .result-card`).getBoundingClientRect();
  const onCard = S.screen === 'result' || S.screen === 'final';
  const scale = S.screen === 'title' ? clamp(r.height / 190, 0.7, 1.1) : onCard ? 0.6 : clamp(r.height / 175, 0.5, 0.74);
  hero.S = scale;
  const x = r.left + r.width / 2;
  const y = onCard ? r.top + 6 : r.bottom - 12;
  hero.place(x, y);
  hero.lift = 0; hero.rot = 0;
  crowd.forEach((c, i) => placeCrowd(c, i));
}

// ---------------------------------------------------------------- problems
// ---------------------------------------------------------------- sessions
const progress = () => { const st = store.load(); if (!st.progress) st.progress = emptyProgress(); return st.progress; };
// Lifetime statistics (id033); older saves are seeded from their play history.
const stats = () => { const st = store.load(); if (!st.stats) st.stats = growth.statsFromHistory(st.history); return st.stats; };
// Demo play and the check-only URL parameters (?skill=, ?demo) leave no growth records.
const recording = () => !S.demo && !params.has('skill') && !(S.plan && S.plan.legacy);

// ---------------------------------------------------------------- daily quests (id035)
const pickedCount = () => Number(($('.pick [aria-checked="true"]') || {}).dataset?.count || 10);
function questCtx() {
  const prog = progress();
  const st = stats();
  const states = SKILLS.map((x) => stateOf(prog, x.id));
  return {
    count: pickedCount(), review: prog.review.length, placed: !!prog.placed,
    hasNew: states.includes('new'), hasLearning: states.includes('learning') || states.includes('new'),
    extraOk: store.load().history.slice(-5).some((h) => h.extraOk != null),
    avgCells: st.cells && st.problems ? st.cells / st.problems : 2,
    rusty: rustyOf(prog),
    polishWeek: ((store.load().quests || {}).polishDays || []).filter((d) => growth.daysBetween(d, store.dayKey()) < 7).length,
    prog, now: Date.now(),
  };
}
const quests = () => { const st = store.load(); if (!st.quests) st.quests = {}; if (qs.ensureDay(st.quests, store.dayKey(), questCtx())) store.save(); return st.quests; };
function questNote(ev) {
  if (!recording()) return;
  const q = quests();
  const done = qs.questEvent(q, ev);
  done.forEach((d, i) => setTimeout(() => questPop(d), i * 700));
  if (done.length && qs.claimReward(q)) {
    S.questReward = { hammer: store.addHammer(1) };
    setTimeout(() => questPop(null), done.length * 700 + 200);
  }
  if (done.length) store.save();
}
const CHECK_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5 L8.5 15 L16 5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function questRows(list) {
  return list.map((q) => {
    const k = Math.min(1, q.prog / q.goal);
    return `<li class="${q.done ? 'done' : ''}${q.skill && !q.done ? ' go' : ''}"${q.skill ? ` data-skill="${q.skill}"` : ''}><i class="qchk">${q.done ? CHECK_SVG : ''}</i><span class="qt">${qs.questText(q)}</span><span class="qp">${Math.min(q.prog, q.goal)}/${q.goal}</span><i class="qbar" style="--p:${k.toFixed(3)}"></i></li>`;
  }).join('');
}
function questRewardText(q) {
  if (q.rewarded) return '<b class="qdone">Complete!</b>';
  return `Clear all: <i class="qham">${HAMMER_SVG}</i>+1`;
}
function renderQuests() {
  const q = quests();
  $('#quest-list').innerHTML = questRows(q.list);
  $('#quest-reward').innerHTML = questRewardText(q);
  $('#quests').classList.toggle('complete', !!q.rewarded);
}
// Compact card on the result screens; celebrates a completion that happened in this play.
function renderQuestMini(el) {
  if (!recording()) { el.innerHTML = ''; return; }
  const q = quests();
  const got = S.questReward;
  S.questReward = null;
  el.innerHTML = `<p class="qm-head">${"Today's quests"} <span>${questRewardText(q)}</span></p><ol class="quest-list">${questRows(q.list)}</ol>${got ? `<p class="qm-got">${got.hammer ? `<i class="qham">${HAMMER_SVG}</i>You got a Streak Hammer!` : "Your hammers are full! Let's just celebrate."}</p>` : ''}`;
  if (got && !S.reduced) setTimeout(() => { const c = centerOf(el); fx.burst(c.x, c.y, { count: 50, kinds: ['star', 'confetti', 'coin'], speed: 600, up: 180 }); audio.unit(0.7); popEl(el, 0.12, 400); }, 900);
}
// A small banner at the top of the screen; it never covers the problem or the keypad.
function questPop(q) {
  audio.play('coin', audio.now(), { v: 0.12, m: 88 });
  const el = document.createElement('div');
  el.className = `quest-pop${q ? '' : ' all'}`;
  el.innerHTML = q ? `<b>Quest clear!</b><span>${qs.questText(q)}</span>` : '<b>All quests complete!</b>';
  $('#cutins').appendChild(el);
  const y = Math.max(8, $('#app').getBoundingClientRect().top + 6);
  el.style.top = `${y}px`;
  (async () => {
    if (!S.reduced) await tween(260, (k) => { el.style.transform = `translate(-50%, ${(1 - k) * -60}px) scale(${0.8 + 0.2 * k})`; el.style.opacity = k; }, easeOutBack);
    else { el.style.transform = 'translate(-50%, 0)'; el.style.opacity = 1; }
    await wait(1500);
    await tween(220, (k) => { el.style.opacity = 1 - k; });
    el.remove();
  })();
}
const REVIEW_MAX = 40;
const MODE_LABEL = { level: 'My Level', grade: (g) => `Grade ${g}`, review: 'Review', practice: 'Practice', drill: 'Drill' };

// kind: 'level' | 'grade' | 'review' | 'practice' | 'drill'
function makePlan(kind, arg) {
  const prog = progress();
  if (kind === 'grade') return gradePlan(arg, S.N, S.rng);
  if (kind === 'review') { const items = prog.review.slice(-Math.min(S.N, 10)); return reviewPlan(items); }
  if (kind === 'practice') return { mode: 'practice', skill: arg, basic: Array.from({ length: S.N }, () => arg), extra: () => { const kids = SKILLS.filter((x) => x.req.includes(arg) && isUnlocked(prog, x.id)); return kids.length ? kids[Math.floor(S.rng() * kids.length)].id : arg; } };
  if (kind === 'demo') {
    // Random skills from every grade, ordered easy -> hard so the show escalates.
    const pool = SKILLS.slice();
    const basic = Array.from({ length: S.N }, () => pool[Math.floor(S.rng() * pool.length)])
      .sort((x, y) => x.grade - y.grade || DEPTH[x.id] - DEPTH[y.id]).map((x) => x.id);
    const upper = SKILLS.filter((x) => x.grade >= 4).map((x) => x.id);
    return { mode: 'demo', basic, extra: () => upper[Math.floor(S.rng() * upper.length)] };
  }
  if (kind === 'drill' || params.has('demo')) return { mode: 'drill', legacy: true, basic: BASIC_SETS[S.N] || BASIC_SETS[10] };
  return levelPlan(prog, S.N, S.rng);
}

function nextProblem(i) {
  const plan = S.plan;
  if (plan.mode === 'review') return structuredClone(plan.items[i].problem);
  if (plan.legacy) return generate(plan.basic[i], S.rng, i === 0 ? { kind: 'add', a: 27, b: 35 } : null);
  const skill = params.get('skill') || (plan.placement ? plan.pick() : plan.basic[i]);
  return sessionProblem(skill);
}
function sessionProblem(skill) {
  const prog = progress();
  const r = prog.skills[skill];
  const recent = new Set([...(r ? r.recent : []), ...S.sessionSigs]);
  let p = makeProblem(skill, S.rng, recent);
  S.sessionSigs.add(signature(p));
  return p;
}

function basicE(i) { return S.N <= 1 ? 1 : 0.08 + 0.92 * (i / (S.N - 1)) ** 1.3; }

function applyLevel(E, { key, bpm } = {}) {
  S.E = E;
  const L = Math.min(10, Math.round(E * 10));
  S.level = L;
  setLevelClasses(L);
  if (key !== undefined) audio.key = key;
  audio.setLevel(L, bpm || 112 + 16 * Math.min(1, E));
  hero.bob = clamp(E * 1.4);
  ensureCrowd(E);
}

function renderSheet(p) {
  sheet.innerHTML = '';
  sheet.className = `sheet ${p.kind}`;
  sheet.style.setProperty('--cols', p.cols);
  sheet.style.setProperty('--rows', p.rows);
  S.cells = {}; S.lines = {};
  if (p.bracket) {
    const b = document.createElement('div');
    b.className = 'bracket';
    b.style.gridRow = `${p.bracket.r + 1}`;
    b.style.gridColumn = `${p.bracket.c0 + 1} / ${p.bracket.c1 + 2}`;
    sheet.appendChild(b);
  }
  for (const l of p.lines) {
    const d = document.createElement('div');
    d.className = `hline${l.hidden ? ' hidden' : ''}${l.frac ? ' fbar' : ''}`;
    d.style.gridRow = `${l.r + 1}`;
    d.style.gridColumn = `${l.c0 + 1} / ${l.c1 + 2}`;
    sheet.appendChild(d);
    if (l.id) S.lines[l.id] = d;
  }
  for (const c of p.cells) {
    const d = document.createElement('div');
    d.className = `cell ${c.kind}${c.small ? ' small' : ''}${c.cls ? ` ${c.cls}` : ''}`;
    d.style.gridRow = c.rs ? `${c.r + 1} / span ${c.rs}` : `${c.r + 1}`;
    d.style.gridColumn = c.cs ? `${c.c + 1} / span ${c.cs}` : `${c.c + 1}`;
    if (c.kind === 'input') { d.textContent = ''; d.setAttribute('aria-label', 'Answer box'); }
    else if (c.kind === 'auto' || c.kind === 'carry') { d.textContent = c.text; d.classList.add('hidden'); }
    else d.textContent = c.text;
    if (c.text === '.' && c.kind === 'auto') d.classList.add('dot');
    sheet.appendChild(d);
    S.cells[c.id] = d;
    d.dataset.id = c.id;
  }
  fitSheet(p);
}

// Size the grid so any layout (wide expressions, tall long division) fits the card.
function fitSheet(p) {
  const wrap = sheet.parentElement;
  const availW = Math.max(200, wrap.clientWidth - 16);
  const availH = parseFloat(getComputedStyle(wrap).minHeight) || 200;
  const base = p.kind === 'div' ? 46 : 56;
  const cw = Math.min(base, availW / p.cols);
  const ch = Math.min(cw * (p.kind === 'div' ? 0.78 : 0.95), availH / p.rows);
  sheet.style.setProperty('--cw', `${cw.toFixed(1)}px`);
  sheet.style.setProperty('--ch', `${ch.toFixed(1)}px`);
}

function activate(k) {
  const p = S.problem;
  $$('.cell.active').forEach((c) => c.classList.remove('active', 'has'));
  const st = p.steps[k];
  if (!st) return;
  const cell = S.cells[st.cell];
  cell.classList.add('active');
  if (st.marks) {
    for (const m of st.marks) {
      const mk = S.cells[`m${m.c}`]; const top = S.cells[`a${m.c}`];
      if (!mk) continue;
      mk.textContent = m.text;
      top && top.classList.add('struck');
      if (!S.reduced) tween(360, (e) => { mk.style.transform = `translateY(${(1 - e) * -14}px) scale(${0.4 + 0.6 * e})`; mk.style.opacity = e; }, easeOutBack);
    }
  }
  S.stepMisses = 0;
  armCombo(k === 0);
  $$('.cell.hint-glow').forEach((c) => c.classList.remove('hint-glow'));
  $('#step-label').innerHTML = `<b>${st.label}</b>${st.hint ? ` · ${st.hint}` : ''}`;
  if (k === p.steps.length - 1 && k > 0 && S.E >= 0.45 && !S.reach) startReach();
}

// ---------------------------------------------------------------- flow
function startGame(kind = 'level', arg) {
  audio.unlock();
  S.run += 1;
  if (S.bonusOpen) { $('#bonus').hidden = true; S.bonusOpen = false; }
  S.N = Number($('.pick [aria-checked="true"]').dataset.count);
  S.rng = makeRng(Number(params.get('seed') || Math.floor(Math.random() * 1e9)));
  S.sessionSigs = new Set();
  S.kind = kind; S.kindArg = arg;
  S.plan = makePlan(kind, arg);
  applyLook(playLook());
  if (S.plan.mode === 'review') S.N = S.plan.items.length;
  S.problems = [];
  S.wrongList = []; S.newUnlocks = []; S.newMastered = []; S.newStars = {}; S.sessionTimes = {}; S.capsuleNews = null; S.polished = [];
  planCapsule();
  Object.assign(S, { endT: 0, qi: 0, firstTry: 0, solved: 0, misses: 0, combo: 0, comboPeak: 0, mode: 'basic', reach: false });
  showCombo();
  S.dopa = { L: 0, shown: 0, unit: '' };
  S.extra = { score: 0, solved: 0, misses: 0, end: 0, over: false };
  S.targetMs = Math.ceil((S.N * 18) / 10) * 10 * 1000;
  $('#clock-label').textContent = `Goal ${fmtTime(S.targetMs)}`;
  $('.clock').classList.remove('over', 'extra', 'hurry');
  $('#ok-total').textContent = `/${S.N}`;
  const pips = $('#pips');
  pips.innerHTML = '';
  pips.classList.toggle('many', S.N > 10);
  for (let i = 0; i < S.N; i++) { const s = document.createElement('span'); s.className = 'pip'; pips.appendChild(s); }
  updateTally();
  audio.key = 0;
  audio.startMusic();
  audio.jingle();
  showScreen('play');
  S.startT = now();
  setupProblem();
}

function updateTally() {
  $('#ok').textContent = S.mode === 'extra' ? S.extra.solved : S.solved;
  $('#ng').textContent = S.mode === 'extra' ? S.extra.misses : S.misses;
}

async function setupProblem() {
  S.ready = false;
  const extra = S.mode === 'extra';
  let E;
  if (extra) {
    const tier = Math.floor(S.extra.solved / 3);
    E = 1 + Math.min(0.5, tier * 0.1);
    applyLevel(E, { key: 2 + Math.min(tier, 5), bpm: 134 + tier * 5 });
    if (S.plan.legacy) { const pool = EXTRA_TIERS[Math.min(tier, EXTRA_TIERS.length - 1)]; S.problem = generate(pool[S.extra.solved % pool.length], S.rng); }
    else S.problem = sessionProblem(params.get('skill') || S.plan.extra(S.extra.solved));
  } else {
    E = basicE(S.qi);
    applyLevel(E, { key: S.qi === S.N - 1 ? 2 : 0 });
    S.problem = S.problems[S.qi] || (S.problems[S.qi] = nextProblem(S.qi));
  }
  const p = S.problem;
  S.step = 0; S.wrongInQ = false; S.shownWrong = null;
  $$('.pip').forEach((pp, i) => pp.classList.toggle('now', !extra && i === S.qi));
  $('#qtitle').textContent = p.title;
  $('#qno').textContent = extra ? `EX ${S.extra.solved + 1}` : `Q${S.qi + 1}`;
  renderSheet(p);
  $('#step-label').innerHTML = '&nbsp;';
  const last = !extra && S.qi === S.N - 1;
  const run = S.run;
  card.classList.toggle('capsule', !!p.capsule);
  if (p.capsule) {
    card.style.opacity = 0;
    await capsuleIntro(p.capsule);
    if (S.screen !== 'play' || run !== S.run) return;
    const st = store.load(); st.capsule = { ...(st.capsule || {}), lastDay: store.dayKey() }; store.save();
  } else if (E > 0.22 || extra) cutin(extra ? `EX ${S.extra.solved + 1}` : last ? 'Last one!' : `Q${S.qi + 1}`, E);
  await cardEnter(E);
  if (S.screen !== 'play' || run !== S.run) return;
  S.ready = true;
  // Answer time counts only while input is open (id033).
  S.qStart = now(); S.qMisses = 0; S.qMs = 0;
  activate(0);
}

async function cardEnter(E) {
  if (S.reduced) { card.style.transform = ''; card.style.opacity = 1; return; }
  if (E < 0.4) {
    await tween(300, (k) => { card.style.transform = `translateX(${(1 - k) * 60}px) rotate(${(1 - k) * 3}deg)`; card.style.opacity = k; }, easeOutCubic);
  } else {
    const drop = 260 + 120 * Math.min(1, E);
    await tween(drop, (k) => { card.style.transform = `translateY(${(1 - k) * -120}px) rotate(${(1 - k) * -8}deg) scale(${0.8 + 0.2 * k})`; card.style.opacity = Math.min(1, k * 3); }, easeInCubic);
    const r = card.getBoundingClientRect();
    fx.puff(r.left + 20, r.bottom, 5); fx.puff(r.right - 20, r.bottom, 5);
    S.shake = Math.max(S.shake, 4 * E);
    audio.land();
    await tween(220, (k) => { card.style.transform = `scale(${1 + Math.sin(k * Math.PI) * 0.035 * E}, ${1 - Math.sin(k * Math.PI) * 0.05 * E})`; });
  }
  card.style.transform = '';
  card.style.opacity = 1;
}

// ---------------------------------------------------------------- input
function pressVisual(btn) {
  if (!btn) return;
  btn.classList.add('press');
  setTimeout(() => btn.classList.remove('press'), 110);
}

function press(key, btn = padButtons[key]) {
  if (S.screen !== 'play' || S.confirm) return;
  pressVisual(btn);
  if (key === 'Backspace') { erase(); return; }
  if (!S.ready) return;
  const p = S.problem;
  const st = p.steps[S.step];
  if (!st) return;
  const cell = S.cells[st.cell];
  audio.keyTap(S.combo);
  const from = btn ? centerOf(btn) : centerOf(cell);
  if (key === st.digit) {
    S.step += 1;
    addCombo();
    S.digitsDone += 1;
    const last = S.step >= p.steps.length;
    if (last) { S.ready = false; S.qMs = now() - S.qStart; }
    S.shownWrong = null;
    cell.classList.remove('bad', 'active', 'has');
    cell.classList.add('ok', 'pending');
    cell.textContent = key;
    bumpDopa(cell);
    carry(from, cell, key, () => { cell.classList.remove('pending'); onCorrect(st, cell, last); });
    if (!last) activate(S.step);
  } else {
    breakCombo();
    S.wrongInQ = true;
    S.stepMisses = (S.stepMisses || 0) + 1;
    S.qMisses = (S.qMisses || 0) + 1;
    if (S.mode === 'extra') S.extra.misses += 1; else S.misses += 1;
    updateTally();
    cell.classList.add('bad', 'has', 'pending');
    cell.textContent = key;
    S.shownWrong = key;
    carry(from, cell, key, () => { cell.classList.remove('pending'); onWrong(cell, st); });
  }
}

function carry(from, cell, digit, done) {
  if (S.reduced) { done(); return; }
  const to = centerOf(cell);
  hero.carry(from, to, digit, { E: S.E, onGrab: () => audio.grab(), onPlace: () => { audio.place(); done(); } });
}

function erase() {
  if (!S.shownWrong || !S.problem) return;
  const st = S.problem.steps[S.step];
  const cell = S.cells[st.cell];
  cell.textContent = '';
  cell.classList.remove('bad', 'has', 'pending');
  S.shownWrong = null;
  audio.erase();
  const c = centerOf(cell);
  fx.puff(c.x, c.y, 6);
  if (!S.reduced) hero.swipe(c);
}

// ---------------------------------------------------------------- director
function popEl(el, amount = 0.6, dur = 320) {
  if (S.reduced) return;
  tween(dur, (k) => { el.style.transform = `scale(${1 + amount * (1 - k) ** 2})`; }, easeOutCubic).then(() => { el.style.transform = ''; });
}

function reveal(ids, fromCell) {
  ids.forEach((id, i) => {
    const el = S.cells[id] || S.lines[id];
    if (!el) return;
    setTimeout(() => {
      el.classList.remove('hidden');
      if (S.reduced) return;
      if (el.classList.contains('hline')) { tween(220, (k) => { el.style.transform = `scaleX(${k})`; }, easeOutCubic); return; }
      const cellDef = S.problem.cells.find((c) => c.id === id);
      const src = cellDef && cellDef.drop ? S.cells[cellDef.drop] : (cellDef && cellDef.kind === 'carry' ? fromCell : null);
      if (src) {
        const a = src.getBoundingClientRect(); const b = el.getBoundingClientRect();
        const dx = a.left - b.left; const dy = a.top - b.top;
        tween(380, (k) => { el.style.transform = `translate(${dx * (1 - k)}px, ${dy * (1 - k) - Math.sin(k * Math.PI) * 26}px) scale(${1 + Math.sin(k * Math.PI) * 0.5})`; }, easeInOutCubic)
          .then(() => { el.style.transform = ''; const c = centerOf(el); fx.burst(c.x, c.y, { count: 6, kinds: ['star'], speed: 160 }); });
        audio.play('whistle', audio.now(), { from: 900, to: 1500, dur: 0.18, v: 0.05 });
      } else {
        tween(260, (k) => { el.style.transform = `scale(${0.3 + 0.7 * k})`; el.style.opacity = k; }, easeOutBack).then(() => { el.style.transform = ''; });
      }
    }, i * 70);
  });
}

function burstKinds(E) {
  const k = ['confetti'];
  if (E > 0.18) k.push('star');
  if (E > 0.4) k.push('spark', 'spark');
  if (E > 0.58) k.push('coin');
  if (E > 0.72) k.push('mini', 'heart');
  return k;
}

function onCorrect(st, cell, last) {
  const E = S.E;
  const c = centerOf(cell);
  popEl(cell, 0.7 + E * 0.5);
  cell.classList.add('ok');
  reveal(st.after || [], cell);
  if (!S.reduced) {
    fx.burst(c.x, c.y, { count: Math.round(6 + 22 * E), speed: 260 + 260 * E, kinds: burstKinds(E).filter((k) => k !== 'mini' && k !== 'coin'), up: 120, life: 0.55 });
    if (E > 0.35) fxBack.burst(c.x, c.y, { count: Math.round(30 * E), speed: 700, kinds: burstKinds(E), up: 200 });
    fx.ring(c.x, c.y, { color: E > 0.5 ? '#ffd23f' : '#ff7ab6', radius: 40 + 60 * E, width: 6 });
    if (E > 0.5) S.shake = Math.max(S.shake, 2 + 3 * E);
  }
  if (!last) {
    audio.correct(S.combo, E);
    if (!S.reduced && performance.now() > S.busyUntil) {
      hero.earL.kick(500); hero.earR.kick(500);
      hero.setFace('happy', E > 0.4 ? 'grin' : 'cat');
      setTimeout(() => hero.resetFace(), 380);
      if (E > 0.3 && chance(0.6)) { S.busyUntil = performance.now() + 450; hero.hop(14 + 30 * E, 300, { audio }); }
    }
    crowd.forEach((m) => { if (chance(0.7)) m.hop(18 + rand(0, 20), 300); });
  }
  if (last) clearProblem();
}

function onWrong(cell, st) {
  const E = S.E;
  audio.wrong(E);
  const c = centerOf(cell);
  giveHelp(st);
  if (S.reduced) return;
  tween(360, (k) => { cell.style.transform = `translateX(${Math.sin(k * 28) * 7 * (1 - k)}px)`; }).then(() => { cell.style.transform = ''; });
  const h = hero.headCenter;
  const t = 0.3;
  fx.add({ kind: 'text', x: c.x, y: c.y, vx: (h.x - c.x) / t, vy: (h.y - c.y) / t - 200, g: 1300, drag: 0, str: cell.textContent, color: '#ff4f6d', size: 34, life: t });
  setTimeout(() => {
    fx.burst(h.x, h.y - 20, { count: 10, kinds: ['star'], speed: 220, up: 60 });
    fx.ring(h.x, h.y, { color: '#fff', radius: 60, width: 7 });
    S.busyUntil = performance.now() + 900;
    hero.hurt(E, c, { audio });
    if (E > 0.5) { S.shake = Math.max(S.shake, 8); S.flash = Math.max(S.flash, 0.12); }
    crowd.forEach((m) => { m.setFace('wide', 'o'); m.sq.kick(-3); setTimeout(() => m.resetFace(), 600); });
  }, t * 1000);
}

// Repeated slips on the same digit: 2nd highlights the digits to look at
// and Dopakichi points there; 3rd also spells out the sub-calculation.
function giveHelp(st) {
  if (!st || !st.help || S.problem.steps[S.step] !== st) return;
  const n = S.stepMisses;
  if (n < 2) return;
  const els = st.help.ids.map((id) => S.cells[id]).filter((el) => el && !el.classList.contains('hidden'));
  els.forEach((el) => el.classList.add('hint-glow'));
  if (els[0] && !S.reduced) setTimeout(() => hero.point(centerOf(els[0])), 900);
  if (n >= 3) {
    $('#step-label').innerHTML = `<b>${st.label}</b><span class="help-text">${`<b>Hint</b> ${st.help.text}`}</span>`;
    audio.play('blip', audio.now(), { m: 81, v: 0.08 });
  }
}

// Mastery bookkeeping, review list, and unlock announcements.
function noteProblem(p, firstTry) {
  if (S.demo) return;
  const prog = progress();
  if (!firstTry && S.plan.mode !== 'review') {
    S.wrongList.push(p);
    const sig = signature(p);
    if (!prog.review.some((it) => it.sig === sig)) prog.review.push({ sig, skill: p.skill || null, problem: stripProblem(p), at: Date.now() });
    if (prog.review.length > REVIEW_MAX) prog.review.splice(0, prog.review.length - REVIEW_MAX);
  }
  if (S.plan.mode === 'review') {
    const sig = signature(p);
    if (firstTry) prog.review = prog.review.filter((it) => it.sig !== sig);
    else S.wrongList.push(p);
  }
  if (S.plan.placement && S.mode !== 'extra') S.plan.answer(firstTry);
  const timing = { at: Date.now(), day: store.dayKey(), ms: S.qMs, cells: p.steps.length, misses: S.qMisses || 0, problem: stripProblem(p) };
  questNote({ type: 'solve', firstTry, review: S.plan.mode === 'review', extra: S.mode === 'extra', skill: p.skill, skillState: p.skill && SKILL[p.skill] ? stateOf(prog, p.skill) : null });
  if (recording()) {
    const extra = S.mode === 'extra';
    growth.noteSolve(stats(), { cells: timing.cells, firstTry, misses: timing.misses, review: S.plan.mode === 'review', extra, extraSolved: S.extra.solved + (extra ? 1 : 0), combo: S.comboPeak || 0 });
  }
  if (recording() && p.skill && S.mode !== 'extra') {
    const e = S.sessionTimes[p.skill] || (S.sessionTimes[p.skill] = { n: 0, ms: 0, c: 0, f: 0 });
    e.n += 1; e.ms += timing.ms; e.c += timing.cells; e.f += firstTry ? 1 : 0;
  }
  if (p.skill && !params.has('skill')) {
    const res = recordResult(prog, p.skill, firstTry, signature(p), recording() ? timing : {});
    if (res.mastered) S.newMastered.push(p.skill);
    if (res.stars >= 2) S.newStars[p.skill] = res.stars;
    if (res.polished && recording()) { S.polished.push(p.skill); const st = stats(); st.polished = (st.polished || 0) + 1; polishFx(); }
    for (const id of res.unlocked) { S.newUnlocks.push(id); announceUnlock(id); }
  }
  store.save();
}
const stripProblem = (p) => JSON.parse(JSON.stringify(p));

function announceUnlock(id) {
  const name = SKILL[id].name;
  setTimeout(() => {
    audio.unit(Math.min(1, S.E + 0.3));
    if (S.reduced) return;
    cutin(`Unlocked! ${name}`, Math.max(0.6, S.E));
    const r = stage.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height * 0.4, { count: 40, kinds: ['star', 'confetti', 'coin'], speed: 700, up: 200 });
  }, 700);
}

function startReach() {
  S.reach = true;
  body.classList.add('reach');
  const tag = $('#reach-tag');
  tween(S.reduced ? 1 : 420, (k) => { if (S.reach) tag.style.transform = `translateX(-50%) scale(${k})`; }, easeOutBack);
  audio.setReach(true);
  if (!S.reduced) hero.reachPose(true);
  crowd.forEach((m) => { m.setFace('wide', 'puff'); m.cheekPuff = 1; m.shake = 1; });
}
function endReach() {
  S.reach = false;
  body.classList.remove('reach');
  $('#reach-tag').style.transform = 'translateX(-50%) scale(0)';
  audio.setReach(false);
  hero.reachPose(false);
  crowd.forEach((m) => { m.cheekPuff = 0; m.shake = 0; m.resetFace(); });
}

async function clearProblem() {
  const E = S.E;
  const wasReach = S.reach;
  if (wasReach) endReach();
  const extra = S.mode === 'extra';
  noteProblem(S.problem, !S.wrongInQ);
  let gained = 0;
  if (extra) { gained = extraPoints(S.extra.solved); S.extra.solved += 1; S.extra.score += gained; } else { S.solved += 1; if (!S.wrongInQ) S.firstTry += 1; }
  updateTally();
  if (!extra) {
    const pip = $$('.pip')[S.qi];
    pip.classList.remove('now');
    pip.classList.add('done');
    const cols = ['#3b6bff', '#3fdcb0', '#ff5a4f', '#ffd23f'];
    if (E > 0.85) pip.classList.add('rainbow'); else pip.style.setProperty('--c', cols[Math.min(3, Math.floor(E * 4.5))]);
    popEl(pip, 1.2);
  }
  $('#step-label').innerHTML = `<b>${S.problem.answerText}</b>`;
  if (gained) pointsPop(gained);
  if (wasReach) audio.reachHit(E); else audio.clear(E);
  hanamaru(E);
  const lastBasic = !extra && S.qi === S.N - 1;
  celebrate(E, wasReach, lastBasic);
  const capsuleShown = S.problem.capsule ? capsuleDone(S.problem.capsule) : false;
  if (lastBasic) { if (capsuleShown) await wait(1600); await finale(); return; }
  const run = S.run;
  await wait((extra ? 520 : lerp(600, 1150, clamp(E))) + (wasReach ? 250 : 0) + (capsuleShown ? 1900 : 0));
  if (S.screen !== 'play' || run !== S.run || (extra && S.extra.over)) return;
  if (!extra) S.qi += 1;
  setupProblem();
}

function celebrate(E, big, lastBasic) {
  const r = card.getBoundingClientRect();
  const cx = r.left + r.width / 2; const cy = r.top + r.height * 0.4;
  const W = innerWidth; const H = innerHeight;
  S.busyUntil = performance.now() + 900;
  if (S.reduced) { hero.setFace('happy', 'grin'); setTimeout(() => hero.resetFace(), 700); return; }
  hero.celebrate(Math.min(1, E), { big: E > 0.5 || big, audio });
  crowd.forEach((m, i) => setTimeout(() => m.celebrate(Math.min(1, E), { big: E > 0.8 }), 60 * i));
  const n = Math.round(18 + 80 * Math.min(1.2, E) + (big ? 50 : 0));
  fx.burst(cx, cy, { count: n, speed: 500 + 500 * E, kinds: burstKinds(E), up: 250, life: 0.6 });
  fx.ring(cx, cy, { color: '#ffd23f', radius: 120 + 200 * E, width: 10 });
  if (E > 0.25) fxBack.burst(cx, cy, { count: Math.round(100 * Math.min(1.2, E)), speed: 900 + 400 * E, kinds: burstKinds(E), up: 400 });
  if (E > 0.3) fx.streamers(W, H, Math.round(2 + 6 * E));
  if (E > 0.5) { fxBack.fireworks(W, H, Math.round(2 + 6 * E) + (big ? 4 : 0), 0.06, 0.3); S.flash = Math.max(S.flash, 0.25 * E); }
  if (E > 0.62) fxBack.rain(W, Math.round(20 + 30 * E), { kinds: ['confetti', 'confetti', 'mini', 'coin'] });
  if (E > 0.74 || big) parade(E, big);
  if (big) { S.flash = 1; fx.burst(cx, cy, { count: 50, speed: 900, kinds: ['spark', 'star', 'coin'], up: 100, life: 0.6 }); fxBack.burst(cx, cy, { count: 120, speed: 1300, kinds: ['spark', 'star', 'mini', 'coin'], up: 300 }); }
  S.shake = Math.max(S.shake, 3 + 9 * E + (big ? 6 : 0));
  tween(260, (k) => { card.style.transform = `scale(${1 + Math.sin(k * Math.PI) * 0.04 * E})`; }).then(() => { card.style.transform = ''; });
}

// Hand-drawn "hanamaru" (flower circle) mark, the classic Japanese school "correct".
function hanamaru(E, el = $('#stamp'), style = ul.variant(S.look && S.look.mark)) {
  if (style !== 'hanamaru' && MARKS[style]) { drawMark(el, style, E, { preview: el.id !== 'stamp' }); return; }
  const flower = E >= 0.45;
  const size = flower ? 150 : 110;
  const N = 11; const R = 58;
  let spiral = ''; const turns = flower ? 2.3 : 1.12;
  for (let i = 0; i <= 90; i++) { const t = i / 90; const a = -1.9 + t * turns * Math.PI * 2; const r = flower ? 9 + t * 29 : 44 + t * 7 + Math.sin(t * 9) * 1.2; spiral += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`; }
  let petals = '';
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2; const a1 = ((i + 1) / N) * Math.PI * 2;
    const p0 = [Math.cos(a0) * R * 0.78, Math.sin(a0) * R * 0.78]; const p1 = [Math.cos(a1) * R * 0.78, Math.sin(a1) * R * 0.78];
    const m = [(Math.cos((a0 + a1) / 2)) * R * 1.12, (Math.sin((a0 + a1) / 2)) * R * 1.12];
    petals += `${i ? '' : `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}`}Q${m[0].toFixed(1)} ${m[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  }
  const stroke = E > 0.85 ? 'url(#rb)' : '#ff4f6d';
  el.style.cssText = `width:${size}px;height:${size}px;border:none;box-shadow:none;opacity:1;right:${flower ? 6 : 14}px;top:${flower ? 18 : 34}px`;
  el.innerHTML = `<svg viewBox="-70 -70 140 140" width="100%" height="100%"><defs><linearGradient id="rb" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff4f6d"/><stop offset=".35" stop-color="#ffb000"/><stop offset=".65" stop-color="#3fdcb0"/><stop offset="1" stop-color="#3b6bff"/></linearGradient></defs>
    <path class="sp" d="${spiral}" fill="none" stroke="${stroke}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${flower ? `<path class="pt" d="${petals}" fill="none" stroke="${stroke}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</svg>`;
  const paths = [...el.querySelectorAll('path')];
  paths.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = S.reduced ? 0 : L; p.dataset.len = L; });
  if (S.reduced) { setTimeout(() => { el.style.opacity = 0; }, 900); return; }
  const drawDur = 260 + (flower ? 120 : 0);
  // A newer mark must not be faded out by this one's tail.
  const token = String(Number(el.dataset.token || 0) + 1); el.dataset.token = token;
  const mine = () => el.dataset.token === token;
  tween(drawDur, (k) => {
    if (!mine()) return;
    const a = Math.min(1, k * (flower ? 1.6 : 1));
    paths[0].style.strokeDashoffset = paths[0].dataset.len * (1 - a);
    if (paths[1]) paths[1].style.strokeDashoffset = paths[1].dataset.len * (1 - clamp((k - 0.4) / 0.6));
    el.style.transform = `rotate(${-20 + 20 * k}deg) scale(${1.3 - 0.3 * k})`;
  }, easeOutCubic).then(async () => {
    if (!mine()) return;
    if (E > 0.85) tween(900, (k) => { if (mine()) el.style.transform = `rotate(${k * 360}deg)`; }, easeOutQuint);
    await wait(760);
    await tween(200, (k) => { if (mine()) el.style.opacity = 1 - k; });
  });
}

// ---------------------------------------------------------------- unlockable show (id041-id044)
// Correct marks other than the hanamaru. Stroked parts ("sp") are drawn in,
// filled parts ("fl") pop in after; all grow with E and turn rainbow near the top.
const MARKS = {
  stamp: (c) => `<circle class="sp" r="56" fill="none" stroke="${c}" stroke-width="8"/><circle class="sp" r="45" fill="none" stroke="${c}" stroke-width="2.8"/><text class="fl" y="9" text-anchor="middle" font-family="Dela Gothic One, sans-serif" ${'font-size="17" textLength="80" lengthAdjust="spacingAndGlyphs"'} fill="${c}" transform="rotate(-12)">${'CORRECT'}</text><path class="fl" d="M-30 -30 l3 6 6 1 -4.5 4 1 6.5 -5.5 -3 -5.5 3 1 -6.5 -4.5 -4 6 -1z M30 26 l3 6 6 1 -4.5 4 1 6.5 -5.5 -3 -5.5 3 1 -6.5 -4.5 -4 6 -1z" fill="${c}"/>`,
  crown: (c) => `<path class="sp" d="M-50 30 L-58 -28 L-26 -2 L0 -46 L26 -2 L58 -28 L50 30 Z" fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round"/><path class="fl" d="M-50 30 L-58 -28 L-26 -2 L0 -46 L26 -2 L58 -28 L50 30 Z" fill="#ffd23f" opacity=".85"/><path class="sp" d="M-48 44 L48 44" stroke="${c}" stroke-width="7" stroke-linecap="round"/><circle class="fl" cx="0" cy="-46" r="7" fill="#ff4f6d"/><circle class="fl" cx="-58" cy="-28" r="6" fill="#3b6bff"/><circle class="fl" cx="58" cy="-28" r="6" fill="#3fdcb0"/><circle class="fl" cx="0" cy="12" r="9" fill="#ff7ab6"/>`,
  ring: (c) => `${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path class="sp" d="M${(Math.cos(a) * 20).toFixed(1)} ${(Math.sin(a) * 20).toFixed(1)} L${(Math.cos(a) * 52).toFixed(1)} ${(Math.sin(a) * 52).toFixed(1)}" stroke="${['#ff4f6d', '#ffb000', '#3fdcb0', '#3b6bff'][i % 4]}" stroke-width="7" stroke-linecap="round"/>`; }).join('')}${Array.from({ length: 12 }, (_, i) => { const a = ((i + 0.5) / 12) * Math.PI * 2; return `<circle class="fl" cx="${(Math.cos(a) * 60).toFixed(1)}" cy="${(Math.sin(a) * 60).toFixed(1)}" r="5" fill="${c}"/>`; }).join('')}<circle class="fl" r="12" fill="#ffd23f"/>`,
  medal: (c) => `<path class="fl" d="M-30 -66 L-8 -18 L8 -18 L-14 -66Z" fill="#3b6bff"/><path class="fl" d="M30 -66 L8 -18 L-8 -18 L14 -66Z" fill="#ff4f6d"/><circle class="sp" cy="18" r="40" fill="none" stroke="${c}" stroke-width="8"/><circle class="fl" cy="18" r="34" fill="#ffd23f"/><path class="sp" d="M0 -6 L7 9 L23 10 L11 21 L15 37 L0 28 L-15 37 L-11 21 L-23 10 L-7 9Z" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`,
};
function drawMark(el, style, E, { preview = false } = {}) {
  const size = preview ? 120 : 110 + 50 * Math.min(1, E);
  const col = E > 0.85 ? 'url(#mk-rb)' : '#ff4f6d';
  el.style.cssText = `width:${size}px;height:${size}px;border:none;box-shadow:none;opacity:1;${preview ? '' : `right:${E >= 0.45 ? 6 : 14}px;top:${E >= 0.45 ? 18 : 34}px`}`;
  el.innerHTML = `<svg viewBox="-72 -72 144 144" width="100%" height="100%" overflow="visible"><defs><linearGradient id="mk-rb" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff4f6d"/><stop offset=".35" stop-color="#ffb000"/><stop offset=".65" stop-color="#3fdcb0"/><stop offset="1" stop-color="#3b6bff"/></linearGradient></defs>${MARKS[style](col)}</svg>`;
  const sp = [...el.querySelectorAll('.sp')]; const fl = [...el.querySelectorAll('.fl')];
  sp.forEach((q) => { const L = q.getTotalLength ? q.getTotalLength() : 300; q.style.strokeDasharray = L; q.style.strokeDashoffset = S.reduced ? 0 : L; q.dataset.len = L; });
  fl.forEach((q) => { q.style.opacity = S.reduced ? 1 : 0; });
  if (S.reduced) { if (!preview) setTimeout(() => { el.style.opacity = 0; }, 900); return; }
  const spin = E > 0.85;
  const token = String(Number(el.dataset.token || 0) + 1); el.dataset.token = token;
  const mine = () => el.dataset.token === token;
  tween(300 + (E >= 0.45 ? 100 : 0), (k) => {
    if (!mine()) return;
    sp.forEach((q) => { q.style.strokeDashoffset = q.dataset.len * (1 - Math.min(1, k * 1.4)); });
    fl.forEach((q) => { q.style.opacity = clamp((k - 0.45) / 0.4); });
    el.style.transform = `rotate(${-20 + 20 * k}deg) scale(${(style === 'ring' ? 0.5 + 0.5 * k : 1.3 - 0.3 * k)})`;
  }, easeOutCubic).then(async () => {
    if (!mine()) return;
    if (spin) tween(900, (k) => { if (mine()) el.style.transform = `rotate(${k * 360}deg)`; }, easeOutQuint);
    if (style === 'medal' && !spin) tween(700, (k) => { if (mine()) el.style.transform = `rotate(${Math.sin(k * Math.PI * 3) * 10 * (1 - k)}deg)`; });
    await wait(preview ? 1400 : 760);
    await tween(200, (k) => { if (mine()) el.style.opacity = 1 - k; });
  });
}

// The look of one play: fixed choices stay, "Shuffle" changes every play.
const equipState = () => { const st = store.load(); if (!st.equip) st.equip = ul.defaultEquip(); return st.equip; };
const gotTrophies = () => trophyState().got || {};
S.look = null;
function applyLook(look) {
  S.look = look;
  const v = (c) => ul.variant(look[c]);
  bg.setTheme(v('bg'));
  const pt = v('particle');
  fx.theme = fxBack.theme = pt === 'classic' ? null : pt;
  audio.setSong(v('music'));
  hero.setPalette(v('color'));
  hero.setCostume(v('costume') === 'none' ? null : v('costume'));
  // The crowd is rebuilt with the new style the next time it is needed.
  while (crowd.length) { const m = crowd.pop(); m.destroy(); actors.splice(actors.indexOf(m), 1); }
}
// On the title only fixed choices show; "Shuffle" shows the original look.
function titleLook() {
  const eq = equipState(); const got = gotTrophies();
  return Object.fromEntries(ul.CATS.map(({ key }) => { const id = eq[key]; return [key, id && id !== 'auto' && ul.isUnlocked(ul.ITEM[id], got) ? id : ul.ITEMS.find((it) => it.cat === key && it.base).id]; }));
}
const playLook = () => ul.pickLook(equipState(), gotTrophies(), S.rng);

// Crowd styles: palette and costume for member i.
const CROWD_PALS = ['blue', 'yellow', 'mint', 'violet', 'pink'];
function crowdLook(i) {
  const style = ul.variant(S.look && S.look.crowd);
  if (style === 'costume') { const keys = Object.keys(COSTUMES); return { pal: CROWD_PALS[i % 5], costume: keys[(i * 3 + 1) % keys.length] }; }
  if (style === 'rainbow') return { pal: ['rainbow', 'gold', 'snow', 'rainbow', 'blue'][i % 5], costume: null };
  if (style === 'twins') return { pal: ul.variant(S.look.color), costume: hero.costume };
  return { pal: CROWD_PALS[i % 5], costume: null };
}

function cutin(text, E) {
  if (S.reduced) return;
  audio.cutin();
  const r = stage.getBoundingClientRect();
  const band = document.createElement('div');
  band.className = 'cutin-band';
  const h = 58 + 26 * Math.min(1, E);
  const palettes = [['#3b6bff', '#5b8cff'], ['#ff7ab6', '#ff9ccc'], ['#ffb000', '#ffd23f'], ['#1b1d4d', '#3b3f8f']];
  const pal = palettes[Math.min(3, Math.floor(E * 3.6))];
  band.style.cssText = `top:${r.top + r.height / 2 - h / 2}px;height:${h}px;--c1:${pal[0]};--c2:${pal[1]}`;
  band.innerHTML = `<div class="band-bg"></div><div class="band-text" style="font-size:${34 + 16 * Math.min(1, E)}px">${text}</div>`;
  $('#cutins').appendChild(band);
  fitWidth(band.querySelector('.band-text'), innerWidth - 32);
  const rot = -6;
  (async () => {
    await tween(240, (k) => { band.style.transform = `translateX(${(1 - k) * 110}%) rotate(${rot}deg) scaleY(${0.6 + 0.4 * k})`; }, easeOutBack);
    await wait(360 + 160 * E);
    await tween(200, (k) => { band.style.transform = `translateX(${-k * 110}%) rotate(${rot}deg)`; }, easeInCubic);
    band.remove();
  })();
}

function bumpDopa(cell) {
  const prev = S.dopa.L;
  const n = S.problem.steps.length;
  // No-combo step for this answer cell; the combo scales it up a little.
  const base = S.mode === 'extra' ? extraProblemGain(S.extra.solved) / n
    : basicDopaL((S.qi + S.step / n) / S.N) - basicDopaL((S.qi + (S.step - 1) / n) / S.N);
  S.dopa.L = addDopa(prev, base, S.combo);
  const E = S.E;
  if (E > 0.12 && !S.reduced) {
    const gain = S.dopa.L + Math.log10(1 - 10 ** (prev - S.dopa.L));
    const c = centerOf(cell);
    fx.text(c.x, c.y - 30, `+${10 ** gain < 1 ? 1 : fmtDopa(gain)}`, { color: pick(['#ffd23f', '#fff', '#8fd3ff', '#ffb3d6']), size: 16 + 10 * Math.min(1, E), vy: -120 });
  }
  popEl($('#dopa-box'), 0.12 + 0.2 * E, 260);
}

// ---------------------------------------------------------------- combo
// One combo per correct answer cell, carried to the next problem. Each cell
// must be answered within a time that depends on the skill's grade; the
// clock only runs while input is open (not during problem transitions).
function comboGrade() {
  const p = S.problem;
  return p && p.skill && SKILL[p.skill] ? SKILL[p.skill].grade : 3;
}
function armCombo(first) {
  S.comboLimit = comboWindowMs(comboGrade(), first);
  S.comboEnd = now() + S.comboLimit;
}
function addCombo() {
  S.combo += 1;
  S.comboPeak = Math.max(S.comboPeak || 0, S.combo);
  questNote({ type: 'combo', value: S.combo });
  showCombo();
  if (S.combo < 2) return;
  const box = $('#combo-box');
  popEl(box, 0.25 + 0.25 * Math.min(1, S.E), 240);
  if (!comboMilestone(S.combo)) return;
  audio.unit(Math.min(1, 0.3 + S.combo / 100));
  if (S.reduced) return;
  const c = centerOf(box);
  fx.text(c.x, c.y + 26, `${S.combo} combo!`, { color: '#ffd23f', size: 26 + Math.min(20, S.combo / 5), vy: -90, life: 1 });
  fx.burst(c.x, c.y, { count: 16 + Math.min(40, S.combo / 2), kinds: ['star', 'spark', 'confetti'], speed: 380, up: 80 });
  fx.ring(c.x, c.y, { color: '#ff7ab6', radius: 50 + Math.min(80, S.combo), width: 6 });
}
function breakCombo(timeout = false) {
  const had = S.combo;
  S.combo = 0;
  showCombo();
  if (had < 5) return;
  const box = $('#combo-box');
  audio.play('blip', audio.now(), { m: 60, v: 0.07 });
  if (S.reduced) return;
  const c = centerOf(box);
  fx.text(c.x, c.y + 20, timeout ? `${had} combo over` : `${had} combo`, { color: '#b9bbd9', size: 15, vy: 40, life: 0.8 });
}
function showCombo() {
  const box = $('#combo-box');
  const on = S.combo >= 2;
  box.classList.toggle('on', on);
  if (!on) return;
  $('#combo').textContent = S.combo;
  const max = comboMaxed(S.combo);
  $('#combo-mult').textContent = max ? 'Dopa ×2 MAX' : `Dopa ×${comboMult(S.combo).toFixed(2)}`;
  box.classList.toggle('hot', max);
}
function tickCombo(t) {
  if (S.screen !== 'play' || S.combo < 2 || S.confirm) return;
  const left = S.comboEnd - t;
  // Only count down while the player can answer.
  if (!S.ready) { S.comboEnd = t + Math.max(left, 0); return; }
  if (left <= 0) { breakCombo(true); return; }
  const k = clamp(left / S.comboLimit);
  const bar = $('#combo-bar');
  bar.style.transform = `scaleX(${k.toFixed(3)})`;
  $('#combo-box').classList.toggle('hurry', k < 0.3);
}

// Floating "+N pts" above the card when an extra problem is cleared.
function pointsPop(points) {
  const r = card.getBoundingClientRect();
  const x = r.left + r.width / 2; const y = r.top + 26;
  if (S.reduced) return;
  fx.text(x, y, `+${points.toLocaleString('en-US')} pts`, { color: '#ffd23f', size: 30 + Math.min(26, Math.log2(points / 10) * 4), vy: -160, life: 1.1 });
}

function unitSlam(unit, L) {
  const E = S.E;
  audio.unit(E);
  if (S.reduced) return;
  const box = $('#dopa-box').getBoundingClientRect();
  const r = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'unit-slam';
  const big = E > 0.45 && unit !== 'hundred';
  const size = big ? 64 + 40 * Math.min(1, E) : 30;
  el.style.fontSize = `${size}px`;
  el.textContent = unitLabel(unit);
  $('#cutins').appendChild(el);
  fitWidth(el);
  const w = el.offsetWidth; const h = el.offsetHeight;
  const x0 = big ? r.left + r.width / 2 - w / 2 : box.left + box.width / 2 - w / 2;
  const y0 = big ? r.top + r.height * 0.35 - h / 2 : box.bottom + 4;
  el.style.left = `${x0}px`; el.style.top = `${y0}px`;
  if (big) {
    const c = { x: x0 + w / 2, y: y0 + h / 2 };
    fx.burst(c.x, c.y, { count: 30 + 40 * E, kinds: ['coin', 'star', 'spark'], speed: 600 });
    fx.ring(c.x, c.y, { color: '#ffd23f', radius: 180, width: 12 });
    S.shake = Math.max(S.shake, 6);
  }
  (async () => {
    await tween(big ? 280 : 200, (k) => { el.style.transform = `scale(${lerp(big ? 3.2 : 1.8, 1, k)}) rotate(${lerp(-18, -4, k)}deg)`; el.style.opacity = Math.min(1, k * 2); }, easeOutBack);
    await wait(big ? 520 : 400);
    const tx = box.left + box.width / 2 - (x0 + w / 2); const ty = box.top + box.height / 2 - (y0 + h / 2);
    await tween(260, (k) => { el.style.transform = `translate(${tx * k}px, ${ty * k}px) scale(${1 - 0.8 * k}) rotate(-4deg)`; el.style.opacity = 1 - k * 0.6; }, easeInCubic);
    el.remove();
    popEl($('#dopa-box'), 0.35, 300);
  })();
}

async function parade(E, big) {
  if (actors.length > 10 || S.motion < 0.5) return;
  const r = stage.getBoundingClientRect();
  const n = Math.round(3 + 4 * Math.min(1, E) + (big ? 2 : 0));
  const dir = chance(0.5) ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const cl = crowdLook(i);
    const m = new Dopakichi(backLayer, { scale: 0.32 + rand(0, 0.12), palette: cl.pal, front: frontLayer });
    if (cl.costume) m.setCostume(cl.costume);
    const y = r.top + rand(r.height * 0.25, r.height * 0.55);
    const x0 = dir > 0 ? -60 - i * 70 : innerWidth + 60 + i * 70;
    m.place(x0, y);
    m.setFace(pick(['happy', 'star', 'wink']), pick(['grin', 'big', 'cat']), true);
    m.hands.forEach((h) => { h.raise = 1; });
    actors.push(m);
    (async () => {
      const x1 = dir > 0 ? innerWidth + 80 : -80;
      const hops = 5 + Math.floor(rand(0, 3));
      for (let k = 1; k <= hops; k++) {
        const tx = lerp(x0, x1, k / hops);
        await m.hop(30 + rand(0, 40), 300 + rand(0, 80), { to: { x: tx, y }, spin: chance(0.25) ? 360 * dir : 0 });
      }
      m.destroy();
      actors.splice(actors.indexOf(m), 1);
    })();
  }
}

function ensureCrowd(E) {
  const want = [];
  if (E >= 0.45) want.push({ i: 0, side: -1, s: 0.46 });
  if (E >= 0.68) want.push({ i: 1, side: 1, s: 0.46 });
  if (E >= 0.88) want.push({ i: 2, side: -1.9, s: 0.36 }, { i: 3, side: 1.9, s: 0.36 });
  if (S.reduced || S.motion < 0.5) want.length = 0;
  while (crowd.length > want.length) { const m = crowd.pop(); m.destroy(); actors.splice(actors.indexOf(m), 1); }
  for (let i = crowd.length; i < want.length; i++) {
    const w = want[i];
    const cl = crowdLook(w.i);
    const m = new Dopakichi(backLayer, { scale: w.s, palette: cl.pal, front: frontLayer });
    if (cl.costume) m.setCostume(cl.costume);
    m.side = w.side; m.bob = 1;
    crowd.push(m); actors.push(m);
    placeCrowd(m, i);
    const home = { ...m.home };
    m.place(w.side < 0 ? -80 : innerWidth + 80, home.y);
    m.hop(80, 520, { to: home }).then(() => { m.place(home.x, home.y); });
  }
}
function placeCrowd(m, i) {
  if (S.screen !== 'play') { m.visible = false; return; }
  m.visible = true;
  const r = stage.getBoundingClientRect();
  const off = Math.abs(m.side) > 1.5 ? 0.06 : 0.2;
  const x = m.side < 0 ? r.left + r.width * off : r.right - r.width * off;
  m.place(x, r.bottom - 12 - (Math.abs(m.side) > 1.5 ? 18 : 0));
  void i;
}

async function finale() {
  const run = S.run;
  S.ready = false;
  S.endT = now();
  const W = innerWidth; const H = innerHeight;
  audio.finale();
  await wait(120);
  const style = ul.variant(S.look && S.look.finale);
  if (!S.reduced) await (FINALES[style] || FINALES.classic)(W, H);
  else await wait(800);
  // The player (or a demo interruption) may have left the game meanwhile.
  if (run === S.run) showResult();
}

// Finale variants (id041, id044): each ends with the "100 pts" stamp.
const heroLike = (scale) => { const m = new Dopakichi(backLayer, { scale, palette: ul.variant(S.look && S.look.color) || 'pink', front: frontLayer }); m.setCostume(hero.costume); actors.push(m); return m; };
const dropActor = (m) => { m.destroy(); actors.splice(actors.indexOf(m), 1); };
const ROCKET_SVG = '<svg viewBox="-60 -40 120 80"><g stroke="#1b1d4d" stroke-width="4" stroke-linejoin="round"><path d="M-40 -14 L-58 -30 L-50 0 L-58 30 L-40 14Z" fill="#ff4f6d"/><path d="M-44 -16 Q10 -30 50 0 Q10 30 -44 16Z" fill="#fff"/><path d="M30 -10 Q46 -4 50 0 Q46 4 30 10Z" fill="#ff7ab6"/><circle cx="10" cy="0" r="9" fill="#8fd3ff"/><path d="M-20 16 L-34 34 L-6 18Z" fill="#3b6bff"/></g></svg>';
const FINALES = {
  // The original: a giant Dopakichi rises from the bottom.
  async classic(W, H) {
    S.flash = 1;
    fxBack.fireworks(W, H, 10, 0.06, 0.45);
    fx.streamers(W, H, 12);
    fxBack.rain(W, 70, { kinds: ['confetti', 'confetti', 'mini', 'star', 'coin'] });
    fx.burst(W / 2, H * 0.4, { count: 70, speed: 1200, kinds: ['confetti', 'star', 'spark', 'coin', 'mini'], up: 300, life: 0.7 });
    const giant = heroLike(Math.min(2.2, W / 200));
    giant.place(W / 2, H + 380 * giant.S / 3);
    giant.setFace('happy', 'grin', true);
    giant.hands.forEach((h) => { h.raise = 1; });
    const y0 = giant.y; const y1 = H + 10;
    await tween(700, (k) => { giant.y = lerp(y0, y1, k); giant.ground = giant.y; }, easeOutBack);
    bigStamp('100 pts');
    S.shake = 16;
    for (let i = 0; i < 3; i++) { giant.earL.kick(700); giant.earR.kick(700); await tween(260, (k) => { giant.lift = Math.sin(k * Math.PI) * 60; giant.rot = Math.sin(k * Math.PI * 2) * 6; }); giant.lift = 0; giant.rot = 0; giant.sq.value = 0.85; }
    parade(1, true);
    await wait(900);
    fxBack.fireworks(W, H, 6, 0.06, 0.35);
    fx.fireworks(W, H, 3, 0.06, 0.3);
    await tween(500, (k) => { giant.y = lerp(y1, y0, k); giant.ground = giant.y; }, easeInCubic);
    giant.destroy(); actors.splice(actors.indexOf(giant), 1);
  },
  // A burst of fireworks all over the sky, then a ring of mini Dopakichi.
  async fireworks(W, H) {
    S.flash = 0.8;
    for (let i = 0; i < 5; i++) { fxBack.fireworks(W, H, 5 + i, 0.05, 0.5); if (i % 2 === 0) fx.fireworks(W, H, 2, 0.08, 0.35); audio.play('crash', audio.now(), { v: 0.18 }); S.shake = Math.max(S.shake, 6); await wait(260); }
    bigStamp('100 pts');
    S.shake = 16; S.flash = 1;
    const cx = W / 2; const cy = H * 0.3;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; fx.burst(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120, { count: 6, kinds: ['mini', 'star'], speed: 260, up: 60 }); }
    parade(1, true);
    await wait(1100);
    fxBack.fireworks(W, H, 8, 0.05, 0.4);
    await wait(700);
  },
  // Dopakichi rides a paper rocket across the screen, leaving a trail of stars.
  async rocket(W, H) {
    S.flash = 0.7;
    const rk = document.createElement('div');
    rk.className = 'finale-rocket'; rk.innerHTML = ROCKET_SVG;
    $('#cutins').appendChild(rk);
    const rider = heroLike(Math.min(1.1, W / 360));
    const x0 = -160; const y0 = H * 0.85; const x1 = W + 160; const y1 = H * 0.12;
    audio.play('riser', audio.now(), { dur: 1.3, v: 0.3 });
    await tween(1400, (k) => {
      const x = lerp(x0, x1, k); const y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * H * 0.15;
      const ang = Math.atan2((y1 - y0) - Math.cos(k * Math.PI) * H * 0.15 * Math.PI, x1 - x0) * 180 / Math.PI;
      rk.style.transform = `translate(${x - 90}px, ${y - 60}px) rotate(${ang}deg)`;
      rider.x = x - 6; rider.y = y - 30 * rider.S; rider.ground = null; rider.rot = ang * 0.3;
      if (Math.random() < 0.6) fx.burst(x - 70, y + 10, { count: 4, kinds: ['star', 'spark', 'confetti'], speed: 180, up: -40 });
    }, easeInOutCubic);
    rk.remove(); dropActor(rider);
    bigStamp('100 pts');
    S.shake = 16;
    fxBack.fireworks(W, H, 8, 0.06, 0.4);
    parade(1, true);
    await wait(1300);
  },
  // A marching parade with a big "100 pts!" banner.
  async parade(W, H) {
    const band = [];
    const y = H * 0.62;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const cl = i === 4 ? { pal: ul.variant(S.look && S.look.color) || 'pink', costume: hero.costume } : crowdLook(i);
      const m = new Dopakichi(backLayer, { scale: i === 4 ? 0.8 : 0.45, palette: cl.pal, front: frontLayer });
      if (cl.costume) m.setCostume(cl.costume);
      m.place(-80 - i * 70, y); m.hands.forEach((h) => { h.raise = 1; }); m.setFace('happy', 'grin', true);
      actors.push(m); band.push(m);
    }
    const banner = document.createElement('div');
    banner.className = 'finale-banner'; banner.textContent = '100 pts!';
    $('#cutins').appendChild(banner);
    audio.gong();
    const span = W + 80 + n * 70 + 80;
    await tween(2300, (k) => {
      band.forEach((m, i) => { m.x = -80 - i * 70 + span * k; m.y = y; m.lift = Math.abs(Math.sin(k * 26 + i)) * 26; });
      const lead = band[4];
      banner.style.transform = `translate(${lead.x - 90}px, ${y - 220 * lead.S - 30}px)`;
      if (Math.random() < 0.3) fx.burst(lead.x, y - 100, { count: 5, kinds: ['confetti', 'star'], speed: 300, up: 150 });
    }, (k) => k);
    bigStamp('100 pts');
    S.shake = 14;
    band.forEach(dropActor); banner.remove();
    fxBack.fireworks(W, H, 6, 0.06, 0.35);
    await wait(900);
  },
};

function bigStamp(text) {
  const el = document.createElement('div');
  el.className = 'unit-slam';
  el.style.fontSize = `${Math.min(110, innerWidth * 0.26)}px`;
  el.style.color = '#ff7ab6';
  el.textContent = text;
  $('#cutins').appendChild(el);
  fitWidth(el);
  const w = el.offsetWidth; const h = el.offsetHeight;
  el.style.left = `${innerWidth / 2 - w / 2}px`; el.style.top = `${innerHeight * 0.2 - h / 2}px`;
  (async () => {
    await tween(320, (k) => { el.style.transform = `scale(${lerp(4, 1, k)}) rotate(${lerp(-25, -6, k)}deg)`; el.style.opacity = Math.min(1, k * 2); }, easeOutBack);
    await wait(1500);
    await tween(300, (k) => { el.style.opacity = 1 - k; el.style.transform = `scale(${1 + k * 0.3}) rotate(-6deg)`; });
    el.remove();
  })();
}

function showResult() {
  const rate = S.firstTry / S.N;
  $('#r-score').textContent = String(BASIC_SCORE);
  $('#r-ok').innerHTML = S.solved;
  $('#r-ng').innerHTML = S.misses;
  $('#r-rate').textContent = `${Math.round(rate * 100)}%`;
  const t = S.endT - S.startT;
  $('#r-time').textContent = fmtTime(t);
  $('#r-dopa').textContent = fmtDopa(S.dopa.L);
  const review = S.plan.mode === 'review';
  const ok = rate >= 0.8 && !review;
  if (S.plan.placement && !S.demo) { progress().placed = true; store.save(); }
  S.record = S.demo ? null : store.addRecord({ mode: S.plan.mode, grade: S.plan.grade, skill: S.plan.skill, count: S.N, score: BASIC_SCORE, ok: S.solved, ng: S.misses, firstRate: rate, timeMs: Math.round(t), dopaL: S.dopa.L });
  if (recording()) { growth.notePlay(stats(), { mode: S.plan.mode, day: store.dayKey(), timeMs: Math.round(t), dopaL: S.dopa.L, firstRate: rate }); store.save(); }
  questNote({ type: 'play', mode: S.plan.mode });
  $('#result-title').textContent = review ? 'Review clear!' : `${modeName(S.plan)} clear!`;
  const un = $('#r-unlock');
  un.textContent = review ? '' : ok ? 'Extra unlocked!' : 'A first-try rate of 80% or more unlocks Extra';
  un.classList.toggle('yes', ok);
  $('#go-extra').hidden = !ok;
  $('#go-extra small').textContent = `${Math.round(EXTRA_MS / 1000)} seconds`;
  $('#go-again').hidden = ok;
  renderSkillNews($('#r-skills'));
  renderGrowth($('#r-growth'));
  renderQuestMini($('#r-quests'));
  if (checkTrophies().length) { const run = S.run; setTimeout(() => { if (run === S.run && S.screen === 'result') openTrophies(); }, 2300); }
  $('#go-tree').hidden = !(S.newUnlocks.length || S.newMastered.length || Object.keys(S.newStars).length || S.plan.placement);
  setReviewButton($('#go-review'), ok ? 0 : S.wrongList.length);
  audio.play('musicGain', audio.now(), { v: 0.55, ramp: 0.6 });
  showScreen('result');
  countUp($('#r-score'), BASIC_SCORE, 900);
  demoAfterResult('result');
}

function countUp(el, to, dur, from = 0) {
  if (S.reduced) { el.textContent = to.toLocaleString('en-US'); return; }
  let lastV = -1;
  tween(dur, (k) => { const v = Math.round(lerp(from, to, k)); if (v !== lastV) { el.textContent = v.toLocaleString('en-US'); lastV = v; if (v % 5 === 0 || to > 400) audio.play('blip', audio.now(), { m: 72 + Math.floor((v / Math.max(1, to)) * 24), v: 0.06 }); } }, easeOutCubic)
    .then(() => { audio.clear(1); const c = centerOf(el); fx.burst(c.x, c.y, { count: 40, kinds: ['confetti', 'star', 'coin'], speed: 700, up: 200, life: 0.6 }); fxBack.burst(c.x, c.y, { count: 90, kinds: ['confetti', 'star', 'coin', 'mini'], speed: 1100, up: 300 }); hero.celebrate(1, { big: true, audio }); });
}

function startExtra() {
  S.run += 1;
  S.mode = 'extra';
  S.extra = { score: 0, solved: 0, misses: 0, end: 0, over: false };
  if (recording()) { growth.noteExtraStart(stats()); store.save(); }
  questNote({ type: 'extra' });
  S.combo = 0;
  showCombo();
  $('.clock').classList.add('extra');
  $('#clock-label').textContent = 'Left';
  $('#ok-total').textContent = '';
  updateTally();
  audio.play('musicGain', audio.now(), { v: 0.8, ramp: 0.2 });
  showScreen('play');
  S.extra.end = now() + EXTRA_MS + 900;
  audio.gong();
  cutin('EXTRA', 1);
  S.flash = 0.8;
  setupProblem();
}

async function endExtra() {
  const run = S.run;
  S.extra.over = true;
  S.ready = false;
  if (S.reach) endReach();
  audio.gong();
  bigStamp("Time's up!");
  S.flash = 0.6;
  await wait(1700);
  if (run === S.run) showFinal();
}

function showFinal() {
  const total = BASIC_SCORE + S.extra.score;
  if (S.record) store.updateRecord(S.record.id, { score: total, extraOk: S.extra.solved, extraNg: S.extra.misses, dopaL: S.dopa.L });
  if (recording()) { growth.noteDopa(stats(), S.dopa.L); store.save(); }
  $('#f-break').textContent = `Basic ${BASIC_SCORE} + Extra ${S.extra.score.toLocaleString('en-US')}`;
  $('#f-ok').innerHTML = S.extra.solved;
  $('#f-ng').innerHTML = S.extra.misses;
  $('#f-bng').innerHTML = S.misses;
  $('#f-time').textContent = fmtTime(S.endT - S.startT);
  $('#f-dopa').textContent = fmtDopa(S.dopa.L);
  renderSkillNews($('#f-skills'));
  renderQuestMini($('#f-quests'));
  if (checkTrophies().length) { const run = S.run; setTimeout(() => { if (run === S.run && S.screen === 'final') openTrophies(); }, 2600); }
  $('#f-tree').hidden = !(S.newUnlocks.length || S.newMastered.length || Object.keys(S.newStars).length || S.plan.placement);
  setReviewButton($('#f-review'), S.wrongList.length);
  audio.play('musicGain', audio.now(), { v: 0.55, ramp: 0.6 });
  showScreen('final');
  demoAfterResult('final');
  countUp($('#f-score'), total, 1300 + Math.min(1400, S.extra.solved * 160));
}

// ---------------------------------------------------------------- demo play
// Plays one round by itself through the normal input and judging path, with
// human-ish timing and occasional slips. Any tap or key ends it, and so does
// returning to the title.
const DEMO = { next: 0, since: 0, timer: 0 };
function startDemo() {
  closeSettings();
  S.demo = true;
  DEMO.since = now();
  body.classList.add('demo');
  DEMO.slipped = 0;
  startGame('demo');
}
function endDemoState() {
  S.demo = false;
  clearTimeout(DEMO.timer);
  body.classList.remove('demo');
}
function stopDemo() {
  if (!S.demo) return;
  toTitle();
}
function demoTick(t) {
  if (!S.demo) return;
  if (S.screen === 'play' && S.ready && t > DEMO.next && S.problem) {
    const st = S.problem.steps[S.step];
    if (!st) return;
    // Keep slips rare enough in the basic set that the extra stage still unlocks.
    const room = S.mode === 'extra' || S.wrongInQ || (DEMO.slipped || 0) < Math.floor(S.N * 0.2);
    const slip = room && !S.shownWrong && Math.random() < (S.mode === 'extra' ? 0.05 : 0.1);
    if (slip && S.mode !== 'extra' && !S.wrongInQ) DEMO.slipped = (DEMO.slipped || 0) + 1;
    const key = slip ? String((Number(st.digit) + 1 + Math.floor(Math.random() * 8)) % 10) : st.digit;
    press(key, padButtons[key]);
    DEMO.next = t + (slip ? 650 : rand(230, 480) * (S.mode === 'extra' ? 0.8 : 1));
  }
}
function demoAfterResult(screen) {
  if (!S.demo) return;
  clearTimeout(DEMO.timer);
  DEMO.timer = setTimeout(() => {
    if (!S.demo) return;
    // One round only: back on the title the demo is over (no second lap).
    if (screen === 'result' && !$('#go-extra').hidden) startExtra();
    else toTitle();
  }, screen === 'result' ? 3800 : 5200);
}
addEventListener('pointerdown', (e) => {
  if (!S.demo || now() - DEMO.since < 600) return;
  e.stopPropagation(); e.preventDefault();
  stopDemo();
}, true);

function modeName(plan) {
  if (plan.mode === 'grade') return MODE_LABEL.grade(plan.grade);
  if (plan.mode === 'practice') return 'Practice';
  if (plan.mode === 'demo') return 'Demo';
  return MODE_LABEL[plan.mode] || 'Drill';
}
// ---------------------------------------------------------------- time capsule (id039)
// One problem a day may come back from the child's first days with a mastered
// skill. It replaces a basic problem in the middle of the set.
function planCapsule() {
  S.capsuleAt = -1;
  if (!recording() || !['level', 'grade', 'practice'].includes(S.plan.mode) || S.plan.placement || S.N < 4) return;
  if ((store.load().capsule || {}).lastDay === store.dayKey()) return;
  const c = pickCapsule(progress());
  if (!c) return;
  const k = Math.max(1, Math.min(S.N - 2, Math.floor(S.N / 2)));
  const p = structuredClone(c.entry.p);
  p.capsule = { skill: c.skill, index: c.index, t: c.entry.t, m: c.entry.m, d: c.entry.d };
  S.problems[k] = p;
  S.capsuleAt = k;
}
const ENVELOPE_SVG = `<svg viewBox="0 0 220 150" aria-hidden="true"><g stroke="#1b1d4d" stroke-width="4" stroke-linejoin="round"><rect x="10" y="40" width="200" height="104" rx="10" fill="#ffe3b8"/><path class="env-letter" d="M28 30 H192 V120 H28Z" fill="#fff"/><path d="M10 50 L110 110 L210 50 V134 Q210 144 200 144 H20 Q10 144 10 134Z" fill="#ffd08a"/><path class="env-flap" d="M10 44 Q10 40 16 40 H204 Q210 40 210 44 L110 104Z" fill="#ffb86b"/><circle cx="110" cy="92" r="13" fill="#ff7ab6"/><path d="M104 92 L110 86 L116 92 L110 98Z" fill="#fff" stroke-width="2"/></g></svg>`;
async function capsuleIntro(info) {
  const r = card.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'capsule-intro';
  el.innerHTML = `<div class="ci-env">${ENVELOPE_SVG}<div class="ci-letter">${`<small>TIME CAPSULE</small><b>From ${fmtDay(info.d)}</b><span>A problem from when you first started!</span>`}</div></div>`;
  el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top + r.height / 2}px`;
  $('#cutins').appendChild(el);
  const env = el.querySelector('.ci-env'); const letter = el.querySelector('.ci-letter'); const flap = el.querySelector('.env-flap');
  audio.play('bell', audio.now(), { m: 84, v: 0.16 });
  if (S.reduced) { letter.style.transform = 'translate(-50%, -62%)'; letter.style.opacity = 1; await wait(1300); el.remove(); return; }
  audio.play('swoosh', audio.now(), { v: 0.2, up: true, dur: 0.3 });
  await tween(380, (k) => { env.style.transform = `translate(-50%, -50%) translateY(${(1 - k) * -160}px) rotate(${(1 - k) * -14}deg) scale(${0.6 + 0.4 * k})`; env.style.opacity = Math.min(1, k * 2); }, easeOutBack);
  await tween(260, (k) => { flap.style.transform = `scaleY(${1 - 2 * k})`; }, easeInOutCubic);
  audio.play('bell', audio.now(), { m: 91, v: 0.14 });
  await tween(420, (k) => { letter.style.transform = `translate(-50%, ${-50 - 60 * k}%) scale(${0.8 + 0.25 * k})`; letter.style.opacity = Math.min(1, k * 2); }, easeOutBack);
  const c = centerOf(letter);
  fx.burst(c.x, c.y, { count: 26, kinds: ['star', 'confetti'], speed: 360, up: 120 });
  await wait(950);
  await tween(260, (k) => { el.style.opacity = 1 - k; el.style.transform = `translateY(${-30 * k}px)`; }, easeInCubic);
  el.remove();
}
// After the capsule problem: mark it used and show "that day -> today".
function capsuleDone(info) {
  useCapsule(progress(), info.skill, info.index);
  store.save();
  const cmp = growth.capsuleCompare(info, S.qMs, S.qMisses || 0);
  const st = stats(); st.capsules = (st.capsules || 0) + 1; if (cmp.what === 'time') st.capsuleFaster = (st.capsuleFaster || 0) + 1;
  const day = fmtDay(info.d);
  const sec = (ms) => `${Math.max(0.1, ms / 1000).toFixed(1)}s`;
  const line = cmp.what === 'time' ? `${day} ${sec(cmp.from)} → today ${sec(cmp.to)}` : cmp.what === 'miss' ? `Oops: ${day} ${cmp.from} → today ${cmp.to}` : `Solved the problem from ${day} again`;
  S.capsuleNews = line;
  const r = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'capsule-result';
  el.innerHTML = cmp.what === 'none' ? `<small>TIME CAPSULE</small><b>From ${day}</b><span>Solved it again!</span>`
    : `<small>TIME CAPSULE</small><span class="cr-row"><span class="cr-old"><i>Then</i>${cmp.what === 'time' ? sec(cmp.from) : `Oops ${cmp.from}`}</span><span class="cr-arrow">→</span><span class="cr-new"><i>Today</i>${cmp.what === 'time' ? sec(cmp.to) : `Oops ${cmp.to}`}</span></span>`;
  el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top + 6}px`;
  $('#cutins').appendChild(el);
  audio.unit(0.7);
  (async () => {
    await wait(350);
    if (!S.reduced) { await tween(320, (k) => { el.style.transform = `translate(-50%, 0) scale(${0.5 + 0.5 * k})`; el.style.opacity = Math.min(1, k * 2); }, easeOutBack); const c = centerOf(el); fx.burst(c.x, c.y, { count: 40, kinds: ['star', 'coin', 'confetti'], speed: 520, up: 160 }); }
    else { el.style.transform = 'translate(-50%, 0)'; el.style.opacity = 1; }
    await wait(1900);
    await tween(240, (k) => { el.style.opacity = 1 - k; });
    el.remove();
  })();
  return true;
}

// A rusty skill polished by a first-try answer (id040): a quick shine.
function polishFx() {
  audio.play('bell', audio.now(), { m: 96, v: 0.14 });
  audio.play('bell', audio.now() + 0.08, { m: 103, v: 0.1 });
  const r = card.getBoundingClientRect();
  const x = r.left + r.width / 2; const y = r.top + 30;
  if (S.reduced) return;
  fx.text(x, y, 'Shine! Sparkle!', { color: '#ffd23f', size: 26, vy: -80, life: 1.1 });
  fx.burst(x, y, { count: 36, kinds: ['spark', 'star'], speed: 520, up: 140 });
  fx.ring(x, y, { color: '#fff', radius: 90, width: 8 });
  S.flash = Math.max(S.flash, 0.3);
}

// "You improved!": this play compared with earlier days, improvements only (id038).
function renderGrowth(el) {
  el.innerHTML = '';
  if (!recording() || S.plan.placement) return;
  const today = store.dayKey();
  const lines = growth.growthLines(S.sessionTimes || {}, progress().skills, today);
  if (!lines.length) return;
  const gst = stats(); gst.grew = (gst.grew || 0) + 1; store.save();
  const when = (x) => (x.kind === 'first' ? `First (${fmtDay(x.d)})` : growth.daysBetween(x.d, today) === 1 ? 'Yesterday' : fmtDay(x.d));
  const val = (what, v) => (what === 'time' ? `${Math.max(0.1, v / 1000).toFixed(1)}s` : `${Math.round(v * 100)}%`);
  el.innerHTML = `<p class="gb-head">${'You improved!'}</p>${lines.map((x) => `<div class="gb-line"><b>${SKILL[x.skill].name}</b><span class="gb-row"><span class="gb-what">${x.what === 'time' ? 'Per problem' : 'First try'}</span><span class="gb-old"><small>${when(x)}</small>${val(x.what, x.from)}</span><span class="gb-arrow">→</span><span class="gb-new"><small>${'Today'}</small><em data-what="${x.what}" data-from="${x.from}" data-to="${x.to}">${val(x.what, S.reduced ? x.to : x.from)}</em></span></span></div>`).join('')}`;
  if (S.reduced) return;
  const run = S.run;
  setTimeout(() => {
    if (run !== S.run) return;
    $$('#r-growth em').forEach((em, i) => setTimeout(() => {
      const from = Number(em.dataset.from); const to = Number(em.dataset.to); const what = em.dataset.what;
      tween(700, (k) => { em.textContent = val(what, lerp(from, to, k)); }, easeOutCubic).then(() => {
        popEl(em, 0.5, 360);
        const c = centerOf(em);
        fx.burst(c.x, c.y, { count: 24, kinds: ['star', 'spark'], speed: 360, up: 100 });
        audio.play('coin', audio.now(), { v: 0.1, m: 86 + i * 2 });
      });
    }, i * 450));
  }, 1200);
}

// Five small paper stars, `n` of them filled (id037).
const STAR_PATH = 'M0 -9 L2.6 -3 L9 -2.8 L4.1 1.4 L5.7 8 L0 4.4 L-5.7 8 L-4.1 1.4 L-9 -2.8 L-2.6 -3Z';
function starRow(n, max = STAR_MAX) {
  return `<svg class="star-row" viewBox="0 0 ${max * 20} 20" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<path transform="translate(${10 + i * 20} 10.5)" d="${STAR_PATH}" class="${i < n ? 'on' : ''}"/>`).join('')}</svg>`;
}
function renderSkillNews(el) {
  const items = [
    ...(S.capsuleNews ? [`<p class="capsule-news"><b>Time capsule</b>${S.capsuleNews}</p>`] : []),
    ...(S.polished || []).map((id) => `<p class="polish-news">Polished! ${SKILL[id].name}</p>`),
    ...Object.entries(S.newStars || {}).map(([id, n]) => `<p class="star-up">${starRow(n)}<span>${`Now ☆${n}! ${SKILL[id].name}`}</span></p>`),
    ...S.newMastered.map((id) => `<p class="mastered">Mastered! ${SKILL[id].name}</p>`),
    ...S.newUnlocks.map((id) => `<p>Unlocked! ${SKILL[id].name}</p>`),
  ];
  if (S.plan.placement) items.unshift(`<p>Skill check done: ${SKILLS.filter((x) => stateOf(progress(), x.id) === 'mastered').length} cleared</p>`);
  el.innerHTML = items.slice(0, 5).join('');
}
function setReviewButton(btn, n) {
  btn.hidden = !n;
  btn.textContent = `Redo ${nOf(n, 'missed problem')}`;
}
function startReview() {
  const prog = progress();
  if (!prog.review.length) return;
  startGame('review');
}
function refreshTitle() {
  const prog = progress();
  const n = prog.review.length;
  $('#start-review').hidden = !n;
  $('#review-count').textContent = n;
  $('#level-sub').textContent = prog.placed ? `Next: "${SKILL[frontier(prog)[0] || ORDER[ORDER.length - 1]].name}"` : 'Starts with a skill check';
  const done = SKILLS.filter((x) => stateOf(prog, x.id) === 'mastered').length;
  $('#tree-badge').textContent = `${done}/${SKILLS.length}`;
  renderQuests();
  refreshTrophyBadge();
  const got = gotTrophies();
  $('#collect-badge').textContent = `${ul.ITEMS.filter((it) => ul.isUnlocked(it, got)).length}/${ul.ITEMS.length}`;
}

function toTitle() {
  if (S.trophyOpen) { S.trophyOpen = false; $('#trophy-got').hidden = true; }
  S.run += 1;
  S.ready = false;
  if (S.reach) endReach();
  if (S.demo) endDemoState();
  audio.stopMusic();
  clearPreviewCrowd();
  applyLook(titleLook());
  refreshTitle();
  S.mode = 'basic';
  applyLevel(0.02, { key: 0 });
  audio.play('musicGain', audio.now(), { v: 0.8, ramp: 0.1 });
  renderCalendar(true);
  showScreen('title');
  checkLoginBonus();
}

// ---------------------------------------------------------------- frame loop
let lastClockText = '';
onFrame((dt, t) => {
  audio.update();
  demoTick(t);
  tickCombo(t);
  const pulse = audio.pulse();
  const targetKick = audio.playing ? pulse.kick * (S.level >= 1 ? 1 : 0.2) : 0;
  S.kick = S.reduced ? 0 : targetKick;
  body.style.setProperty('--kick', S.kick.toFixed(3));

  // dopa counter rolls in log space
  const d = S.dopa;
  if (d.shown < d.L) {
    d.shown = Math.min(d.L, d.shown + Math.max(0.02, (d.L - d.shown) * Math.min(1, dt * 7)));
    $('#dopa').textContent = fmtDopa(d.shown);
    const u = unitOf(d.shown);
    if (u !== d.unit) { if (u) unitSlam(u, d.shown); d.unit = u; }
  }

  // The confirmation dialog pauses the clocks (see closeConfirm).
  if (S.screen === 'play' && !S.confirm) {
    let txt;
    if (S.mode === 'extra') {
      const left = Math.max(0, S.extra.end - t);
      txt = fmtTime(left + 999);
      $('.clock').classList.toggle('hurry', left < 10000);
      if (left < 5500 && left > 0) {
        const sec = Math.ceil(left / 1000);
        if (sec !== S.lastTick) { S.lastTick = sec; audio.tick(sec <= 1); }
      }
      if (left <= 0 && !S.extra.over) endExtra();
    } else {
      const el = (S.endT || t) - S.startT;
      txt = fmtTime(el);
      $('.clock').classList.toggle('over', el > S.targetMs);
      if (el > S.targetMs) $('#clock-label').textContent = 'Over goal';
    }
    if (txt !== lastClockText) { $('#clock').textContent = txt; lastClockText = txt; }

    // Hero wanders around the stage between actions.
    if (!S.reduced && S.motion >= 0.35 && S.E > 0.3 && t > S.idleAt && t > S.busyUntil && !S.reach && !hero.hands.some((h) => h.job)) {
      S.idleAt = t + rand(2200, 4200) / (0.6 + S.E);
      const r = stage.getBoundingClientRect();
      const x = clamp(r.left + r.width / 2 + rand(-0.28, 0.28) * r.width, r.left + 50, r.right - 50);
      hero.hop(20 + 40 * S.E, 420, { to: { x, y: hero.home.y }, spin: S.E > 0.6 && chance(0.3) ? 360 : 0 }).then((ok) => { if (ok) hero.x = x; });
    }
    const target = S.problem && S.problem.steps[S.step] ? S.cells[S.problem.steps[S.step].cell] : null;
    if (target && !hero.hands.some((h) => h.job)) hero.lookAt(centerOf(target));
  }

  // screen shake (keypad stays still to keep tap targets stable)
  S.shake = Math.max(0, S.shake - dt * 30);
  const shk = S.shake * S.motion;
  const sx = shk > 0.1 && !S.reduced ? rand(-shk, shk) : 0;
  const sy = shk > 0.1 && !S.reduced ? rand(-shk, shk) : 0;
  const tr = shk > 0.1 ? `translate(${sx}px, ${sy}px)` : '';
  stage.style.translate = tr ? `${sx}px ${sy}px` : '';
  $('.hud').style.translate = tr ? `${sx * 0.5}px ${sy * 0.5}px` : '';
  S.flash = Math.max(0, S.flash - dt * 3.2);
  $('#flash').style.opacity = S.reduced ? 0 : ((S.flash * S.motion) ** 1.5 * 0.6).toFixed(3);

  // backdrop
  const vE = S.settingsOpen || S.screen === 'collect' ? S.previewE : (S.screen === 'title' || S.screen === 'tree' || S.screen === 'trophy') ? 0.04 : lerp(Math.min(S.E, 0.3), S.E, S.motion);
  S.visualE = lerp(S.visualE, vE, Math.min(1, dt * 2.2));
  const st = bg.state;
  st.E = S.visualE;
  st.kick = S.kick;
  st.flash = S.reduced ? 0 : S.flash * S.motion;
  st.reach = lerp(st.reach, S.reach ? 1 : 0, Math.min(1, dt * 5));
  st.hue += dt * 0.03 * S.visualE;
  const hc = hero.headCenter;
  st.cx = lerp(st.cx || hc.x, S.screen === 'play' ? stage.getBoundingClientRect().left + stage.clientWidth / 2 : innerWidth / 2, Math.min(1, dt * 3));
  st.cy = lerp(st.cy || hc.y, S.screen === 'play' ? stage.getBoundingClientRect().top + stage.clientHeight * 0.55 : innerHeight * 0.4, Math.min(1, dt * 3));
  bg.render(t);
  fx.update(dt);
  fx.draw();
  fxBack.update(dt);
  fxBack.draw();
  // Late idle or slider callbacks must not erase the final reset warning face.
  if (S.confirm?.urgent) setConfirmFace(true);
  const ctx = { beat: S.kick };
  for (const a of actors) {
    if (a === hero && S.guideOpen && S.reduced) a.update(0, 0);
    else a.update(dt, t, ctx);
  }
});

// Title screen idle performance.
onFrame((dt, t) => {
  if (S.screen !== 'title' || S.guideOpen || S.reduced || S.settingsOpen || S.confirm || S.bonusOpen || S.hammerOpen || S.trophyOpen || S.scene) return;
  if (t > S.idleAt && t > S.busyUntil) {
    S.idleAt = t + rand(1600, 2800);
    const r = $('#title-stage').getBoundingClientRect();
    const x = r.left + r.width / 2 + rand(-0.25, 0.25) * r.width;
    const roll = Math.random();
    if (roll < 0.35) hero.hop(40, 420, { to: { x, y: hero.home.y } }).then((ok) => { if (ok) hero.x = x; });
    else if (roll < 0.55) hero.hop(70, 560, { spin: 360 });
    else if (roll < 0.75) hero.celebrate(0.4, { variant: 'earflap' });
    else hero.clap(3);
  }
});

// ---------------------------------------------------------------- wiring
function setMotion(v, { persist = true } = {}) {
  S.motion = clamp(v);
  S.reduced = S.motion <= 0.001;
  fx.reduced = S.reduced; fxBack.reduced = S.reduced;
  fx.motion = S.motion; fxBack.motion = S.motion;
  body.classList.toggle('reduced', S.reduced);
  const sl = $('#motion');
  sl.value = Math.round(S.motion * 100);
  sl.style.setProperty('--v', S.motion);
  $('#motion-val').textContent = `${Math.round(S.motion * 100)}%`;
  ensureCrowd(S.E);
  if (persist) store.updateSettings({ motion: S.motion });
}
function setMuted(m, { persist = true } = {}) {
  S.muted = m;
  audio.setMuted(m);
  const b = $('[data-toggle="sound"]');
  b.setAttribute('aria-pressed', String(!m));
  b.querySelector('b').textContent = m ? 'Off' : 'On';
  $('#mute').setAttribute('aria-pressed', String(m));
  $('#mute').setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  if (persist) store.updateSettings({ sound: !m });
}
function setVolume(v, { persist = true } = {}) {
  audio.setVolume(v);
  const sl = $('#volume');
  sl.value = Math.round(v * 100);
  sl.style.setProperty('--v', v);
  if (persist) store.updateSettings({ volume: v });
}
function setCount(n, { persist = true } = {}) {
  $$('.pick button').forEach((x) => x.setAttribute('aria-checked', String(Number(x.dataset.count) === n)));
  if (persist) store.updateSettings({ count: n });
}

// ---------------------------------------------------------------- skill tree
// Lanes are columns; a node sits below all of its prerequisites and never
// shares a row with another node of the same lane, so the tree grows downward.
// Layout (rows and columns, two columns per lane) comes from session.js.
const TREE = TREE_LAYOUT;
const MIN_COL = 80;
const NODE_H = 58; const ROW_H = 80;

// A link runs from the bottom of the prerequisite to the top of the skill.
// If the direct curve would still pass behind another node, it detours down
// the gap between columns so unrelated nodes never look connected. Detours
// sharing a gap get separate tracks so each line can still be followed.
const GAP = 14;
const TRACKS = [0, -4, 4];
function treeLinks(pos, colW, nodeW) {
  const bez = (t, p0, p1, p2, p3) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;
  const out = []; const detours = [];
  for (const sk of SKILLS) for (const q of sk.req) {
    const a = pos[q]; const b = pos[sk.id];
    const x1 = a.x + nodeW / 2; const y1 = a.y + NODE_H; const x2 = b.x + nodeW / 2; const y2 = b.y;
    const hits = (x, y) => SKILLS.some((o) => o.id !== q && o.id !== sk.id && x > pos[o.id].x - 2 && x < pos[o.id].x + nodeW + 2 && y > pos[o.id].y - 2 && y < pos[o.id].y + NODE_H + 2);
    let blocked = false;
    for (let i = 1; i < 40 && !blocked; i++) { const t = i / 40; blocked = hits(bez(t, x1, x1, x2, x2), bez(t, y1, y1 + 34, y2 - 34, y2)); }
    const link = { from: q, to: sk.id, x1, y1, x2, y2 };
    if (blocked) {
      // Gap on the side facing the target (right side for the same column unless it is the last one).
      const ca = TREE.col[q]; const cb = TREE.col[sk.id];
      link.gap = ca + (cb > ca || (cb === ca && ca < TREE.cols - 1) ? 1 : 0);
      detours.push(link);
    } else link.d = `M${x1} ${y1} C${x1} ${y1 + 34} ${x2} ${y2 - 34} ${x2} ${y2}`;
    out.push(link);
  }
  // Greedy track assignment per gap over the vertical span of each detour.
  const used = {};
  detours.sort((m, n) => m.y1 - n.y1);
  for (const l of detours) {
    const spans = used[l.gap] || (used[l.gap] = TRACKS.map(() => []));
    let k = spans.findIndex((list) => list.every(([s0, s1]) => l.y2 < s0 - 6 || l.y1 > s1 + 6));
    if (k < 0) k = 0;
    spans[k].push([l.y1, l.y2]);
    const off = TRACKS[k];
    const gx = Math.max(3, Math.min(colW * TREE.cols - 3, l.gap * colW)) + off;
    const ya = l.y1 + (ROW_H - NODE_H) / 2 + off; const yb = l.y2 - (ROW_H - NODE_H) / 2 + off;
    l.d = `M${l.x1} ${l.y1} C${l.x1} ${ya} ${l.x1} ${ya} ${(l.x1 + gx) / 2} ${ya} S${gx} ${ya} ${gx} ${ya + 8} L${gx} ${yb - 8} C${gx} ${yb} ${gx} ${yb} ${(gx + l.x2) / 2} ${yb} S${l.x2} ${yb} ${l.x2} ${l.y2}`;
  }
  return out;
}

function renderTree(justIds = [], starIds = []) {
  const prog = progress();
  const tree = $('#tree');
  // Columns never get narrower than MIN_COL; narrow screens scroll sideways.
  const W = $('#tree-scroll').clientWidth - 12 || 360;
  const colW = Math.max(MIN_COL, W / TREE.cols);
  const nodeW = colW - GAP;
  tree.style.width = `${colW * TREE.cols}px`;
  tree.style.height = `${TREE.rows * ROW_H + 20}px`;
  const lanes = $('#tree-lanes');
  lanes.style.width = `${colW * TREE.cols}px`;
  lanes.innerHTML = LANES.map((l) => `<span>${l}</span>`).join('');
  tree.querySelectorAll('.node').forEach((n) => n.remove());
  const pos = {};
  const rustSet = new Set(rustyOf(prog));
  for (const sk of SKILLS) pos[sk.id] = { x: TREE.col[sk.id] * colW + GAP / 2, y: TREE.row[sk.id] * ROW_H + 14 };
  let links = '';
  for (const l of treeLinks(pos, colW, nodeW)) {
    const on = stateOf(prog, l.from) === 'mastered';
    const grow = justIds.includes(l.to);
    links += `<path class="${on ? 'on' : ''}${grow ? ' grow' : ''}" data-to="${l.to}" d="${l.d}"/>`;
  }
  $('#tree-links').innerHTML = links;
  for (const sk of SKILLS) {
    const st = stateOf(prog, sk.id);
    const b = document.createElement('button');
    b.type = 'button';
    const stars = starsOf(prog, sk.id);
    const rusty = rustSet.has(sk.id);
    b.className = `node ${st}${justIds.includes(sk.id) ? ' just' : ''}${starIds.includes(sk.id) ? ' star-up' : ''}${rusty ? ' rusty' : ''}`;
    b.dataset.id = sk.id;
    b.style.cssText = `left:${pos[sk.id].x}px;top:${pos[sk.id].y}px;width:${nodeW}px;height:${NODE_H}px;--p:${masteryRatio(prog, sk.id)}`;
    // Keep words such as "1-digit" whole instead of breaking after the hyphen.
    const name = sk.name.replace(/\S+-\S+/g, (w) => `<span class="nw">${w}</span>`);
    b.innerHTML = `<i class="hold"></i><span class="g">${`Grade ${sk.grade}`}</span><span>${name}</span>${st === 'learning' ? '<i class="ring"></i>' : ''}${st === 'mastered' ? `<i class="stars s${stars}">${starRow(stars)}</i>` : ''}${rusty ? '<i class="rust" aria-hidden="true">rust</i>' : ''}`;
    b.setAttribute('aria-label', `${sk.name}: ${{ locked: 'locked', new: 'new', learning: 'learning', mastered: `mastered, ${nOf(stars, 'star')}${rusty ? ', rusty' : ''}` }[st]}`);
    tree.appendChild(b);
  }
  $('#tree-count').textContent = `${SKILLS.filter((x) => stateOf(prog, x.id) === 'mastered').length} / ${SKILLS.length}`;
  $('#tree-stars').innerHTML = `${starRow(1, 1)}<b>${SKILLS.reduce((a, x) => a + starsOf(prog, x.id), 0)}</b> / ${SKILLS.length * STAR_MAX}`;
  // Animate new branches growing.
  if (!S.reduced) tree.querySelectorAll('.tree-links path.grow').forEach((path) => {
    const L = path.getTotalLength();
    path.style.strokeDasharray = L; path.style.strokeDashoffset = L;
    tween(700, (k) => { path.style.strokeDashoffset = L * (1 - k); }, easeOutCubic);
  });
}

function openTree(justIds = [], starIds = []) {
  audio.unlock();
  audio.play('blip', audio.now(), { m: 79, v: 0.1 });
  showScreen('tree');
  requestAnimationFrame(() => {
    renderTree(justIds, starIds);
    const prog = progress();
    const focus = justIds[0] || starIds[0] || frontier(prog)[0];
    const el = focus && $(`.node[data-id="${focus}"]`);
    const sc = $('#tree-scroll');
    if (el) { sc.scrollTop = Math.max(0, el.offsetTop - 140); sc.scrollLeft = Math.max(0, el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2); }
    requestAnimationFrame(() => {
      layoutActors();
      if (starIds.length && !S.reduced) setTimeout(() => $$('.node.star-up').forEach((n, i) => setTimeout(() => { const c = centerOf(n.querySelector('.stars') || n); fx.burst(c.x, c.y, { count: 22, kinds: ['star'], speed: 300, up: 80 }); audio.play('coin', audio.now(), { v: 0.1, m: 88 + i }); }, i * 250)), 450);
      if (el && !S.reduced) setTimeout(() => {
        const r = el.getBoundingClientRect();
        hero.leapTo({ x: r.left + r.width / 2, y: r.top - 2 }, 120, { audio, spin: 360 }).then(() => { hero.home = { x: hero.x, y: hero.y }; hero.celebrate(0.8, { variant: 'clapjump', audio }); const c = centerOf(el); fx.burst(c.x, c.y, { count: 30, kinds: ['star', 'confetti'], speed: 400, up: 120 }); });
      }, justIds.length ? 500 : 200);
    });
  });
}

// ---------------------------------------------------------------- skill info (id037)
// Mastered skills show their stars and what the next star asks for.
function openSkillInfo(id) {
  const prog = progress();
  const sk = SKILL[id];
  const n = starsOf(prog, id);
  const next = nextStar(prog, id, store.dayKey());
  const r = prog.skills[id] || {};
  const times = (r.times || []).filter((e) => e.f);
  const best = times.length ? Math.min(...times.map((e) => e.t)) : null;
  S.skillInfo = id;
  $('#si-grade').textContent = `Grade ${sk.grade} · ${LANES[sk.lane]}`;
  $('#si-title').textContent = sk.name;
  $('#si-stars').innerHTML = `${starRow(n)}<span>☆${n} / ${STAR_MAX}</span>`;
  $('#si-next').innerHTML = next ? `<p class="si-label">${`Next: ☆${next.n}`}</p><p class="si-text">${next.text}</p><p class="si-now">${next.now}</p>` : '<p class="si-text done">☆5 reached! Amazing!</p>';
  $('#si-note').textContent = `${rustyOf(prog).includes(id) ? 'A little rusty! One first-try answer makes it shine. ' : ''}Solved: ${r.n || 0}${best != null ? ` · Fastest: ${(best / 1000).toFixed(1)}s` : ''}`;
  $('#skill-info').hidden = false;
  const cardEl = $('#skill-info .modal-card');
  if (!S.reduced) tween(260, (k) => { cardEl.style.transform = `translateY(${(1 - k) * 30}px) scale(${0.92 + 0.08 * k})`; }, easeOutBack).then(() => { cardEl.style.transform = ''; });
  requestAnimationFrame(layoutActors);
  $('#si-go').focus({ preventScroll: true });
}
function closeSkillInfo() {
  if (!S.skillInfo) return;
  const id = S.skillInfo;
  S.skillInfo = null;
  $('#skill-info').hidden = true;
  requestAnimationFrame(layoutActors);
  const el = $(`.node[data-id="${id}"]`);
  if (el) el.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- erase (relock) a skill
// Long-press a node (or focus it and press Delete) to erase its records and
// those of every skill built on it, after a confirmation.
const HOLD_MS = 600;
const hold = { timer: 0, node: null, x: 0, y: 0, fired: false, dragged: false };
function cancelHold() {
  clearTimeout(hold.timer);
  if (hold.node) hold.node.classList.remove('holding');
  hold.node = null;
}
function startHold(e) {
  const b = e.target.closest('.node');
  if (!b || e.button > 0) return;
  cancelHold();
  hold.fired = false; hold.dragged = false;
  hold.node = b; hold.x = e.clientX; hold.y = e.clientY;
  b.style.setProperty('--hold-ms', `${HOLD_MS}ms`);
  b.classList.add('holding');
  hold.timer = setTimeout(() => { hold.fired = true; cancelHold(); askRelock(b.dataset.id); }, HOLD_MS);
}

// Shared confirmation dialog (skill erase, back to the title, full reset).
function setConfirmFace(urgent) {
  hero.setFace('wide', urgent ? 'wobble' : 'o');
  hero.sweat.setAttribute('opacity', urgent ? 1 : 0);
  if (urgent) hero.sweat.setAttribute('transform', 'translate(46 -130)');
  hero.shake = urgent && !S.reduced ? 1.4 * S.motion : 0;
}
function openConfirm({ title, msg, list = '', yes, no, danger = true, urgent = false, onYes, focusBack = null }) {
  audio.unlock();
  S.confirm = { onYes, focusBack, urgent, pausedAt: now() };
  $('#confirm-title').textContent = title;
  $('#confirm-msg').innerHTML = msg;
  $('#confirm-list').innerHTML = list;
  $('#confirm-yes').textContent = yes;
  $('#confirm-yes').classList.toggle('danger', danger);
  $('#confirm-no').textContent = no;
  $('#confirm').hidden = false;
  audio.play('boing', audio.now(), { v: 0.1 });
  const cardEl = $('#confirm .modal-card');
  if (!S.reduced) tween(260, (k) => { cardEl.style.transform = `translateY(${(1 - k) * 30}px) scale(${0.92 + 0.08 * k})`; }, easeOutBack).then(() => { cardEl.style.transform = ''; });
  const confirmation = S.confirm;
  requestAnimationFrame(() => {
    if (S.confirm !== confirmation) return;
    layoutActors();
    setConfirmFace(urgent);
  });
  $('#confirm-no').focus({ preventScroll: true });
}
function closeConfirm() {
  const c = S.confirm;
  if (!c) return;
  S.confirm = null;
  $('#confirm').hidden = true;
  // Time spent in the dialog does not count against the clocks.
  const paused = now() - c.pausedAt;
  if (S.screen === 'play') {
    if (S.mode === 'extra' && !S.extra.over) S.extra.end += paused;
    else if (!S.endT) S.startT += paused;
    S.comboEnd += paused;
    S.qStart += paused;
  }
  hero.resetFace();
  hero.shake = 0;
  requestAnimationFrame(layoutActors);
  if (c.focusBack) c.focusBack.focus({ preventScroll: true });
}
function confirmYes() {
  const c = S.confirm;
  if (!c) return;
  closeConfirm();
  c.onYes();
}

function askRelock(id) {
  const ids = relockTargets(progress(), id);
  audio.unlock();
  if (!ids.length) {
    toast('No records to erase yet');
    audio.play('boing', audio.now(), { v: 0.12 });
    return;
  }
  if (navigator.vibrate) navigator.vibrate(25);
  const deps = ids.length - (ids[0] === id ? 1 : 0);
  const MAX = 6;
  openConfirm({
    title: 'Erase skill',
    msg: `This erases your records for "${SKILL[id].name}".${deps ? `<br>The <b>${deps}</b> ${deps === 1 ? 'skill that builds' : 'skills that build'} on it will be erased and locked again too.` : ''}`,
    list: ids.slice(0, MAX).map((x) => `<li>${SKILL[x].name}</li>`).join('') + (ids.length > MAX ? `<li class="more">+${ids.length - MAX} more</li>` : ''),
    yes: 'Erase', no: 'Cancel',
    onYes: () => doRelock(id),
    focusBack: $(`.node[data-id="${id}"]`),
  });
}
function doRelock(id) {
  const prog = progress();
  const gone = relockSkill(prog, id);
  store.save();
  renderTree();
  audio.erase();
  audio.play('boing', audio.now() + 0.08, { v: 0.12 });
  toast(`Erased ${nOf(gone.length, 'skill')}`);
  gone.forEach((x, i) => {
    const el = $(`.node[data-id="${x}"]`);
    if (!el || S.reduced) return;
    setTimeout(() => { el.classList.add('erased'); const c = centerOf(el); fx.puff(c.x, c.y, 8); }, 40 * i);
  });
  if (!S.reduced) { hero.setFace('wide', 'o'); setTimeout(() => hero.resetFace(), 700); }
  const el = $(`.node[data-id="${id}"]`);
  if (el) el.focus({ preventScroll: true });
}

// Escape anywhere but the title asks whether to go back to it.
function askToTitle() {
  const playing = S.screen === 'play';
  openConfirm({
    title: 'Back to the title?',
    msg: playing ? 'This play will end here.' : "You'll go back to the title screen.",
    yes: 'Go back', no: playing ? 'Keep playing' : 'Stay here', danger: playing,
    onYes: () => { audio.play('blip', audio.now(), { m: 72, v: 0.08 }); toTitle(); },
    focusBack: document.activeElement && document.activeElement !== document.body ? document.activeElement : null,
  });
}

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------------------------------------------------------------- calendar
const cal = { y: new Date().getFullYear(), m: new Date().getMonth(), seen: new Set() };
const MODE_NAMES = { drill: (h) => h.count ? `${h.count}-problem drill` : 'Drill', level: () => 'My Level', grade: (h) => `Grade ${h.grade}`, review: () => 'Review', practice: (h) => `Practice (${SKILL[h.skill]?.name || ''})` };
const stampSvg = (score) => {
  const gold = score > 100;
  const col = gold ? '#ffb000' : '#ff4f6d';
  return `<svg viewBox="-20 -20 40 40" aria-hidden="true"><path d="M-2 -15 C10 -16 16 -6 14 4 C12 13 1 17 -8 13 C-16 9 -16 -4 -8 -11 C-3 -15 5 -14 9 -10" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round"/>${gold ? '<path d="M0 -19 l2 4 4 .5 -3 3 .8 4 -3.8 -2 -3.8 2 .8 -4 -3 -3 4 -.5z" fill="#ffd23f" stroke="#1b1d4d" stroke-width="1"/>' : ''}</svg>`;
};
function renderCalendar(animateNew = false) {
  const { y, m } = cal;
  const today = new Date();
  const todayKey = store.dayKey(today);
  $('#cal-title').textContent = `${MONTHS[m]} ${y}`;
  const sum = store.monthSummary(y, m);
  const nocount = store.nocountDays();
  const questDays = (store.load().quests || {}).doneDays || {};
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  let html = '';
  for (let i = 0; i < first; i++) html += '<span class="cal-day blank"></span>';
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const info = sum[key];
    const cls = ['cal-day'];
    if (key === todayKey) cls.push('today');
    if (info) { cls.push('played'); if (animateNew && !cal.seen.has(`${key}:${info.best}`)) cls.push('pop'); }
    const label = info ? `${MONTHS[m]} ${d}: ${nOf(info.plays, 'play')}, best ${info.best} pts${questDays[key] ? ', quests complete' : ''}` : `${MONTHS[m]} ${d}`;
    const sticker = store.stickerOn(key);
    const stk = sticker ? `<span class="stk">${stickerSvg(sticker)}</span>` : '';
    const nc = !info && nocount[key];
    if (questDays[key]) cls.push('quest');
    const qd = questDays[key] ? '<span class="qd" aria-hidden="true">★</span>' : '';
    if (nc) cls.push('nocount');
    const ncStamp = nc ? '<span class="nc">SAVED</span>' : '';
    html += info
      ? `<button type="button" class="${cls.join(' ')}" data-day="${key}" data-key="${key}" aria-label="${label}"><span class="n">${d}</span>${stampSvg(info.best)}<span class="sc${info.best >= 10000 ? ' big' : ''}">${info.best.toLocaleString('en-US')}</span>${stk}${qd}</button>`
      : `<span class="${cls.join(' ')}" data-key="${key}" aria-label="${label}${nc ? ', streak saved' : ''}"><span class="n">${d}</span>${ncStamp}${stk}</span>`;
    if (info) cal.seen.add(`${key}:${info.best}`);
  }
  $('#cal-grid').innerHTML = html;
  const n = store.streak(today);
  const playedToday = store.playedDays().has(todayKey);
  const best = store.bestStreak();
  const bonus = store.bonusState();
  const badges = [];
  if (n >= 1) badges.push(`<span class="cal-badge${n >= 3 ? ' hot' : ''}">${`Streak<b>${n}</b>${n === 1 ? 'day' : 'days'}${playedToday ? '' : ` (today makes ${n + 1})`}`}</span>`);
  else badges.push('<span class="cal-badge">Start a streak today!</span>');
  if (best >= 2) badges.push(`<span class="cal-badge best">${`Best<b>${best}</b>days`}</span>`);
  if (bonus.total) badges.push(`<span class="cal-badge stk">${`Stickers<b>${bonus.total}</b>`}</span>`);
  const hammers = store.items().hammer;
  badges.push(`<span class="cal-badge hmr" aria-label="Streak Hammers: ${hammers}"><i>${HAMMER_SVG}</i><b>${hammers}</b></span>`);
  $('#cal-badges').innerHTML = badges.join('');
  $('#cal-next').disabled = y > today.getFullYear() || (y === today.getFullYear() && m >= today.getMonth());
  if (animateNew && !S.reduced) $$('.cal-day.pop').forEach((el, i) => setTimeout(() => { const c = centerOf(el); fx.burst(c.x, c.y, { count: 14, kinds: ['confetti', 'star'], speed: 260, up: 80 }); audio.play('blip', audio.now(), { m: 84, v: 0.08 }); }, 350 + i * 120));
}
// Login-bonus stickers (hand-cut paper shapes).
function stickerSvg(type) {
  const k = '#1b1d4d';
  const shapes = {
    star: `<path d="M0 -17 L5 -6 L17 -5 L8 3 L11 15 L0 9 L-11 15 L-8 3 L-17 -5 L-5 -6Z" fill="#ffd23f" stroke="${k}" stroke-width="2.5" stroke-linejoin="round"/>`,
    heart: `<path d="M0 15 C-20 2 -15 -14 -6 -13 C-2 -13 0 -9 0 -7 C0 -9 2 -13 6 -13 C15 -14 20 2 0 15Z" fill="#ff7ab6" stroke="${k}" stroke-width="2.5"/>`,
    flower: `${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-9" rx="6.5" ry="9" transform="rotate(${a})" fill="#8fb4ff" stroke="${k}" stroke-width="2.2"/>`).join('')}<circle r="6" fill="#ffd23f" stroke="${k}" stroke-width="2.2"/>`,
    note: `<path d="M-4 9 V-13 L12 -16 V5" fill="none" stroke="${k}" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="-9" cy="10" rx="6.5" ry="5" fill="#3fdcb0" stroke="${k}" stroke-width="2.5"/><ellipse cx="7" cy="6" rx="6.5" ry="5" fill="#3fdcb0" stroke="${k}" stroke-width="2.5"/>`,
    clover: `${[0, 90, 180, 270].map((a) => `<circle cx="0" cy="-7.5" r="7" transform="rotate(${a})" fill="#6fd66f" stroke="${k}" stroke-width="2.2"/>`).join('')}<path d="M2 6 Q6 12 5 17" stroke="${k}" stroke-width="2.5" fill="none"/>`,
    hanamaru: `<path d="M-2 -15 C10 -16 16 -6 14 4 C12 13 1 17 -8 13 C-16 9 -16 -4 -8 -11 C-3 -15 5 -14 9 -10" fill="none" stroke="#ff4f6d" stroke-width="3.5" stroke-linecap="round"/><path d="M-6 -1 Q0 -9 6 -1 Q0 7 -6 -1Z" fill="#ffb3d6" stroke="#ff4f6d" stroke-width="2"/>`,
    crown: `<g stroke="${k}" stroke-width="1.8"><circle cx="-14" cy="3" r="7.5" fill="#ffd23f"/><circle cx="-14" cy="3" r="5" fill="#fff3c4"/><circle cx="14" cy="3" r="7.5" fill="#ffd23f"/><circle cx="14" cy="3" r="5" fill="#fff3c4"/><ellipse cy="4" rx="12.5" ry="10.5" fill="#ffd23f"/><ellipse cy="5.5" rx="10" ry="7.5" fill="#fff3e4"/><circle cx="-4.5" cy="5" r="2.6" fill="#fff" stroke-width="1"/><circle cx="-4.5" cy="5" r="1.9" fill="#ff97bf" stroke-width="1"/><circle cx="4.5" cy="5" r="2.6" fill="#fff" stroke-width="1"/><circle cx="4.5" cy="5" r="1.9" fill="#ff97bf" stroke-width="1"/><path d="M-2 9 Q0 10.5 2 9" fill="none" stroke-width="1.2" stroke-linecap="round"/><path d="M-9 -4 L-9 -14 L-4.5 -9 L0 -16 L4.5 -9 L9 -14 L9 -4Z" fill="#ff97bf" stroke-linejoin="round"/></g>`,
  };
  return `<svg viewBox="-20 -20 40 40" aria-hidden="true">${shapes[type] || shapes.star}</svg>`;
}

let titleRewardTimer = 0;
function scheduleTitleReward(callback) {
  clearTimeout(titleRewardTimer);
  titleRewardTimer = setTimeout(callback, 500);
}
function openBonus(res) {
  if (S.guideOpen) return;
  S.pendingLoginBonus = null;
  S.bonusOpen = true;
  const m = $('#bonus');
  m.hidden = false;
  $('#bonus-run').innerHTML = res.run >= 2 ? `Day<b>${res.run}</b>in a row!` : "Today's bonus";
  const slots = [];
  for (let i = 1; i <= 7; i++) {
    const got = i <= res.slot;
    const type = store.STICKERS[i - 1];
    slots.push(`<div class="bonus-slot${got ? ' got' : ''}${i === res.slot ? ' today stamping' : ''}${i === 7 ? ' big' : ''}"><span class="d">${`Day ${i}`}</span>${got ? stickerSvg(type) : i === 7 ? '?' : i}</div>`);
  }
  $('#bonus-grid').innerHTML = slots.join('');
  $('#bonus-note').textContent = res.slot === 7 ? "Special sticker! It's on your calendar." : `${nOf(7 - res.slot, 'more day')} to a special sticker`;
  audio.unlock();
  requestAnimationFrame(() => {
    layoutActors();
    if (S.reduced) return;
    setTimeout(() => {
      if (!S.bonusOpen || S.guideOpen) return;
      const el = $('#bonus-grid .today');
      if (!el) return;
      const c = centerOf(el);
      audio.play('blip', audio.now(), { m: 84, v: 0.12 });
      audio.unit(res.slot === 7 ? 1 : 0.4);
      fx.burst(c.x, c.y, { count: res.slot === 7 ? 60 : 24, kinds: ['star', 'confetti', ...(res.slot === 7 ? ['coin', 'heart'] : [])], speed: res.slot === 7 ? 700 : 380, up: 150 });
      hero.celebrate(res.slot === 7 ? 1 : 0.5, { big: res.slot === 7, audio });
    }, 700);
  });
  $('#bonus-ok').focus({ preventScroll: true });
}
function closeBonus() {
  $('#bonus').hidden = true;
  S.bonusOpen = false;
  audio.play('blip', audio.now(), { m: 76, v: 0.1 });
  renderCalendar(true);
  requestAnimationFrame(layoutActors);
  titleTrophies();
}
function checkLoginBonus() {
  if (S.demo || S.screen !== 'title' || S.guideOpen || params.has('capture') || S.hammerOpen || S.scene) return;
  if (!store.hasSeenGuide() && !params.has('skill') && !params.has('demo')) { openGuide(); return; }
  // The hammer comes first: using it keeps the login card's run going too.
  const offer = store.hammerOffer();
  if (offer) { scheduleTitleReward(() => openHammer(offer)); return; }
  claimBonus();
}
function claimBonus() {
  const res = S.pendingLoginBonus || store.claimLogin();
  S.pendingLoginBonus = res;
  if (res) scheduleTitleReward(() => openBonus(res));
  else titleTrophies();
}

// ---------------------------------------------------------------- trophies (id036)
const trophyState = () => { const st = store.load(); if (!st.trophies) st.trophies = {}; return st.trophies; };
function trophySnap() {
  const bonus = store.bonusState();
  const stickers = Object.values(bonus.stickers || {});
  return { stats: stats(), prog: progress(), bestStreak: store.bestStreak(), stickers: bonus.total || 0, crowns: stickers.filter((x) => x === 'crown').length, extra: trophyExtra() };
}
// Metrics that later features add (quests, hammer, collection), id045.
function trophyExtra() {
  const days = Object.keys((store.load().quests || {}).doneDays || {}).sort();
  let run = 0; let best = 0; let prev = null;
  for (const d of days) { run = prev && growth.daysBetween(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  const got = trophyState().got || {};
  const own = ul.ITEMS.filter((it) => ul.isUnlocked(it, got));
  return {
    questDays: days.length, questRun: best, hammerUsed: store.items().used || 0,
    itemsOwned: own.length, catComplete: ul.CATS.filter((c) => ul.ITEMS.filter((it) => it.cat === c.key).every((it) => ul.isUnlocked(it, got))).length,
  };
}
S.trophyQueue = [];
function checkTrophies() {
  if (S.demo || params.has('skill') || params.has('capture')) return [];
  const ts = trophyState();
  // The quiet batch is for players who played before trophies existed; a new player's firsts are shown one by one.
  if (!ts.init && !store.load().history.length) ts.init = true;
  // Collection trophies depend on items that other trophies unlock: settle in a few rounds.
  const fresh = [];
  for (let i = 0; i < 3; i++) { const f = tr.evaluate(ts, tr.trophyMetrics(trophySnap())); fresh.push(...f); if (!f.length && ts.init) break; }
  if (fresh.length || (ts.batch && ts.batch.length)) store.save();
  S.trophyQueue.push(...fresh);
  return fresh;
}
function titleTrophies() {
  if (S.screen !== 'title') return;
  checkTrophies();
  refreshTrophyBadge();
  const ts = trophyState();
  // Shown only if the player is still on the title; otherwise they wait for the next chance.
  if (S.trophyQueue.length || (ts.batch && ts.batch.length)) setTimeout(() => { if (S.screen === 'title' && !S.bonusOpen && !S.hammerOpen && !S.scene && !S.settingsOpen && !S.confirm && !S.demo && !S.guideOpen) openTrophies(); }, 450);
}
function refreshTrophyBadge() { $('#trophy-badge').textContent = `${tr.earnedCount(trophyState())}/${tr.TROPHIES.length}`; }

const TROPHY_COL = { bronze: ['#eea36b', '#b8672b'], silver: ['#eef1f7', '#9aa6bf'], gold: ['#ffd23f', '#d99400'], rainbow: ['#ff9ccc', '#7a4bff'], secret: ['#c7a8ff', '#7a4bff'], none: ['#eceaf3', '#b9bbd8'] };
function trophySvg(rank = 'none') {
  const [c0, c1] = TROPHY_COL[rank] || TROPHY_COL.none;
  const rb = rank === 'rainbow';
  const fill = rb ? 'url(#tg-rb)' : c0;
  return `<svg viewBox="-20 -20 40 40" aria-hidden="true">${rb ? '<defs><linearGradient id="tg-rb" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff7ab6"/><stop offset=".4" stop-color="#ffd23f"/><stop offset=".7" stop-color="#3fdcb0"/><stop offset="1" stop-color="#8fb4ff"/></linearGradient></defs>' : ''}<g stroke="#1b1d4d" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M-10.5 -12 C-18 -12 -18 -1 -8 1 M10.5 -12 C18 -12 18 -1 8 1" fill="none" stroke-width="2.6"/><path d="M-11 -16 H11 V-7 C11 2 5.5 6.5 0 6.5 C-5.5 6.5 -11 2 -11 -7Z" fill="${fill}"/><path d="M-3 6.5 L3 6.5 L4.2 11.5 L-4.2 11.5Z" fill="${c1}"/><rect x="-9.5" y="11.5" width="19" height="5.5" rx="2" fill="${fill}"/><path d="M0 -12.5 L1.6 -8.8 L5.6 -8.5 L2.6 -5.9 L3.5 -2 L0 -4.1 L-3.5 -2 L-2.6 -5.9 L-5.6 -8.5 L-1.6 -8.8Z" fill="#fff" stroke-width="1.2"/></g></svg>`;
}

function openTrophies() {
  if (S.trophyOpen || S.demo || S.guideOpen) return;
  const ts = trophyState();
  const batch = (ts.batch || []).map((id) => tr.TROPHY[id]).filter(Boolean);
  const list = batch.length ? batch : S.trophyQueue.splice(0);
  ts.batch = null; store.save();
  if (!list.length) return;
  S.trophyOpen = true;
  $('#tg-title').textContent = 'New trophy!';
  $('#tg-sub').innerHTML = batch.length ? `<b>${batch.length}</b> earned from your past play!` : list.length > 1 ? `You earned <b>${list.length}</b>!` : '';
  const MAX = 6;
  const rewards = list.map((x) => x.reward && ul.ITEM[x.reward]).filter(Boolean);
  $('#tg-list').innerHTML = list.slice(0, MAX).map((x) => `<li class="r-${x.rank}"><i>${trophySvg(x.rank)}</i><span><b>${x.name}</b><small>${x.desc}</small></span></li>`).join('') + (list.length > MAX ? `<li class="more">+${list.length - MAX} more</li>` : '')
    + rewards.map((it) => `<li class="reward"><i>${itemThumb(it)}</i><span>${`<b>You got "${it.name}" (${catName(it.cat)})!</b><small>Pick it in the Collection</small>`}</span></li>`).join('');
  $('#trophy-got').hidden = false;
  audio.unlock();
  audio.unit(Math.min(1, 0.4 + list.length * 0.1));
  const cardEl = $('#trophy-got .modal-card');
  if (!S.reduced) {
    tween(320, (k) => { cardEl.style.transform = `translateY(${(1 - k) * 40}px) scale(${0.85 + 0.15 * k})`; }, easeOutBack).then(() => { cardEl.style.transform = ''; });
    $$('#tg-list li').forEach((li, i) => { li.style.opacity = 0; setTimeout(() => { li.style.opacity = 1; popEl(li, 0.25, 300); audio.play('coin', audio.now(), { v: 0.08, m: 84 + i * 2 }); }, 250 + i * 140); });
    setTimeout(() => { const c = centerOf(cardEl); fx.burst(c.x, c.y - 60, { count: 60, kinds: ['star', 'confetti', 'coin'], speed: 700, up: 200 }); }, 200);
  }
  requestAnimationFrame(() => { layoutActors(); if (!S.reduced) hero.celebrate(0.8, { variant: 'clapjump', audio }); });
  $('#tg-ok').focus({ preventScroll: true });
}
function closeTrophies() {
  if (!S.trophyOpen) return;
  S.trophyOpen = false;
  $('#trophy-got').hidden = true;
  audio.play('blip', audio.now(), { m: 76, v: 0.1 });
  refreshTrophyBadge();
  requestAnimationFrame(layoutActors);
  if (S.trophyQueue.length) setTimeout(openTrophies, 300);
}

// The list screen: one card per series, folded; filters for earned / not yet.
const trFilter = { f: 'all' };
function trophyValueText(t, v) {
  if (t.metric === 'bestDopaL') return `Now ${fmtDopa(stats().bestDopaL || 0)}`;
  if (t.metric === 'minutes') return `Now ${v} min`;
  if (/^(flag:|gradeDone|laneDone|allModes)/.test(t.metric)) return '';
  return `Now ${v.toLocaleString('en-US')}`;
}
function renderTrophyList() {
  const ts = trophyState();
  const m = tr.trophyMetrics(trophySnap());
  const got = ts.got || {};
  const day = (at) => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()}`; };
  let html = '';
  for (const cat of tr.CATS) {
    const cards = tr.SERIES.filter((s) => s.cat === cat).map((s) => tr.seriesView(s, ts, m)).filter((v) => trFilter.f === 'all' || (trFilter.f === 'got' ? v.got.length : v.next));
    if (trFilter.f === 'soon') continue;
    if (!cards.length) continue;
    html += `<h3 class="tr-cat">${cat}</h3>`;
    for (const v of cards) {
      const s = v.series;
      const secret = s.key === 'secret';
      const dots = s.items.map((x) => `<i class="${got[x.id] ? `on r-${x.rank}` : ''}"></i>`).join('');
      const next = v.next ? `<span class="tr-next">${`Next: ${secret ? '???' : v.next.name}${!secret && trophyValueText(v.next, v.value) ? ` (${trophyValueText(v.next, v.value)})` : ''}`}</span>` : '<span class="tr-next done">Complete!</span>';
      const items = s.items.filter((x) => trFilter.f !== 'got' || got[x.id]).map((x) => {
        const hide = x.secret && !got[x.id];
        const rw = x.reward && ul.ITEM[x.reward];
        return `<li class="${got[x.id] ? 'got' : ''}"><i>${trophySvg(got[x.id] ? x.rank : 'none')}</i><span><b>${hide ? '???' : x.name}</b><small>${hide ? 'Secret trophy' : x.desc}</small>${rw && !hide ? `<small class="rw">Reward: ${catName(rw.cat)} "${rw.name}"</small>` : ''}</span><em>${got[x.id] ? day(got[x.id]) : ''}</em></li>`;
      }).join('');
      html += `<details class="tr-series"><summary><i class="tr-icon">${trophySvg(v.top ? v.top.rank : 'none')}</i><span class="tr-t"><b>${s.title}</b>${next}</span><span class="tr-n">${v.got.length}/${s.items.length}</span><span class="tr-dots">${dots}</span></summary><ul>${items}</ul></details>`;
    }
  }
  if (trFilter.f === 'soon') {
    // Closest next steps first (secrets and yes/no goals left out).
    const soon = tr.SERIES.map((s) => tr.seriesView(s, ts, m)).filter((v) => v.next && v.series.key !== 'secret' && v.next.need > 1 && v.next.metric !== 'bestDopaL')
      .map((v) => ({ v, k: Math.min(0.999, v.value / v.next.need) })).sort((a, b) => b.k - a.k).slice(0, 12);
    html = soon.map(({ v, k }) => `<div class="tr-soon"><i class="tr-icon">${trophySvg(v.top ? v.top.rank : 'none')}</i><span class="tr-t"><b>${v.next.name}</b><span class="tr-next">${v.series.title}${' · '}${trophyValueText(v.next, v.value)} / ${v.next.need.toLocaleString('en-US')}</span></span><span class="tr-pct" style="--p:${k.toFixed(3)}"><b>${Math.floor(k * 100)}%</b></span></div>`).join('');
  }
  $('#tr-list').innerHTML = html || '<p class="tr-empty">Nothing here yet</p>';
  $('#trophy-count').textContent = `${tr.earnedCount(ts)} / ${tr.TROPHIES.length}`;
}
function openTrophyList() {
  audio.unlock();
  audio.play('blip', audio.now(), { m: 79, v: 0.1 });
  checkTrophies();
  showScreen('trophy');
  renderTrophyList();
  $('#tr-scroll').scrollTop = 0;
}

// ---------------------------------------------------------------- collection (id041)
const catName = (key) => (ul.CATS.find((c) => c.key === key) || {}).name || '';
const BG_THUMB = {
  classic: 'repeating-conic-gradient(from 0deg at 50% 60%, #3b6bff 0 12deg, #ff7ab6 12deg 24deg)',
  night: 'radial-gradient(circle at 30% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 50% 20%, #ffe98a 0 2px, transparent 3px), linear-gradient(#1b1d4d, #3b2f7a)',
  sea: 'radial-gradient(circle at 30% 70%, transparent 0 6px, #fff 7px 8px, transparent 9px), radial-gradient(circle at 70% 40%, transparent 0 4px, #fff 5px 6px, transparent 7px), linear-gradient(#8fe3ef, #2a6fb8)',
  space: 'radial-gradient(circle at 30% 60%, #ff9ccc 0 9px, transparent 10px), radial-gradient(ellipse at 30% 60%, transparent 0 13px, #ffe98a 14px 15px, transparent 16px), radial-gradient(circle at 75% 30%, #8fd3ff 0 5px, transparent 6px), linear-gradient(135deg, #14082e, #4a1f6e)',
  festival: 'radial-gradient(ellipse at 30% 45%, #ff4f5e 0 9px, #1b1d4d 10px 11px, transparent 12px), radial-gradient(ellipse at 70% 45%, #ffd23f 0 9px, #1b1d4d 10px 11px, transparent 12px), repeating-linear-gradient(45deg, #fff1e0 0 8px, #ff9aa6 8px 16px)',
  paper: 'radial-gradient(circle at 25% 30%, #fff 0 3px, transparent 4px), radial-gradient(circle at 70% 70%, #fff 0 3px, transparent 4px), repeating-linear-gradient(0deg, #ff8fbd 0 10px, #1b1d4d 10px 11px, #8fb4ff 11px 21px, #1b1d4d 21px 22px, #ffd466 22px 32px, #1b1d4d 32px 33px)',
};
const PT_THUMB = {
  classic: '<rect x="-14" y="-10" width="11" height="7" fill="#ff7ab6" stroke="#1b1d4d" stroke-width="1.5" transform="rotate(-20)"/><rect x="2" y="2" width="11" height="7" fill="#3b6bff" stroke="#1b1d4d" stroke-width="1.5" transform="rotate(25)"/><rect x="0" y="-14" width="11" height="7" fill="#ffd23f" stroke="#1b1d4d" stroke-width="1.5"/>',
  note: '<path d="M2 8 V-12 Q10 -8 11 -2" fill="none" stroke="#1b1d4d" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="-3" cy="8" rx="6.5" ry="5" fill="#ff7ab6" stroke="#1b1d4d" stroke-width="2.2"/>',
  petal: '<path d="M0 12 C-14 4 -12 -10 -3 -10 L0 -6 L3 -10 C12 -10 14 4 0 12Z" fill="#ffc2d9" stroke="#1b1d4d" stroke-width="2"/>',
  bubble: '<circle r="12" fill="rgba(191,234,255,.5)" stroke="#3b8fd6" stroke-width="2"/><circle cx="-4" cy="-4" r="3" fill="#fff"/>',
  candy: '<path d="M-8 0 L-16 -7 L-16 7Z M8 0 L16 -7 L16 7Z" fill="#ffd23f" stroke="#1b1d4d" stroke-width="2" stroke-linejoin="round"/><circle r="8.5" fill="#ff7ab6" stroke="#1b1d4d" stroke-width="2"/>',
  digit: '<text y="8" text-anchor="middle" font-family="Dela Gothic One, sans-serif" font-size="24" fill="#3fdcb0" stroke="#1b1d4d" stroke-width="3" paint-order="stroke">7</text>',
};
const FINALE_THUMB = {
  classic: '<circle cy="6" r="13" fill="#ff97bf" stroke="#1b1d4d" stroke-width="2"/><circle cx="-14" cy="-2" r="7" fill="#ff97bf" stroke="#1b1d4d" stroke-width="2"/><circle cx="14" cy="-2" r="7" fill="#ff97bf" stroke="#1b1d4d" stroke-width="2"/><ellipse cy="8" rx="9" ry="7" fill="#fff3e4" stroke="#1b1d4d" stroke-width="1.5"/>',
  fireworks: '<g stroke-linecap="round" stroke-width="2.4">' + Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return `<path d="M${(Math.cos(a) * 5).toFixed(1)} ${(Math.sin(a) * 5).toFixed(1)} L${(Math.cos(a) * 15).toFixed(1)} ${(Math.sin(a) * 15).toFixed(1)}" stroke="${['#ff4f6d', '#ffd23f', '#3b6bff'][i % 3]}"/>`; }).join('') + '</g>',
  rocket: '<g transform="rotate(-35) scale(.3)">' + ROCKET_SVG.replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g>',
  parade: '<rect x="-16" y="-12" width="32" height="12" rx="3" fill="#ff7ab6" stroke="#1b1d4d" stroke-width="2"/><path d="M-12 0 V12 M12 0 V12" stroke="#1b1d4d" stroke-width="2"/><circle cx="-12" cy="14" r="4" fill="#6fa0ff" stroke="#1b1d4d" stroke-width="1.5"/><circle cx="12" cy="14" r="4" fill="#ffd452" stroke="#1b1d4d" stroke-width="1.5"/>',
};
const CROWD_THUMB = { classic: ['blue', 'yellow', 'mint'], costume: ['blue', 'yellow', 'mint'], rainbow: ['rainbow', 'gold', 'snow'], twins: ['pink', 'pink', 'pink'] };
function itemThumb(it) {
  const v = ul.variant(it.id);
  if (it.cat === 'bg') return `<span class="th-bg" style="background:${BG_THUMB[v] || BG_THUMB.classic}"></span>`;
  if (it.cat === 'mark') return v === 'hanamaru' ? '<svg viewBox="-70 -70 140 140"><path d="M-2 -52 C38 -56 56 -20 50 14 C44 46 4 60 -28 46 C-56 32 -56 -14 -28 -38 C-10 -52 18 -48 32 -34" fill="none" stroke="#ff4f6d" stroke-width="9" stroke-linecap="round"/></svg>' : `<svg viewBox="-72 -72 144 144" overflow="visible">${MARKS[v]('#ff4f6d')}</svg>`;
  if (it.cat === 'particle') return `<svg viewBox="-20 -20 40 40">${PT_THUMB[v] || PT_THUMB.classic}</svg>`;
  if (it.cat === 'music') return `<span class="th-music"><svg viewBox="-20 -20 40 40"><path d="M-6 10 V-14 L12 -18 V6" fill="none" stroke="#1b1d4d" stroke-width="3" stroke-linejoin="round"/><ellipse cx="-11" cy="11" rx="6.5" ry="5" fill="${{ classic: '#3fdcb0', chip: '#8fb4ff', matsuri: '#ff4f6d', brass: '#ffd23f', electro: '#a77bff' }[v] || '#3fdcb0'}" stroke="#1b1d4d" stroke-width="2.4"/><ellipse cx="7" cy="7" rx="6.5" ry="5" fill="${{ classic: '#3fdcb0', chip: '#8fb4ff', matsuri: '#ff4f6d', brass: '#ffd23f', electro: '#a77bff' }[v] || '#3fdcb0'}" stroke="#1b1d4d" stroke-width="2.4"/></svg></span>`;
  if (it.cat === 'costume') return dopakichiSVG('pink', v === 'none' ? null : v);
  if (it.cat === 'color') return dopakichiSVG(v);
  if (it.cat === 'crowd') { const pals = CROWD_THUMB[v] || CROWD_THUMB.classic; const cs = Object.keys(COSTUMES); return `<span class="th-crowd">${pals.map((pl, i) => dopakichiSVG(pl, v === 'costume' ? cs[(i * 3 + 1) % cs.length] : null)).join('')}</span>`; }
  if (it.cat === 'finale') return `<svg viewBox="-20 -20 40 40" overflow="visible">${FINALE_THUMB[v] || FINALE_THUMB.classic}</svg>`;
  return '';
}

const co = { cat: 'bg', timer: 0, crowd: [] };
function clearPreviewCrowd() { co.crowd.forEach(dropActor); co.crowd = []; clearTimeout(co.timer); if (S.screen !== 'play') audio.stopMusic(); }
function openCollection() {
  audio.unlock();
  audio.play('blip', audio.now(), { m: 79, v: 0.1 });
  checkTrophies();
  S.previewE = 0.3;
  showScreen('collect');
  renderCollection();
  requestAnimationFrame(layoutActors);
}
function renderCollection() {
  const got = gotTrophies(); const eq = equipState();
  $('#co-tabs').innerHTML = ul.CATS.map((c) => { const own = ul.unlockedIn(c.key, got).length; const all = ul.ITEMS.filter((it) => it.cat === c.key).length; return `<button type="button" data-cat="${c.key}" aria-pressed="${c.key === co.cat}">${c.name}<small>${own}/${all}</small></button>`; }).join('');
  const items = ul.ITEMS.filter((it) => it.cat === co.cat);
  const auto = eq[co.cat] === 'auto';
  $('#co-note').textContent = auto ? '"Shuffle" picks a different one you own every play' : 'Your pick is used every time';
  $('#co-grid').innerHTML = `<button type="button" class="co-item auto${auto ? ' on' : ''}" data-id="auto"><span class="co-th"><b>${'?'}</b></span><span class="co-name">${'Shuffle'}</span><small>${'Changes every play'}</small></button>`
    + items.map((it) => {
      const own = ul.isUnlocked(it, got);
      const on = !auto && eq[co.cat] === it.id;
      const tro = it.trophy && tr.TROPHY[it.trophy];
      return `<button type="button" class="co-item${own ? '' : ' locked'}${on ? ' on' : ''}" data-id="${it.id}"${own ? '' : ` aria-label="Locked. Earn the trophy &quot;${tro ? tro.name : ''}&quot; to get it"`}><span class="co-th">${itemThumb(it)}</span><span class="co-name">${own ? it.name : '???'}</span>${own ? '<small>&nbsp;</small>' : `<small class="co-lock">Trophy: ${tro ? tro.name : ''}</small>`}</button>`;
    }).join('');
  const all = ul.ITEMS.length; const own = ul.ITEMS.filter((it) => ul.isUnlocked(it, got)).length;
  $('#collect-count').textContent = `${own} / ${all}`;
  $('#co-now').textContent = `${catName(co.cat)}: ${auto ? 'Shuffle' : (ul.ITEM[eq[co.cat]] || {}).name || ''}`;
}
// Try an item out on this screen.
function previewItem(id) {
  clearPreviewCrowd();
  const it = ul.ITEM[id] || ul.ITEMS.find((x) => x.cat === co.cat && x.base);
  const look = { ...titleLook(), [it.cat]: it.id };
  applyLook(look);
  const v = ul.variant(it.id);
  const b = $('#co-preview').getBoundingClientRect();
  const cx = b.left + b.width / 2; const cy = b.top + b.height * 0.45;
  S.previewE = 0.3;
  if (it.cat === 'bg') tween(1400, (k) => { S.previewE = 0.3 + 0.8 * Math.sin(Math.min(1, k * 1.3) * Math.PI / 2); }, easeOutCubic);
  if (it.cat === 'mark') hanamaru(0.9, $('#co-mark'), v);
  if (it.cat === 'particle') for (let i = 0; i < 3; i++) setTimeout(() => fx.burst(cx, cy, { count: 40, kinds: ['confetti'], speed: 520, up: 180 }), i * 250);
  if (it.cat === 'music') { audio.key = 0; audio.setLevel(8, 124); audio.startMusic(); co.timer = setTimeout(() => audio.stopMusic(), 7000); }
  if (it.cat === 'costume' || it.cat === 'color') { if (!S.reduced) hero.celebrate(0.8, { variant: 'spinjump', audio }); fx.burst(cx, cy, { count: 24, kinds: ['star'], speed: 380, up: 120 }); }
  if (it.cat === 'crowd') {
    for (let i = 0; i < 4; i++) {
      const cl = crowdLook(i);
      const m = new Dopakichi(backLayer, { scale: 0.34, palette: cl.pal, front: frontLayer });
      if (cl.costume) m.setCostume(cl.costume);
      m.place(b.left + b.width * (0.12 + 0.25 * i), b.bottom - 10);
      actors.push(m); co.crowd.push(m);
      if (!S.reduced) setTimeout(() => m.celebrate(0.8, {}), 150 * i);
    }
    co.timer = setTimeout(clearPreviewCrowd, 3500);
  }
  if (it.cat === 'finale' && !S.reduced) (FINALES[v] || FINALES.classic)(innerWidth, innerHeight);
}
function pickItem(id) {
  const got = gotTrophies(); const eq = equipState();
  if (id === 'auto') { eq[co.cat] = 'auto'; store.save(); audio.play('blip', audio.now(), { m: 80, v: 0.1 }); renderCollection(); previewItem(null); return; }
  const it = ul.ITEM[id];
  if (!ul.isUnlocked(it, got)) { audio.play('boing', audio.now(), { v: 0.1 }); const el = $(`.co-item[data-id="${id}"]`); if (el && !S.reduced) tween(300, (k) => { el.style.translate = `${Math.sin(k * 20) * 5 * (1 - k)}px 0`; }).then(() => { el.style.translate = ''; }); return; }
  eq[co.cat] = id; store.save();
  audio.play('coin', audio.now(), { v: 0.1, m: 86 });
  renderCollection();
  previewItem(id);
}

// ---------------------------------------------------------------- no-count hammer (id034)
// A squeaky toy hammer (paper cut-out). Grip at (50, 94), head centre at (50, 27).
const HAMMER_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#1b1d4d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"><path d="M44.5 40 L55.5 40 L57 97 L43 97Z" fill="#3b6bff"/><path d="M44 60 L56 57 M44 74 L56 71 M44 88 L56 85" fill="none" stroke-width="2.6"/><rect x="13" y="12" width="74" height="30" rx="13" fill="#ff7ab6"/><rect x="5" y="8" width="15" height="38" rx="6" fill="#ffd23f"/><rect x="80" y="8" width="15" height="38" rx="6" fill="#ffd23f"/><path d="M28 20 Q50 15 72 20" fill="none" stroke="#fff" stroke-width="3" opacity=".85"/></g></svg>`;
const HAMMER_REACH = 67; // grip to head centre, in px at the swing size

const fmtDay = (key) => { const [, m, d] = key.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${d}`; };
function openHammer(offer) {
  if (S.guideOpen) return;
  S.hammerOpen = offer;
  $('#hammer-art').innerHTML = HAMMER_SVG;
  const days = listJoin(offer.days.map(fmtDay));
  $('#hammer-msg').innerHTML = `You didn't play on ${days}.<br>Stamp ${offer.days.length > 1 ? 'them' : 'it'} <b>SAVED</b>,<br>and your <b>${offer.run}</b>-day streak goes on!`;
  const max = store.HAMMER.max;
  $('#hammer-have').innerHTML = `${'Your hammers'} ${Array.from({ length: max }, (_, i) => `<i class="${i < offer.hammers ? 'on' : ''}">${HAMMER_SVG}</i>`).join('')}`;
  $('#hammer-yes').textContent = `Use ${nOf(offer.days.length, 'hammer')}`;
  $('#hammer').hidden = false;
  audio.unlock();
  audio.play('boing', audio.now(), { v: 0.12 });
  const cardEl = $('#hammer .modal-card');
  if (!S.reduced) tween(300, (k) => { cardEl.style.transform = `translateY(${(1 - k) * 40}px) scale(${0.9 + 0.1 * k})`; }, easeOutBack).then(() => { cardEl.style.transform = ''; });
  requestAnimationFrame(() => { layoutActors(); hero.setFace('wide', 'o'); });
  $('#hammer-yes').focus({ preventScroll: true });
}
function closeHammer(use) {
  const offer = S.hammerOpen;
  if (!offer) return;
  S.hammerOpen = null;
  $('#hammer').hidden = true;
  hero.resetFace();
  if (!use) {
    store.declineHammer();
    audio.play('blip', audio.now(), { m: 72, v: 0.08 });
    requestAnimationFrame(layoutActors);
    claimBonus();
    return;
  }
  audio.play('blip', audio.now(), { m: 84, v: 0.12 });
  runHammer(offer).then(claimBonus);
}

// Dopakichi hops down to each missed day and stamps it "no count".
async function runHammer(offer) {
  store.useHammer(offer.days);
  S.scene = true;
  const setMonth = (key) => { const [y, m] = key.split('-').map(Number); if (cal.y !== y || cal.m !== m - 1) { cal.y = y; cal.m = m - 1; renderCalendar(); } };
  setMonth(offer.days[0]);
  $('#calendar').scrollIntoView({ block: 'center', behavior: S.reduced ? 'auto' : 'smooth' });
  await wait(S.reduced ? 60 : 520);
  hero.S = 0.42;
  for (const day of offer.days) {
    setMonth(day);
    await hammerHit(day);
  }
  renderCalendar();
  const badge = $('.cal-badge');
  if (badge) {
    const c = centerOf(badge);
    if (!S.reduced) { fx.text(c.x, c.y - 30, `${offer.run}-day streak saved!`, { color: '#ff7ab6', size: 26, vy: -70, life: 1.4 }); fx.burst(c.x, c.y, { count: 40, kinds: ['star', 'confetti', 'heart'], speed: 520, up: 160 }); }
    audio.unit(0.6);
    popEl(badge, 0.5, 400);
  }
  if (!S.reduced) await hero.celebrate(0.8, { variant: 'clapjump', audio });
  await wait(300);
  S.scene = false;
  layoutActors();
}

async function hammerHit(day) {
  const cell = $(`.cal-day[data-key="${day}"]`);
  if (!cell) return;
  const c = centerOf(cell);
  const stamp = () => {
    renderCalendar();
    const el = $(`.cal-day[data-key="${day}"]`);
    if (el && !S.reduced) el.classList.add('stamped');
    audio.play('impact', audio.now(), { v: 0.5 });
    audio.play('whistle', audio.now(), { from: 1900, to: 2600, dur: 0.09, v: 0.08 });
  };
  if (S.reduced) { stamp(); await wait(250); return; }
  // Swing from the side with more room; the head lands on the day.
  const fromLeft = c.x > innerWidth / 2;
  const down = fromLeft ? 95 : -95;
  const rad = (a) => (a * Math.PI) / 180;
  const grip = { x: c.x - HAMMER_REACH * Math.sin(rad(down)), y: c.y + HAMMER_REACH * Math.cos(rad(down)) };
  const ham = document.createElement('div');
  ham.className = 'hammer-fx';
  ham.innerHTML = HAMMER_SVG;
  ham.style.left = `${grip.x - 50}px`; ham.style.top = `${grip.y - 94}px`;
  $('#cutins').appendChild(ham);
  const set = (a, s = 1, o = 1) => { ham.style.transform = `rotate(${a}deg) scale(${s})`; ham.style.opacity = o; };
  set(-down * 0.15, 0.2, 0);
  // Dopakichi lands beside the grip and holds it.
  const feet = { x: grip.x + (fromLeft ? -44 : 44), y: grip.y + 22 };
  await hero.leapTo(feet, 90, { audio });
  hero.home = { ...feet };
  const h = hero.hands[fromLeft ? 1 : 0];
  h.mode = 'free'; h.job = -1;
  const hold = onFrame(() => { h.x = grip.x; h.y = grip.y; });
  hero.setFace('tight', 'grin');
  await tween(220, (k) => set(-down * 0.15 - down * 0.2 * k, 0.2 + 0.8 * k, k), easeOutBack);
  audio.play('swoosh', audio.now(), { v: 0.2, up: false, dur: 0.16 });
  await tween(150, (k) => set(-down * 0.35 + down * 1.35 * k), easeInCubic);
  stamp();
  S.shake = Math.max(S.shake, 9);
  fx.puff(c.x, c.y + 12, 8);
  fx.burst(c.x, c.y, { count: 26, kinds: ['star', 'spark', 'confetti'], speed: 420, up: 120 });
  fx.ring(c.x, c.y, { color: '#ff7ab6', radius: 56, width: 6 });
  hero.sq.kick(-2);
  hero.earL.kick(800); hero.earR.kick(-800);
  await tween(120, (k) => set(down - down * 0.2 * Math.sin(k * Math.PI)));
  await wait(260);
  hero.setFace('happy', 'grin');
  await tween(240, (k) => { set(down * (1 - k), 1 - 0.4 * k, 1 - k); ham.style.translate = `0 ${-30 * k}px`; }, easeInCubic);
  hold();
  h.mode = 'rest'; h.job = 0;
  ham.remove();
  hero.resetFace();
}

function moveMonth(dir) {
  cal.m += dir;
  if (cal.m < 0) { cal.m = 11; cal.y -= 1; }
  if (cal.m > 11) { cal.m = 0; cal.y += 1; }
  audio.unlock();
  audio.play('blip', audio.now(), { m: dir > 0 ? 76 : 72, v: 0.08 });
  renderCalendar();
}
function openDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const list = store.monthSummary(y, m - 1)[key]?.entries || [];
  $('#day-title').textContent = `${MONTHS[m - 1]} ${d}`;
  $('#day-list').innerHTML = list.slice().reverse().map((h) => {
    const t = new Date(h.at);
    const hr = t.getHours();
    const name = (MODE_NAMES[h.mode] || (() => h.mode))(h);
    const extra = h.extraOk ? ` · Extra ${h.extraOk}` : '';
    const time = `${hr % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')} ${hr < 12 ? 'AM' : 'PM'}`;
    return `<li><span class="t">${time}</span><span class="m">${name}</span><span class="s">${`${(h.score || 0).toLocaleString('en-US')} pts`}</span><span class="d">${`Correct ${h.ok ?? '-'} · Oops ${h.ng ?? '-'}${extra} · ${fmtTime(h.timeMs || 0)}`}</span></li>`;
  }).join('');
  $('#day-log').hidden = false;
  audio.unlock();
  audio.play('blip', audio.now(), { m: 79, v: 0.1 });
  $('#close-day').focus({ preventScroll: true });
}

// ---------------------------------------------------------------- settings panel
S.previewE = 0.04;
function openSettings() {
  if (S.demo || S.guideOpen) return;
  audio.unlock();
  const m = $('#settings');
  m.hidden = false;
  S.settingsOpen = true;
  S.previewE = 0.04 + 0.3 * S.motion;
  audio.play('blip', audio.now(), { m: 79, v: 0.1 });
  const card = m.querySelector('.modal-card');
  if (!S.reduced) tween(300, (k) => { card.style.transform = `translateY(${(1 - k) * 40}px) scale(${0.9 + 0.1 * k})`; }, easeOutBack).then(() => { card.style.transform = ''; });
  requestAnimationFrame(() => { layoutActors(); if (!S.reduced) hero.hop(40, 380, { audio }); });
  $('#close-settings').focus({ preventScroll: true });
}
function closeSettings() {
  $('#settings').hidden = true;
  S.settingsOpen = false;
  audio.play('blip', audio.now(), { m: 72, v: 0.08 });
  requestAnimationFrame(layoutActors);
  $('#open-settings').focus({ preventScroll: true });
  // Trophies held back while the panel was open.
  if (S.screen === 'title' && !S.demo) titleTrophies();
}

function askReset() {
  if (S.demo || !S.settingsOpen) return;
  closeSettings();
  openConfirm({
    title: 'Reset everything',
    msg: 'This erases all records, skills, trophies, collection items, stickers and settings.',
    yes: 'Erase', no: 'Cancel', focusBack: $('#open-settings'),
    onYes: () => openConfirm({
      title: 'Really erase everything?',
      msg: "Once it's erased, it can't be brought back.",
      yes: 'Erase all', no: 'Cancel', urgent: true, focusBack: $('#open-settings'),
      onYes: () => { store.reset(); location.reload(); },
    }),
  });
}

// Dragging the motion slider previews the effect strength: the thumb
// throws particles, Dopakichi reacts, and the pitch climbs with the value.
let lastSliderFx = 0;
function motionSliderFx(v) {
  const t = now();
  S.previewE = 0.04 + 0.9 * v;
  if (t - lastSliderFx < 70) return;
  lastSliderFx = t;
  const sl = $('#motion').getBoundingClientRect();
  const x = sl.left + 16 + (sl.width - 32) * v; const y = sl.top + sl.height / 2;
  audio.play('blip', audio.now(), { m: 60 + Math.round(v * 24), v: 0.05 + 0.08 * v });
  if (v <= 0.001) { hero.setFace('closed', 'smile'); setTimeout(() => hero.resetFace(), 500); return; }
  fx.burst(x, y, { count: Math.round(2 + 26 * v), speed: 160 + 520 * v, kinds: burstKinds(v), up: 120, life: 0.5 });
  if (v > 0.5) fx.ring(x, y, { color: v > 0.85 ? '#ffd23f' : '#ff7ab6', radius: 20 + 50 * v, width: 5 });
  S.shake = Math.max(S.shake, 6 * v * v);
  if (v > 0.9) S.flash = Math.max(S.flash, 0.25);
  if (performance.now() > S.busyUntil) {
    S.busyUntil = performance.now() + 260 + 200 * v;
    hero.setFace(v > 0.7 ? 'star' : 'happy', v > 0.5 ? 'grin' : 'cat');
    setTimeout(() => hero.resetFace(), 420);
    if (v > 0.8) hero.hop(30 + 50 * v, 420, { spin: 360, audio });
    else hero.hop(8 + 40 * v, 280, { audio });
  }
}

$$('.pick button').forEach((b) => b.addEventListener('click', () => {
  setCount(Number(b.dataset.count));
  audio.unlock();
  audio.play('blip', audio.now(), { m: 76 + Number(b.dataset.count) / 2, v: 0.12 });
  if (!S.reduced) hero.hop(20 + Number(b.dataset.count) * 2 * S.motion, 320, { audio });
}));
$('#start').addEventListener('click', () => startGame('level'));
$('#quest-list').addEventListener('click', (e) => { const li = e.target.closest('li.go'); if (li && SKILL[li.dataset.skill]) { audio.unlock(); audio.play('blip', audio.now(), { m: 84, v: 0.12 }); startGame('practice', li.dataset.skill); } });
$('#cal-prev').addEventListener('click', () => moveMonth(-1));
$('#cal-next').addEventListener('click', () => moveMonth(1));
$('#cal-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-day]'); if (b) openDay(b.dataset.day); });
$('#close-day').addEventListener('click', () => { $('#day-log').hidden = true; });
$('#day-log').addEventListener('click', (e) => { if (e.target.id === 'day-log') $('#day-log').hidden = true; });
$('#screen-title').addEventListener('scroll', () => requestAnimationFrame(layoutActors), { passive: true });
$$('#screen-result, #screen-final, #tree-scroll, #tr-scroll').forEach((el) => el.addEventListener('scroll', () => requestAnimationFrame(layoutActors), { passive: true }));
$('#open-settings').addEventListener('click', openSettings);
$('#open-guide').addEventListener('click', () => openGuide(true));
$('#close-settings').addEventListener('click', closeSettings);
$('#reset-data').addEventListener('click', askReset);
$('#demo-play').addEventListener('click', startDemo);
$('#bonus-ok').addEventListener('click', closeBonus);
$('#hammer-yes').addEventListener('click', () => closeHammer(true));
$('#tg-ok').addEventListener('click', closeTrophies);
$('#si-close').addEventListener('click', () => { audio.play('blip', audio.now(), { m: 72, v: 0.08 }); closeSkillInfo(); });
$('#si-go').addEventListener('click', () => { const id = S.skillInfo; closeSkillInfo(); audio.play('blip', audio.now(), { m: 84, v: 0.12 }); startGame('practice', id); });
$('#skill-info').addEventListener('click', (e) => { if (e.target.id === 'skill-info') closeSkillInfo(); });
$('#trophy-got').addEventListener('click', (e) => { if (e.target.id === 'trophy-got') closeTrophies(); });
$('#open-trophy').addEventListener('click', openTrophyList);
$('#open-collect').addEventListener('click', openCollection);
$('#collect-back').addEventListener('click', () => { audio.play('blip', audio.now(), { m: 72, v: 0.08 }); toTitle(); });
$('#co-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; co.cat = b.dataset.cat; audio.play('blip', audio.now(), { m: 80, v: 0.08 }); clearPreviewCrowd(); renderCollection(); $('#co-scroll').scrollTop = 0; });
$('#co-grid').addEventListener('click', (e) => { const b = e.target.closest('.co-item'); if (b) pickItem(b.dataset.id); });
$('#trophy-back').addEventListener('click', () => { audio.play('blip', audio.now(), { m: 72, v: 0.08 }); toTitle(); });
$$('.tr-filter button').forEach((b) => b.addEventListener('click', () => { trFilter.f = b.dataset.f; $$('.tr-filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); audio.play('blip', audio.now(), { m: 80, v: 0.08 }); renderTrophyList(); }));
$('#tr-list').addEventListener('toggle', (e) => { if (e.target.open) audio.play('blip', audio.now(), { m: 84, v: 0.07 }); }, true);
$('#hammer-no').addEventListener('click', () => closeHammer(false));
$('#settings').addEventListener('click', (e) => { if (e.target.id === 'settings') closeSettings(); });
$('[data-toggle="sound"]').addEventListener('click', () => { audio.unlock(); setMuted(!S.muted); if (!S.muted) audio.play('blip', audio.now(), { m: 84, v: 0.12 }); });
$('#volume').addEventListener('input', (e) => { audio.unlock(); const v = e.target.value / 100; setVolume(v); audio.play('blip', audio.now(), { m: 64 + Math.round(v * 20), v: 0.12 }); });
$('#motion').addEventListener('input', (e) => { const v = e.target.value / 100; setMotion(v); motionSliderFx(v); });
$('#motion').addEventListener('change', () => { S.previewE = 0.04 + 0.3 * S.motion; });
$('#mute').addEventListener('click', () => setMuted(!S.muted));
$('#go-extra').addEventListener('click', startExtra);
$('#go-title').addEventListener('click', toTitle);
$('#go-again').addEventListener('click', () => startGame(S.kind, S.kindArg));
$('#again').addEventListener('click', toTitle);
$('#go-review').addEventListener('click', startReview);
$('#f-review').addEventListener('click', startReview);
$('#start-review').addEventListener('click', startReview);
$$('.grades button').forEach((b) => b.addEventListener('click', () => startGame('grade', Number(b.dataset.grade))));
$('#open-tree').addEventListener('click', () => openTree());
$('#tree').addEventListener('pointerdown', startHold);
$('#tree').addEventListener('contextmenu', (e) => { if (e.target.closest('.node')) e.preventDefault(); });
$('#tree-scroll').addEventListener('scroll', cancelHold, { passive: true });
addEventListener('pointermove', (e) => { if (hold.node && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) { hold.dragged = true; cancelHold(); } });
addEventListener('pointerup', cancelHold);
addEventListener('pointercancel', cancelHold);
$('#confirm-no').addEventListener('click', () => { audio.play('blip', audio.now(), { m: 72, v: 0.08 }); closeConfirm(); });
$('#confirm-yes').addEventListener('click', confirmYes);
$('#confirm').addEventListener('click', (e) => { if (e.target.id === 'confirm') closeConfirm(); });
$('#tree').addEventListener('click', (e) => {
  const b = e.target.closest('.node');
  if (!b) return;
  // The click that ends a long press, or a drag across the tree, does nothing.
  if (hold.fired || hold.dragged) { hold.fired = false; hold.dragged = false; return; }
  const id = b.dataset.id; const st = stateOf(progress(), id);
  if (st === 'locked') {
    const need = SKILL[id].req.filter((q) => stateOf(progress(), q) !== 'mastered').map((q) => `"${SKILL[q].name}"`);
    toast(`Master ${listJoin(need)} to unlock this`);
    audio.play('boing', audio.now(), { v: 0.12 });
    if (!S.reduced) tween(300, (k) => { b.style.translate = `${Math.sin(k * 20) * 5 * (1 - k)}px 0`; }).then(() => { b.style.translate = ''; });
    return;
  }
  audio.play('blip', audio.now(), { m: 84, v: 0.12 });
  if (st === 'mastered') { openSkillInfo(id); return; }
  startGame('practice', id);
});
$('#go-tree').addEventListener('click', () => openTree(S.newUnlocks, Object.keys(S.newStars)));
$('#f-tree').addEventListener('click', () => openTree(S.newUnlocks, Object.keys(S.newStars)));
$('#tree-back').addEventListener('click', () => { audio.play('blip', audio.now(), { m: 72, v: 0.08 }); toTitle(); });
// Back to the title from a play, through the same confirmation as Escape.
$('#play-back').addEventListener('click', () => { if (S.screen !== 'play' || S.demo) return; audio.play('blip', audio.now(), { m: 72, v: 0.08 }); askToTitle(); });
// Japanese lives in the sibling ja/ folder. The choice is kept apart
// from the game data so that a full reset does not switch the language.
$('#lang').addEventListener('change', (e) => {
  if (e.target.value !== 'ja') return;
  try { localStorage.setItem('japanese-math-drill:lang', 'ja'); } catch { /* storage blocked: Japanese just for now */ }
  location.replace('../ja/');
});

for (const [key, b] of Object.entries(padButtons)) {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); press(key, b); });
  b.addEventListener('click', (e) => { if (e.detail === 0) press(key, b); });
}
addEventListener('keydown', (e) => {
  if (guide.keydown(e)) return;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (S.demo) { e.preventDefault(); stopDemo(); return; }
  if (S.settingsOpen) { if (e.key === 'Escape') closeSettings(); return; }
  if (S.confirm) { if (e.key === 'Escape') closeConfirm(); return; }
  if (S.screen === 'tree' && e.key === 'Delete' && document.activeElement && document.activeElement.classList.contains('node')) { askRelock(document.activeElement.dataset.id); e.preventDefault(); return; }
  if (S.bonusOpen) { if (e.key === 'Escape' || e.key === 'Enter') closeBonus(); return; }
  if (S.hammerOpen) { if (e.key === 'Escape') closeHammer(false); return; }
  if (S.trophyOpen) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeTrophies(); } return; }
  if (S.skillInfo) { if (e.key === 'Escape') closeSkillInfo(); return; }
  if (S.scene) return;
  if (!$('#day-log').hidden) { if (e.key === 'Escape') $('#day-log').hidden = true; return; }
  if (e.key === 'Escape' && S.screen !== 'title') { e.preventDefault(); askToTitle(); return; }
  if (/^[0-9]$/.test(e.key)) { audio.unlock(); press(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { press('Backspace'); e.preventDefault(); }
});
addEventListener('pointermove', (e) => { if (S.screen !== 'play' && !S.guideOpen) hero.lookAt({ x: e.clientX, y: e.clientY }); });
addEventListener('resize', () => requestAnimationFrame(() => {
  if (S.screen === 'play' && S.problem) fitSheet(S.problem);
  layoutActors();
}));

// Bunting flags
(() => {
  const g = $('#flags');
  const cols = ['#ff7ab6', '#3b6bff', '#ffd23f', '#3fdcb0', '#a77bff'];
  let s = '';
  for (let i = 0; i < 13; i++) {
    const x = 12 + i * 29.5; const y = 4 + Math.sin((x / 400) * Math.PI) * 26;
    s += `<path d="M${x - 10} ${y - 2} L${x + 10} ${y - 1} L${x} ${y + 14}Z" fill="${cols[i % 5]}" stroke="#1b1d4d" stroke-width="2" stroke-linejoin="round"/>`;
  }
  g.innerHTML = s;
})();

// Logo burst: a hand-cut star with slightly irregular points.
(() => {
  const star = (R, r, n, jitter, seed) => {
    let d = ''; let s0 = seed;
    const rnd = () => { s0 = (s0 * 9301 + 49297) % 233280; return s0 / 233280; };
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const rr = (i % 2 ? r : R) * (1 + (rnd() - 0.5) * jitter);
      d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
    }
    return `${d}Z`;
  };
  $('#logo-burst-path').setAttribute('d', star(96, 66, 14, 0.14, 7));
  $('#logo-burst-inner').setAttribute('d', star(70, 52, 14, 0.1, 3));
  const burst = $('.logo-burst');
  onFrame((dt, t) => { if (S.screen === 'title' && !S.reduced) burst.style.setProperty('--spin', (t / 1000 * 10 * (0.3 + S.motion)) % 360); });
})();

const saved = store.settings();
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
setCount(params.has('count') ? Number(params.get('count')) : saved.count, { persist: false });
setMotion(saved.motion ?? (prefersReduced ? 0 : 1), { persist: false });
setMuted(!saved.sound, { persist: false });
setVolume(saved.volume, { persist: false });
applyLook(titleLook());
renderCalendar();
refreshTitle();
checkLoginBonus();
applyLevel(0.02);
startClock();
document.fonts.ready.then(layoutActors);
layoutActors();
Object.assign(window.__dopa, { hanamaru, applyLook, fx, fxBack, bg, hero, actors, crowd, press, startGame, startExtra, fmtDopa, store, progress, stats, quests, trophyState, checkTrophies });
