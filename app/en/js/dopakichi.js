// Dopakichi: a rubber-hose mascot drawn as layered SVG in screen space.
// Shapes follow docs/dopakichi.svg, converted to unit space (feet at y=0).
// Body parts are springs; actions are cancellable async routines.
import { Spring, tween, wait, lerp, clamp, rand, pick, quadPoint, easeOutQuad, easeInQuad, easeOutBack, easeInOutCubic, easeOutCubic, onFrame } from './core.js';

const NS = 'http://www.w3.org/2000/svg';
export const INK = '#000';
const CREAM = '#fff3e4';
export const PALETTES = {
  pink: { body: '#ff97bf', inner: '#ffe6f0', leg: '#2f79f7', cheek: '#ffe6f0' },
  blue: { body: '#6fa0ff', inner: '#dde8ff', leg: '#ff97bf', cheek: '#ffd6e6' },
  yellow: { body: '#ffd452', inner: '#fff3c4', leg: '#2f79f7', cheek: '#ffd9c2' },
  mint: { body: '#5eddb8', inner: '#d6f8ec', leg: '#7b5cff', cheek: '#ffd6e6' },
  violet: { body: '#b793ff', inner: '#ede3ff', leg: '#ff97bf', cheek: '#ffd6e6' },
  // Unlockable colours for the hero (id041, id044).
  gold: { body: '#ffc53d', inner: '#fff1b8', leg: '#ff7ab6', cheek: '#ffd9c2' },
  snow: { body: '#f4f6ff', inner: '#dde4ff', leg: '#3b6bff', cheek: '#ffd6e6' },
  rainbow: { body: 'url(#dk-rainbow)', inner: '#fff4f9', leg: '#2f79f7', cheek: '#ffe6f0', flat: '#ff97bf' },
};

// Costumes drawn over the original shape (docs/dopakichi.svg is never changed).
// head: moves with the head; back: behind the body (capes).
export const COSTUMES = {
  cap: { head: `<path class="dk-l" d="M-44 -133 C-44 -166 44 -166 44 -133 Z" fill="#3b6bff"/><path class="dk-l" d="M-6 -133 C10 -140 52 -142 60 -132 C52 -126 20 -126 -6 -133Z" fill="#2a4fd6"/><circle class="dk-l" cx="0" cy="-160" r="5" fill="#ffd23f"/><path d="M-30 -147 Q0 -158 30 -147" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>` },
  hachimaki: { head: `<path class="dk-l" d="M-55 -128 Q0 -142 55 -128 L55 -116 Q0 -130 -55 -116Z" fill="#fff"/><circle cx="0" cy="-129" r="6" fill="#ff4f6d"/><path class="dk-l" d="M50 -124 Q70 -132 82 -122 Q70 -118 56 -120Z M52 -120 Q66 -110 74 -98 Q62 -104 52 -114Z" fill="#fff"/>` },
  cape: { back: `<path class="dk-l" d="M-30 -58 C-60 -30 -64 -10 -58 4 L58 4 C64 -10 60 -30 30 -58 Z" fill="#ff4f6d"/><path d="M-50 -2 L50 -2" stroke="#ffd23f" stroke-width="5"/>`, head: `<path class="dk-l" d="M-24 -66 Q0 -58 24 -66 L20 -58 Q0 -52 -20 -58Z" fill="#ff4f6d"/><circle class="dk-l" cx="0" cy="-59" r="4.5" fill="#ffd23f"/>` },
  crown: { head: `<path class="dk-l" d="M-32 -140 L-36 -176 L-18 -156 L0 -184 L18 -156 L36 -176 L32 -140 Z" fill="#ffd23f"/><circle class="dk-l" cx="0" cy="-160" r="5" fill="#ff4f6d"/><circle class="dk-l" cx="-22" cy="-150" r="3.5" fill="#3b6bff"/><circle class="dk-l" cx="22" cy="-150" r="3.5" fill="#3fdcb0"/>` },
  glasses: { face: `<g class="dk-l" fill="rgba(255,255,255,.25)"><circle cx="-23.4" cy="-93.8" r="15"/><circle cx="23.4" cy="-93.8" r="15"/></g><path class="dk-l" d="M-8.4 -95 Q0 -100 8.4 -95 M-38 -97 L-48 -101 M38 -97 L48 -101" fill="none"/>` },
  ribbon: { head: `<path class="dk-l" d="M0 -150 C-14 -176 -46 -170 -36 -150 C-30 -140 -12 -142 0 -150Z M0 -150 C14 -176 46 -170 36 -150 C30 -140 12 -142 0 -150Z" fill="#ff5a9c"/><circle class="dk-l" cx="0" cy="-151" r="7" fill="#ff7ab6"/><path d="M-28 -160 Q-20 -156 -14 -152 M28 -160 Q20 -156 14 -152" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>` },
  headphones: { head: `<path class="dk-l" d="M-60 -110 C-60 -178 60 -178 60 -110" fill="none" stroke-width="7" stroke="#1b1d4d"/><path d="M-60 -110 C-60 -178 60 -178 60 -110" fill="none" stroke="#a77bff" stroke-width="5"/><rect class="dk-l" x="-68" y="-122" width="16" height="30" rx="7" fill="#a77bff"/><rect class="dk-l" x="52" y="-122" width="16" height="30" rx="7" fill="#a77bff"/>` },
  wizard: { head: `<path class="dk-l" d="M-52 -138 Q0 -152 52 -138 Q0 -128 -52 -138Z" fill="#5b3fd6"/><path class="dk-l" d="M-34 -141 C-20 -170 -4 -208 22 -222 C14 -200 26 -170 34 -141 Z" fill="#6f52ff"/><path class="dk-l" d="M-4 -182 L-1 -175 L6 -175 L0 -170 L3 -163 L-4 -167 L-10 -163 L-8 -170 L-14 -175 L-6 -175Z" fill="#ffd23f"/><circle class="dk-l" cx="22" cy="-222" r="5" fill="#ffd23f"/>` },
};

const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

// Outlines use the class "dk-l" (stroke width from --dkw); expression
// strokes use "dk-f", slightly heavier so faces stay readable when small.
const L = 'class="dk-l"';
const F = 'class="dk-f"';
// Eye rings use a thinner line so the white ring stays visible, as in the drawing.
const T = 'class="dk-t"';
const EYE = {
  open: (p) => `<circle r="11.2" fill="#fff" ${T}/><circle class="dk-t dk-iris" r="8.6" fill="${p.body}"/>`,
  wide: (p) => `<circle r="12.4" fill="#fff" ${T}/><circle class="dk-t dk-iris" r="5" fill="${p.body}"/>`,
  happy: () => `<path d="M-9 3 Q0 -10 9 3" fill="none" ${F}/>`,
  closed: () => `<path d="M-9 -1 Q0 7 9 -1" fill="none" ${F}/>`,
  x: () => `<path d="M-7 -7 L7 7 M7 -7 L-7 7" fill="none" ${F}/>`,
  swirl: () => `<path d="M0 0 m0 -1.3 a1.3 1.3 0 1 1 -1.3 1.3 a3.4 3.4 0 1 1 3.4 3.4 a5.7 5.7 0 1 1 -5.7 -5.7 a8.3 8.3 0 1 1 8.3 8.3" fill="none" ${L}/>`,
  star: () => `<path d="M0 -12 L3.5 -3.8 L12 -3.6 L5.3 1.9 L7.6 10.3 L0 5.5 L-7.6 10.3 L-5.3 1.9 L-12 -3.6 L-3.5 -3.8Z" fill="#ffd23f" ${L}/>`,
  heart: () => `<path d="M0 9.6 C-14.4 -1.2 -10.8 -13.2 -4.3 -11.4 C-1.9 -10.8 0 -8.4 0 -6.5 C0 -8.4 1.9 -10.8 4.3 -11.4 C10.8 -13.2 14.4 -1.2 0 9.6Z" fill="#ff2d7a" ${L}/>`,
  tight: () => `<path d="M-8 -5 L6 0 L-8 5" fill="none" ${F}/>`,
};
// Brow pose per eye expression: lift (up) and tilt (degrees, inner ends up when > 0).
const BROW = { happy: [1, 0], star: [1.2, 0], heart: [1, 0], wide: [1.6, 0], x: [0.4, 18], swirl: [0.2, 14], tight: [0, -16], closed: [0, 8] };
const MOUTH = {
  smile: `<path d="M-8.1 -1.3 C-4.9 3 4.9 3 8.1 -1.3" fill="none" ${L}/>`,
  cat: `<path d="M-9 -1 Q-4.5 5 0 0 Q4.5 5 9 -1" fill="none" ${L}/>`,
  grin: `<path d="M-10 -3 Q0 -1 10 -3 Q9 12 0 12 Q-9 12 -10 -3Z" fill="#7a1840" ${L}/><path d="M-5 8 Q0 4 5 8 Q3 11.5 0 11.6 Q-3 11.5 -5 8Z" fill="#ff7aa8"/>`,
  o: `<ellipse rx="4.6" ry="5.8" fill="#7a1840" ${L}/>`,
  big: `<ellipse rx="9" ry="11" fill="#7a1840" ${L}/><ellipse cy="5" rx="5.5" ry="4" fill="#ff7aa8"/>`,
  wobble: `<path d="M-10 1 L-6 -3 L-2 2 L2 -3 L6 2 L10 -2" fill="none" ${L}/>`,
  flat: `<path d="M-6 0 L6 0" fill="none" ${L}/>`,
  puff: `<path d="M-3 0 L3 0" fill="none" ${L}/>`,
};

// Shape constants (unit space, feet at y=0), from docs/dopakichi.svg scaled by 0.18.
export const G = {
  foot: 'M-19.3 -18.5 C-24.8 -18.5 -28.1 -16 -32.8 -11.3 C-36.7 -7.4 -38.9 -4.9 -35.8 -2.3 C-31.5 1.4 -24.1 1.1 -18.2 -2 C-12.1 -4.9 -8.5 -9.2 -12.1 -14.8 C-13.9 -17.6 -16.2 -18.5 -19.3 -18.5Z',
  footPivot: { x: 18.5, y: -15.8 },
  // Body fill reaches up under the head; the neck has no drawn seam.
  bodyFill: 'M-37.4 -65.7 C-29.7 -61 -25.2 -54.2 -25.2 -46.8 C-25.2 -40.5 -28.8 -35.3 -28.8 -28.4 C-28.8 -18.4 -20.7 -13.5 -10.8 -13.5 L10.8 -13.5 C20.7 -13.5 28.8 -18.4 28.8 -28.4 C28.8 -35.3 25.2 -40.5 25.2 -46.8 C25.2 -54.2 29.7 -61 37.4 -65.7 L37.4 -75.2 L-37.4 -75.2Z',
  bodyLine: 'M-37.4 -65.7 C-29.7 -61 -25.2 -54.2 -25.2 -46.8 C-25.2 -40.5 -28.8 -35.3 -28.8 -28.4 C-28.8 -18.4 -20.7 -13.5 -10.8 -13.5 L10.8 -13.5 C20.7 -13.5 28.8 -18.4 28.8 -28.4 C28.8 -35.3 25.2 -40.5 25.2 -46.8 C25.2 -54.2 29.7 -61 37.4 -65.7',
  belly: { cy: -32, rx: 17.8, ry: 13.5 },
  headFill: 'M-37.4 -65.7 C-49.7 -73.1 -56.3 -82.1 -56.3 -98.5 C-56.3 -129.6 -32.9 -149.2 0 -149.2 C32.9 -149.2 56.3 -129.6 56.3 -98.5 C56.3 -82.1 49.7 -73.1 37.4 -65.7 L0 -70.2Z',
  headLine: 'M-37.4 -65.7 C-49.7 -73.1 -56.3 -82.1 -56.3 -98.5 C-56.3 -129.6 -32.9 -149.2 0 -149.2 C32.9 -149.2 56.3 -129.6 56.3 -98.5 C56.3 -82.1 49.7 -73.1 37.4 -65.7',
  face: 'M0 -133 C29.7 -133 48.2 -121.7 48.2 -96.5 C48.2 -71.3 25.7 -61.2 0 -61.2 C-25.7 -61.2 -48.2 -71.3 -48.2 -96.5 C-48.2 -121.7 -29.7 -133 0 -133Z',
  head: { cy: -100, r: 56 },
  neckY: -65.7,
  ear: { x: 74.2, cy: -105.3, rx: 31, ry: 31.3, irx: 21.1, iry: 22, pivot: 52.6 },
  eye: { x: 23.4, y: -93.8 },
  brow: { x: 13.5, y: -111.2, rx: 3.1, ry: 1.8 },
  mouthY: -79,
  cheek: { x: 30.6, y: -78.5, rx: 4.3, ry: 2.7 },
  shoulder: { x: 25.7, y: -48 },
  rest: { x: 37.8, y: -34.7 },
  arm: 4.6,
  hand: 9.7,
};

// Outline width in unit space: thin like the drawing, with a pixel floor.
const lineFor = (S) => clamp(1.7 / S, 1.4, 3.2);

// Static parts shared by the live actor and the sprite image.
const earSVG = (p, s) => `<ellipse ${L} cx="${s * G.ear.x}" cy="${G.ear.cy}" rx="${G.ear.rx}" ry="${G.ear.ry}" fill="${p.body}"/><ellipse ${L} cx="${s * G.ear.x}" cy="${G.ear.cy}" rx="${G.ear.irx}" ry="${G.ear.iry}" fill="${p.inner}"/>`;
const footSVG = (p, s) => `<path ${L} d="${G.foot}" fill="${p.leg}"${s > 0 ? ' transform="scale(-1 1)"' : ''}/>`;
const bodySVG = (p) => `<path d="${G.bodyFill}" fill="${p.body}"/><path ${L} d="${G.bodyLine}" fill="none"/><ellipse ${L} cy="${G.belly.cy}" rx="${G.belly.rx}" ry="${G.belly.ry}" fill="${CREAM}"/>`;
const headSVG = (p) => `<path d="${G.headFill}" fill="${p.body}"/><path ${L} d="${G.headLine}" fill="none"/><path ${L} d="${G.face}" fill="${CREAM}"/>`;
const STYLE = `.dk-l,.dk-f,.dk-t{stroke:${INK};stroke-linecap:round;stroke-linejoin:round}.dk-l{stroke-width:var(--dkw)}.dk-f{stroke-width:calc(var(--dkw) * 1.5)}.dk-t{stroke-width:calc(var(--dkw) * 0.55)}`;

let uid = 0;

export class Dopakichi {
  constructor(layer, { scale = 0.7, palette = 'pink', front } = {}) {
    this.layer = layer;
    this.S = scale;
    this.lw = lineFor(scale);
    this.pal = PALETTES[palette];
    this.id = uid++;
    this.x = 0; this.y = 0;
    this.home = { x: 0, y: 0 };
    this.ground = null;
    this.rot = 0;
    this.lift = 0;
    this.sq = new Spring(1, 260, 11);
    this.lean = new Spring(0, 120, 12);
    this.tilt = new Spring(0, 160, 10);
    this.earL = new Spring(0, 180, 7);
    this.earR = new Spring(0, 180, 7);
    this.stretchX = 1; this.stretchY = 1;
    this.look = { x: 0, y: 0 }; this.lookTarget = { x: 0, y: 0 };
    this.eyes = null; this.mouth = null;
    this.baseEyes = 'open'; this.baseMouth = 'smile';
    this.blinkAt = performance.now() + 1800; this.blinkK = 0;
    this.browLift = new Spring(0, 220, 14);
    this.browTilt = new Spring(0, 220, 14);
    this.cheekPuff = 0;
    this.visible = true;
    this.opacity = 1;
    this.bob = 0;
    this.shake = 0;
    this.hands = [this.makeHand(-1), this.makeHand(1)];
    this.token = 0;
    this.busy = false;
    this.build(front);
  }

  makeHand(side) { return { side, mode: 'rest', x: 0, y: 0, job: 0, carry: null, raise: 0 }; }

  build(front) {
    const p = this.pal;
    this.front = front;
    this.root = el('g', { class: 'dk' }, this.layer);
    this.root.style.setProperty('--dkw', this.lw);
    this.shadow = el('ellipse', { rx: 40, ry: 7, fill: INK, opacity: 0.14 }, this.root);
    this.bodyG = el('g', {}, this.root);
    this.backG = el('g', {}, this.bodyG);
    this.feet = [-1, 1].map((s) => { const g = el('g', {}, this.bodyG); g.innerHTML = footSVG(p, s); return g; });
    el('g', {}, this.bodyG).innerHTML = bodySVG(p);
    this.headG = el('g', {}, this.bodyG);
    this.earGs = [-1, 1].map((s) => { const g = el('g', {}, this.headG); g.innerHTML = earSVG(p, s); return { g, s }; });
    el('g', {}, this.headG).innerHTML = headSVG(p);
    this.face = el('g', {}, this.headG);
    this.cheeks = [-1, 1].map((s) => el('ellipse', { cx: s * G.cheek.x, cy: G.cheek.y, rx: G.cheek.rx, ry: G.cheek.ry, fill: p.cheek }, this.face));
    this.brows = [-1, 1].map(() => el('ellipse', { class: 'dk-l', rx: G.brow.rx, ry: G.brow.ry, fill: p.body }, this.face));
    this.eyeGs = [-1, 1].map(() => el('g', {}, this.face));
    this.irises = [];
    this.mouthG = el('g', { transform: `translate(0 ${G.mouthY})` }, this.face);
    this.sweat = el('path', { d: 'M0 -12 Q6 -2 0 2 Q-6 -2 0 -12Z', fill: '#8fd3ff', class: 'dk-l', opacity: 0 }, this.face);
    this.faceWear = el('g', {}, this.headG);
    this.headWear = el('g', {}, this.headG);
    this.armsFront = el('g', { class: 'dk-arms' }, front || this.root);
    // A gradient body colour cannot paint a thin stroke well; arms use a flat colour.
    const armCol = p.flat || p.body;
    this.arms = this.hands.map(() => ({
      out: el('path', { fill: 'none', stroke: INK, 'stroke-linecap': 'round' }, this.armsFront),
      inn: el('path', { fill: 'none', stroke: armCol, 'stroke-linecap': 'round' }, this.armsFront),
      hand: el('circle', { fill: armCol, stroke: INK }, this.armsFront),
      digit: el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'dk-digit' }, this.armsFront),
    }));
    const svg = this.layer.ownerSVGElement || this.layer;
    if (!document.getElementById('dk-style')) el('style', { id: 'dk-style' }, svg).textContent = STYLE;
    if (!document.getElementById('dk-rainbow')) {
      const defs = el('defs', {}, svg);
      defs.innerHTML = '<linearGradient id="dk-rainbow" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff97bf"/><stop offset=".33" stop-color="#ffd452"/><stop offset=".66" stop-color="#5eddb8"/><stop offset="1" stop-color="#8fb4ff"/></linearGradient>';
    }
    this.eyes = null; this.mouth = null;
    this.setFace(this.baseEyes || 'open', this.baseMouth || 'smile', true);
    this.setCostume(this.costume || null);
  }

  // Unlockable look (id041, id044): recolour by rebuilding; costumes are layered.
  setPalette(name) {
    const pal = PALETTES[name] || PALETTES.pink;
    if (pal === this.pal) return;
    this.pal = pal;
    const vis = this.visible;
    this.root.remove(); this.armsFront.remove();
    this.build(this.front);
    this.visible = vis;
  }
  setCostume(id) {
    this.costume = id && COSTUMES[id] ? id : null;
    const c = this.costume ? COSTUMES[this.costume] : {};
    this.headWear.innerHTML = c.head || '';
    this.faceWear.innerHTML = c.face || '';
    this.backG.innerHTML = c.back || '';
  }

  setFace(eyes, mouth, base = false) {
    if (eyes && eyes !== this.eyes) {
      this.eyes = eyes;
      this.eyeGs.forEach((g, i) => {
        const kind = eyes === 'wink' ? (i ? 'happy' : 'open') : eyes;
        // The right eye mirrors so pointed shapes face each other.
        g.innerHTML = `<g transform="scale(${i && kind === 'tight' ? -1 : 1} 1)">${EYE[kind](this.pal)}</g>`;
      });
      this.irises = this.eyeGs.map((g) => g.querySelector('.dk-iris'));
      const [lift, tilt] = BROW[eyes === 'wink' ? 'happy' : eyes] || [0, 0];
      this.browLift.target = lift; this.browTilt.target = tilt;
    }
    if (mouth && mouth !== this.mouth) { this.mouth = mouth; this.mouthG.innerHTML = MOUTH[mouth]; }
    if (base) { this.baseEyes = eyes || this.baseEyes; this.baseMouth = mouth || this.baseMouth; }
  }
  resetFace() { this.setFace(this.baseEyes, this.baseMouth); this.cheekPuff = 0; this.sweat.setAttribute('opacity', 0); }

  // Local (unit) coordinates -> screen.
  toScreen(lx, ly) {
    const S = this.S;
    const sy = this.sq.value * this.stretchY;
    const sx = this.stretchX / Math.sqrt(Math.max(0.2, this.sq.value));
    const pc = 60 * S;
    const px = lx * S * sx; const py = ly * S * sy + pc;
    const a = ((this.rot + this.lean.value) * Math.PI) / 180;
    const c = Math.cos(a); const s = Math.sin(a);
    return { x: this.x + px * c - py * s, y: this.y - this.lift + px * s + py * c - pc };
  }
  shoulder(side) { return this.toScreen(side * G.shoulder.x, G.shoulder.y); }
  // Raised hands go up past the ears, clear of the face.
  restHand(side, h) { return this.toScreen(side * (G.rest.x + h.raise * 34), G.rest.y - h.raise * 120); }
  get headCenter() { return this.toScreen(0, G.head.cy); }

  place(x, y) { this.x = x; this.y = y; this.home = { x, y }; this.ground = y; }

  update(dt, t, ctx = {}) {
    this.sq.step(dt); this.lean.step(dt); this.tilt.step(dt); this.earL.step(dt); this.earR.step(dt);
    this.browLift.step(dt); this.browTilt.step(dt);
    this.look.x = lerp(this.look.x, this.lookTarget.x, Math.min(1, dt * 10));
    this.look.y = lerp(this.look.y, this.lookTarget.y, Math.min(1, dt * 10));
    // blink
    if (t > this.blinkAt) { this.blinkK = 1; this.blinkAt = t + rand(1800, 4200); }
    this.blinkK = Math.max(0, this.blinkK - dt * 7);
    const blink = this.eyes === 'open' ? 1 - Math.sin(this.blinkK * Math.PI) * 0.92 : 1;

    const breath = Math.sin(t / 520 + this.id) * 0.018;
    const beat = ctx.beat || 0;
    const sy = (this.sq.value + breath + this.bob * beat * 0.06) * this.stretchY;
    const sx = this.stretchX / Math.sqrt(Math.max(0.2, this.sq.value + breath));
    const S = this.S;
    const pc = 60 * S;
    const shakeX = this.shake ? Math.sin(t / 22) * this.shake : 0;
    const bx = this.x + shakeX; const by = this.y - this.lift;
    const rot = this.rot + this.lean.value;
    this.root.setAttribute('opacity', this.opacity);
    // Arms live in a separate front layer, so hide them together with the body.
    this.root.style.display = this.visible ? '' : 'none';
    this.armsFront.style.display = this.visible ? '' : 'none';
    this.armsFront.setAttribute('opacity', this.opacity);
    this.bodyG.setAttribute('transform', `translate(${bx} ${by - pc}) rotate(${rot}) translate(0 ${pc}) scale(${S * sx} ${S * sy})`);
    const gy = this.ground ?? this.y;
    const hk = clamp(1 - (gy - by) / 400, 0.2, 1);
    this.shadow.setAttribute('transform', `translate(${bx} ${gy + 2}) scale(${S * hk * sx} ${S * hk})`);
    this.headG.setAttribute('transform', `rotate(${this.tilt.value} 0 ${G.neckY})`);
    this.earGs.forEach(({ g, s }) => {
      const a = (s < 0 ? -this.earL.value : this.earR.value);
      g.setAttribute('transform', `rotate(${a} ${s * G.ear.pivot} ${G.ear.cy})`);
    });
    const lx = this.look.x * 1.6; const ly = this.look.y * 1.4;
    this.eyeGs.forEach((g, i) => {
      const s = i ? 1 : -1;
      g.setAttribute('transform', `translate(${s * G.eye.x + lx} ${G.eye.y + ly}) scale(1 ${blink})`);
    });
    // Irises roll inside the white ring toward the look target.
    this.irises.forEach((ir) => { if (ir) ir.setAttribute('transform', `translate(${this.look.x * 2.2} ${this.look.y * 2})`); });
    this.brows.forEach((b, i) => {
      const s = i ? 1 : -1;
      b.setAttribute('transform', `translate(${s * G.brow.x + lx} ${G.brow.y + ly - this.browLift.value * 4}) rotate(${-s * this.browTilt.value})`);
    });
    this.mouthG.setAttribute('transform', `translate(${lx * 0.6} ${G.mouthY + ly * 0.5})`);
    this.cheeks.forEach((c, i) => {
      const k = 1 + this.cheekPuff * 0.7;
      c.setAttribute('rx', G.cheek.rx * k); c.setAttribute('ry', G.cheek.ry * k);
      c.setAttribute('cx', (i ? 1 : -1) * (G.cheek.x + this.cheekPuff * 3) + lx * 0.4);
    });
    this.feet.forEach((f, i) => {
      const s = i ? 1 : -1;
      const kick = this.lift > 4 ? Math.sin(t / 60 + i * 2) * 4 : 0;
      f.setAttribute('transform', `translate(0 ${kick}) rotate(${this.lift > 4 ? s * 14 : 0} ${s * G.footPivot.x} ${G.footPivot.y})`);
    });

    // arms
    const lpx = this.lw * S;
    this.hands.forEach((h, i) => {
      const sh = this.shoulder(h.side);
      if (h.mode === 'rest') {
        const r = this.restHand(h.side, h);
        const sway = Math.sin(t / 400 + i * 1.3) * 1.5 * S;
        h.x = r.x + sway; h.y = r.y;
      }
      const a = this.arms[i];
      const dx = h.x - sh.x; const dy = h.y - sh.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len; const ny = dx / len;
      const bend = h.mode === 'rest' ? 0 : h.side * Math.min(60, len * 0.22);
      // Resting arms hang down in a short curve, like the drawing.
      const droop = h.mode === 'rest' ? len * 0.35 : Math.min(40, len * 0.08);
      const c = { x: (sh.x + h.x) / 2 + nx * bend, y: (sh.y + h.y) / 2 + ny * bend + droop };
      const d = `M${sh.x} ${sh.y} Q${c.x} ${c.y} ${h.x} ${h.y}`;
      const w = Math.max(3, G.arm * S * Math.min(1, Math.sqrt(40 * S / len)));
      a.out.setAttribute('d', d); a.out.setAttribute('stroke-width', w + 2 * lpx);
      a.inn.setAttribute('d', d); a.inn.setAttribute('stroke-width', w);
      a.hand.setAttribute('cx', h.x); a.hand.setAttribute('cy', h.y);
      a.hand.setAttribute('r', G.hand * S); a.hand.setAttribute('stroke-width', lpx);
      if (h.carry != null) {
        a.digit.textContent = h.carry;
        a.digit.setAttribute('x', h.x); a.digit.setAttribute('y', h.y - 20 * S - 10);
        a.digit.setAttribute('font-size', Math.max(26, 40 * S));
        a.digit.style.display = '';
      } else a.digit.style.display = 'none';
    });
  }

  lookAt(pt) {
    if (!pt) { this.lookTarget = { x: 0, y: 0 }; return; }
    const hc = this.headCenter;
    const dx = pt.x - hc.x; const dy = pt.y - hc.y;
    const d = Math.hypot(dx, dy) || 1;
    this.lookTarget = { x: dx / d, y: dy / d };
  }

  // ---------------------------------------------------------------- hands
  freeHand(pt) {
    const h = this.hands.slice().sort((a, b) => (a.job ? 1 : 0) - (b.job ? 1 : 0) || Math.abs((pt.x - this.x) - a.side * 60) - Math.abs((pt.x - this.x) - b.side * 60))[0];
    return h;
  }

  // Grab a digit from a key and put it into a cell.
  async carry(from, to, digit, { E = 0, onGrab, onPlace } = {}) {
    const h = this.freeHand(from);
    if (h.job && h.cancel) h.cancel();
    const job = ++uid;
    let placed = false;
    const finish = () => { if (!placed) { placed = true; h.carry = null; onPlace && onPlace(); } };
    h.job = job; h.cancel = finish;
    const alive = () => h.job === job;
    h.mode = 'free';
    const s0 = { x: h.x, y: h.y };
    this.lookAt(from);
    this.lean.target = clamp((from.x - this.x) / 20, -12, 12);
    const reach = 80 + 40 * (1 - E);
    await tween(reach, (k) => { h.x = lerp(s0.x, from.x, k); h.y = lerp(s0.y, from.y, k); }, easeOutQuad);
    if (!alive()) return;
    h.carry = digit; onGrab && onGrab();
    this.lookAt(to);
    const c = { x: (from.x + to.x) / 2 + (this.x - (from.x + to.x) / 2) * 0.2, y: Math.min(from.y, to.y) - 60 - 40 * E };
    await tween(150 + 40 * (1 - E), (k) => { const q = quadPoint(from, c, to, k); if (alive()) { h.x = q.x; h.y = q.y; } }, easeInOutCubic);
    if (!alive()) return;
    finish();
    const r = this.restHand(h.side, h);
    const p0 = { x: h.x, y: h.y };
    await tween(150, (k) => { if (alive()) { const rr = this.restHand(h.side, h); h.x = lerp(p0.x, rr.x, k); h.y = lerp(p0.y, rr.y, k); } }, easeOutCubic);
    if (alive()) { h.mode = 'rest'; h.job = 0; h.cancel = null; this.lean.target = 0; }
    void r;
  }

  // Swipe a wrong digit away (Backspace).
  async swipe(pt) {
    const h = this.freeHand(pt);
    if (h.job && h.cancel) h.cancel();
    const job = ++uid; h.job = job; h.mode = 'free';
    const alive = () => h.job === job;
    const s0 = { x: h.x, y: h.y };
    await tween(90, (k) => { h.x = lerp(s0.x, pt.x - 30, k); h.y = lerp(s0.y, pt.y, k); });
    await tween(120, (k) => { if (alive()) { h.x = pt.x - 30 + 60 * k; h.y = pt.y - Math.sin(k * Math.PI) * 10; } });
    const p0 = { x: h.x, y: h.y };
    await tween(140, (k) => { if (alive()) { const r = this.restHand(h.side, h); h.x = lerp(p0.x, r.x, k); h.y = lerp(p0.y, r.y, k); } });
    if (alive()) { h.mode = 'rest'; h.job = 0; }
  }

  // ---------------------------------------------------------------- body actions
  begin() { this.token += 1; const tk = this.token; return () => tk === this.token; }

  async hop(height = 30, dur = 360, { spin = 0, flip = 0, to = null, audio } = {}) {
    const ok = this.begin();
    this.sq.value = 0.82; this.sq.velocity = 0;
    await wait(55);
    if (!ok()) return false;
    audio && audio.jump(height / 120);
    this.sq.value = 1.18;
    const x0 = this.x; const y0 = this.y; const tx = to ? to.x : x0; const ty = to ? to.y : y0;
    const r0 = this.rot;
    await tween(dur, (k) => {
      if (!ok()) return;
      this.x = lerp(x0, tx, k); this.y = lerp(y0, ty, k);
      this.lift = Math.sin(k * Math.PI) * height;
      this.rot = r0 + spin * easeInOutCubic(k) + flip * k;
    }, (k) => k);
    if (!ok()) return false;
    this.lift = 0; this.rot = 0;
    this.sq.value = 0.72; this.sq.velocity = 2;
    this.earL.kick(-420); this.earR.kick(-420);
    audio && audio.land();
    return true;
  }

  async clap(times = 3, audio) {
    const ok = this.begin();
    const hs = this.hands;
    hs.forEach((h) => { h.mode = 'free'; });
    for (let i = 0; i < times && ok(); i++) {
      const c = this.toScreen(0, -178);
      const o = [this.toScreen(-80, -164), this.toScreen(80, -164)];
      await tween(70, (k) => hs.forEach((h, j) => { if (ok() && !h.job) { h.x = lerp(o[j].x, c.x + (j ? 8 : -8), k); h.y = lerp(o[j].y, c.y, k); } }), easeInQuad);
      if (!ok()) return;
      audio && audio.clapHands();
      if (this.S < 1.5) this.sq.kick(-1.2);
      await tween(90, (k) => hs.forEach((h, j) => { if (ok() && !h.job) { h.x = lerp(c.x + (j ? 8 : -8), o[j].x, k); h.y = lerp(c.y, o[j].y, k); } }), easeOutQuad);
    }
    if (ok()) hs.forEach((h) => { if (!h.job) h.mode = 'rest'; });
  }

  async celebrate(E, { big = false, audio, variant } = {}) {
    const moves = big
      ? ['backflip', 'spinjump', 'starjump', 'clapjump', 'twirl']
      : ['hop', 'hop', 'earflap', 'clapjump', 'twirl'];
    const move = variant || pick(moves.slice(0, Math.max(2, Math.ceil(moves.length * (0.35 + E)))));
    this.setFace(pick(['happy', 'happy', 'star', 'wink']), pick(['grin', 'big', 'cat']));
    this.earL.kick(600); this.earR.kick(600);
    const hMul = 0.6 + E * 1.6;
    if (move === 'hop') await this.hop(22 * hMul, 300, { audio });
    else if (move === 'earflap') { for (let i = 0; i < 3; i++) { this.earL.kick(900); this.earR.kick(-900); this.tilt.kick(i % 2 ? 200 : -200); await wait(110); } }
    else if (move === 'clapjump') { this.hands.forEach((h) => { h.raise = 1; }); this.hop(30 * hMul, 380, { audio }); await this.clap(2 + Math.round(E * 2), audio); this.hands.forEach((h) => { h.raise = 0; }); }
    else if (move === 'twirl') await this.hop(26 * hMul, 460, { spin: 360, audio });
    else if (move === 'backflip') await this.hop(70 * hMul, 620, { flip: -360, audio });
    else if (move === 'spinjump') await this.hop(60 * hMul, 560, { spin: 720, audio });
    else if (move === 'starjump') {
      this.hands.forEach((h) => { h.raise = 1; });
      this.stretchX = 1.2;
      await this.hop(50 * hMul, 520, { audio });
      this.stretchX = 1;
      this.hands.forEach((h) => { h.raise = 0; });
    }
    await wait(250);
    this.resetFace();
  }

  // Comic, non-punishing reactions to a wrong digit. Gentle ones are used
  // early; bigger slapstick unlocks as the show intensifies. The same
  // reaction is not repeated twice in a row.
  async hurt(E, from, { audio, variant } = {}) {
    const ok = this.begin();
    const pool = ['squash', 'boing', 'deflate', 'earspin'];
    if (E >= 0.3) pool.push('pancake', 'dizzy', 'flop', 'roll');
    if (E >= 0.6) pool.push('knockoff', 'headbutt');
    const choices = pool.filter((v) => v !== this.lastHurt);
    const move = variant || pick(choices);
    this.lastHurt = move;
    this.setFace(pick(['x', 'swirl']), pick(['wobble', 'o']));
    this.earL.kick(-1200); this.earR.kick(-1100);
    const dir = from && from.x > this.x ? -1 : 1;
    const x0 = this.x; const y0 = this.y;
    const restore = () => { this.stretchX = 1; this.stretchY = 1; this.rot = 0; this.lift = 0; this.shake = 0; };
    if (move === 'squash') {
      this.sq.value = 0.6; this.sq.velocity = 0;
      this.tilt.kick(dir * 500);
      await wait(420);
    } else if (move === 'boing') {
      // Springy accordion: squashes and bounces up and down.
      for (let i = 0; i < 3 && ok(); i++) {
        await tween(90, (k) => { if (ok()) this.stretchY = lerp(1, 0.55, k); }, easeOutQuad);
        audio && audio.jump(0.3 + i * 0.1);
        await tween(140, (k) => { if (ok()) { this.stretchY = lerp(0.55, 1.35 - i * 0.1, k); this.lift = Math.sin(k * Math.PI) * (30 - i * 8); } }, easeOutQuad);
      }
      this.lift = 0;
      await tween(160, (k) => { if (ok()) this.stretchY = lerp(1.15, 1, k); }, easeOutBack);
    } else if (move === 'deflate') {
      // Shrinks like a balloon losing air, then pops back.
      await tween(360, (k) => { if (ok()) { this.stretchX = lerp(1, 0.55, k); this.stretchY = lerp(1, 0.5, k); this.shake = 2 * (1 - k); } }, easeOutQuad);
      this.shake = 0;
      await wait(160);
      audio && audio.jump(0.8);
      await tween(280, (k) => { if (ok()) { this.stretchX = lerp(0.55, 1, k); this.stretchY = lerp(0.5, 1, k); } }, easeOutBack);
    } else if (move === 'earspin') {
      // Ears whirl like propellers and lift the body a little.
      for (let i = 0; i < 8 && ok(); i++) { this.earL.kick(1400); this.earR.kick(-1400); this.tilt.kick(i % 2 ? 260 : -260); this.lift = Math.sin((i / 8) * Math.PI) * 26; await wait(60); }
      this.lift = 0;
      this.sq.value = 0.75;
    } else if (move === 'pancake') {
      await tween(90, (k) => { if (ok()) { this.stretchY = lerp(1, 0.32, k); this.stretchX = lerp(1, 1.7, k); } });
      this.shake = 3;
      await wait(380);
      this.shake = 0;
      await tween(260, (k) => { if (ok()) { this.stretchY = lerp(0.32, 1, k); this.stretchX = lerp(1.7, 1, k); } }, easeOutBack);
    } else if (move === 'dizzy') {
      // Plops down, head wobbles in circles, then hops back up.
      this.setFace('swirl', 'wobble');
      await tween(140, (k) => { if (ok()) { this.stretchY = lerp(1, 0.7, k); this.stretchX = lerp(1, 1.18, k); } }, easeOutQuad);
      await tween(640, (k) => { if (ok()) { this.tilt.target = Math.sin(k * Math.PI * 4) * 14; this.lean.target = Math.cos(k * Math.PI * 4) * 6; } });
      this.tilt.target = 0; this.lean.target = 0;
      await tween(200, (k) => { if (ok()) { this.stretchY = lerp(0.7, 1, k); this.stretchX = lerp(1.18, 1, k); } }, easeOutBack);
    } else if (move === 'flop') {
      // Falls over backwards, legs kick in the air, springs upright.
      await tween(180, (k) => { if (ok()) { this.rot = dir * -90 * k; this.lift = Math.sin(k * Math.PI) * 18; } }, easeOutQuad);
      audio && audio.land();
      await tween(420, (k) => { if (ok()) this.rot = dir * (-90 + Math.sin(k * Math.PI * 5) * 6); });
      audio && audio.jump(0.6);
      await tween(240, (k) => { if (ok()) { this.rot = dir * -90 * (1 - k); this.lift = Math.sin(k * Math.PI) * 30; } }, easeOutBack);
    } else if (move === 'roll') {
      // Rolls away like a ball and rolls back.
      await tween(360, (k) => { if (ok()) { this.x = x0 + dir * 90 * k; this.rot = dir * 360 * k; this.stretchY = 0.85; } }, easeOutQuad);
      await tween(360, (k) => { if (ok()) { this.x = x0 + dir * 90 * (1 - k); this.rot = dir * 360 * (1 - k); } }, easeInOutCubic);
      this.x = x0;
    } else if (move === 'headbutt') {
      // Bops the wrong digit away with the head.
      await tween(110, (k) => { if (ok()) { this.lean.target = -dir * 18 * k; this.lift = k * 20; } });
      audio && audio.jump(1);
      this.sq.value = 1.25;
      await tween(180, (k) => { if (ok()) { this.lean.target = -dir * 18 * (1 - k); this.lift = 20 + Math.sin(k * Math.PI) * 40; } }, easeOutQuad);
      await tween(160, (k) => { if (ok()) this.lift = 20 * (1 - k); }, easeInQuad);
      this.lean.target = 0;
      this.sq.value = 0.7;
      audio && audio.land();
    } else {
      // Knocked off-stage, spins, and bounces back.
      audio && audio.jump(1.5);
      await tween(420, (k) => { if (ok()) { this.x = x0 + dir * 170 * k; this.lift = Math.sin(k * Math.PI) * 140; this.rot = dir * 540 * k; } }, (k) => k);
      this.rot = 0;
      await tween(360, (k) => { if (ok()) { this.x = lerp(x0 + dir * 170, x0, k); this.lift = Math.sin(k * Math.PI) * 60; } }, easeOutQuad);
      this.x = x0; this.y = y0;
      this.sq.value = 0.55;
      audio && audio.land();
    }
    restore();
    if (!ok()) return;
    // Shake it off.
    this.setFace('closed', 'flat');
    for (let i = 0; i < 4; i++) { this.tilt.kick(i % 2 ? 700 : -700); this.earL.kick(500); this.earR.kick(-500); await wait(70); }
    this.resetFace();
    this.setFace('open', 'smile');
  }

  // Point at a place on screen with one stretched arm (hint gesture).
  async point(pt, hold = 900, { staticPose = false } = {}) {
    const h = this.freeHand(pt);
    if (h.job && h.cancel) h.cancel();
    const job = ++uid; h.job = job; h.mode = 'free';
    const alive = () => h.job === job;
    this.lookAt(pt);
    this.setFace('open', 'o');
    const s0 = { x: h.x, y: h.y };
    const target = { x: lerp(this.x, pt.x, 0.82), y: lerp(this.y - 60 * this.S, pt.y, 0.82) };
    if (staticPose) {
      h.x = target.x; h.y = target.y;
      this.look = { ...this.lookTarget };
      return;
    }
    await tween(220, (k) => { if (alive()) { h.x = lerp(s0.x, target.x, k); h.y = lerp(s0.y, target.y, k); } }, easeOutBack);
    for (let i = 0; i < 3 && alive(); i++) {
      await tween(hold / 6, (k) => { if (alive()) { h.x = target.x + Math.sin(k * Math.PI) * 8; } });
      await tween(hold / 6, () => {});
    }
    const p0 = { x: h.x, y: h.y };
    await tween(200, (k) => { if (alive()) { const r = this.restHand(h.side, h); h.x = lerp(p0.x, r.x, k); h.y = lerp(p0.y, r.y, k); } });
    if (alive()) { h.mode = 'rest'; h.job = 0; this.resetFace(); }
  }

  async reachPose(on) {
    if (on) {
      this.begin();
      this.setFace('wide', 'puff');
      this.cheekPuff = 1;
      this.sweat.setAttribute('opacity', 1);
      this.sweat.setAttribute('transform', 'translate(46 -130)');
      this.shake = 1.4;
      this.hands.forEach((h) => { h.raise = 0.55; });
    } else {
      this.shake = 0;
      this.cheekPuff = 0;
      this.sweat.setAttribute('opacity', 0);
      this.hands.forEach((h) => { h.raise = 0; });
      this.resetFace();
    }
  }

  async leapTo(pt, height = 80, { audio, spin = 0 } = {}) {
    const landed = await this.hop(height, 480, { to: pt, audio, spin });
    if (landed) this.ground = pt.y;
    return landed;
  }

  destroy() { this.root.remove(); this.armsFront.remove(); }
}

// Standalone sprite image of Dopakichi for canvas particles (cheering pose).
export function dopakichiSprite(palette = 'pink', size = 128) {
  const p = PALETTES[palette];
  const { eye, cheek, shoulder, brow } = G;
  const tip = (s) => ({ x: s * 66, y: -150 });
  const arm = (s) => `M${s * shoulder.x} ${shoulder.y} Q${s * 62} ${shoulder.y - 20} ${tip(s).x} ${tip(s).y}`;
  const svg = `<svg xmlns="${NS}" viewBox="-110 -170 220 176" width="${size}" height="${size * 176 / 220}">
  <style>svg{--dkw:3.4}${STYLE}</style>
  ${footSVG(p, -1)}${footSVG(p, 1)}${bodySVG(p)}${earSVG(p, -1)}${earSVG(p, 1)}${headSVG(p)}
  ${[-1, 1].map((s) => `<ellipse cx="${s * cheek.x}" cy="${cheek.y}" rx="${cheek.rx}" ry="${cheek.ry}" fill="${p.cheek}"/><ellipse class="dk-l" cx="${s * brow.x}" cy="${brow.y - 4}" rx="${brow.rx}" ry="${brow.ry}" fill="${p.body}"/><g transform="translate(${s * eye.x} ${eye.y})">${EYE.happy()}</g>`).join('')}
  <g transform="translate(0 ${G.mouthY})">${MOUTH.grin}</g>
  ${[-1, 1].map((s) => `<path d="${arm(s)}" fill="none" stroke="${INK}" stroke-width="${G.arm + 6.8}" stroke-linecap="round"/><path d="${arm(s)}" fill="none" stroke="${p.body}" stroke-width="${G.arm}" stroke-linecap="round"/><circle class="dk-l" cx="${tip(s).x}" cy="${tip(s).y}" r="${G.hand}" fill="${p.body}"/>`).join('')}
  </svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img;
}

// Static SVG markup of Dopakichi with a colour and costume (collection thumbnails).
export function dopakichiSVG(palette = 'pink', costume = null) {
  const p = PALETTES[palette] || PALETTES.pink;
  const c = (costume && COSTUMES[costume]) || {};
  const { eye, cheek, brow } = G;
  const armCol = p.flat || p.body;
  const rb = p.body.startsWith('url(') ? '<defs><linearGradient id="dk-rainbow" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff97bf"/><stop offset=".33" stop-color="#ffd452"/><stop offset=".66" stop-color="#5eddb8"/><stop offset="1" stop-color="#8fb4ff"/></linearGradient></defs>' : '';
  return `<svg xmlns="${NS}" viewBox="-112 -232 224 240" aria-hidden="true">${rb}<style>svg{--dkw:3.4}${STYLE}</style>
  ${c.back || ''}${footSVG(p, -1)}${footSVG(p, 1)}${bodySVG(p)}${earSVG(p, -1)}${earSVG(p, 1)}${headSVG(p)}
  ${[-1, 1].map((s) => `<ellipse cx="${s * cheek.x}" cy="${cheek.y}" rx="${cheek.rx}" ry="${cheek.ry}" fill="${p.cheek}"/><ellipse class="dk-l" cx="${s * brow.x}" cy="${brow.y}" rx="${brow.rx}" ry="${brow.ry}" fill="${armCol}"/><g transform="translate(${s * eye.x} ${eye.y})">${EYE.open(p.body.startsWith('url(') ? { body: armCol } : p)}</g>`).join('')}
  <g transform="translate(0 ${G.mouthY})">${MOUTH.smile}</g>
  ${[-1, 1].map((s) => `<circle class="dk-l" cx="${s * G.rest.x}" cy="${G.rest.y}" r="${G.hand}" fill="${armCol}"/>`).join('')}
  ${c.face || ''}${c.head || ''}</svg>`;
}

export function startActors(list, getCtx) {
  return onFrame((dt, t) => { const ctx = getCtx(); for (const a of list) a.update(dt, t, ctx); });
}
