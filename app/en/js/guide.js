// Title tour: captions belong to the interface, never to the mascot.

const INTRO = { title: 'How to play', text: 'There are 3 ways\nto pick your problems' };
const LEVEL = { target: '#start', title: 'My Level', text: 'Problems that fit you right now.\nIt starts with a skill check' };
const GRADES = { target: '.grades', title: 'Grade 1 to Grade 6', text: 'Practice the problems\nfrom a whole grade' };
const TREE = { target: '#open-tree', title: 'Skill Tree', text: 'Pick the one kind of problem\nyou want to practice' };
const TROPHY = { target: '#open-trophy', title: 'Trophies', text: 'You earn them by playing.\nKeep coming back for more' };
const COLLECTION = { target: '#open-collect', title: 'Collection', text: 'Trophy rewards add backgrounds,\nmusic, outfits and more\nfor you to choose' };
const LAST = { target: '#start', title: 'Not sure? Try My Level!', text: 'You can see this guide\nagain with ?', recommend: true };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Use measured body + arm bounds. Hard constraints always outrank label coverage.
export const GUIDE_GAP = 12;
const expand = (r, pad) => ({ left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad });
const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
export function rankGuideSpots(spots, { obstacles, labels, width, height }) {
  return spots.map((spot) => {
    // Reserve extra room for breathing, stroke width and spring settling.
    const bounds = expand(spot.bounds, 8);
    const outside = Math.max(0, 12 - bounds.left) + Math.max(0, 12 - bounds.top)
      + Math.max(0, bounds.right - width + 12) + Math.max(0, bounds.bottom - height + 12);
    const collision = obstacles.reduce((sum, r) => sum + overlapArea(bounds, expand(r, GUIDE_GAP)), 0);
    const covered = labels.reduce((sum, r) => sum + overlapArea(bounds, r), 0);
    return { ...spot, hard: collision + outside * 1000, soft: covered * 10 + spot.distance };
  }).sort((a, b) => a.hard - b.hard || a.soft - b.soft);
}

export function createGuide({ hero, reduced, onClose }) {
  const title = document.querySelector('#screen-title');
  const app = document.querySelector('#app');
  const overlay = document.createElement('div');
  overlay.id = 'guide';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'guide-heading');
  overlay.setAttribute('aria-describedby', 'guide-text');
  overlay.innerHTML = `
    <svg class="guide-shade" aria-hidden="true"><defs><mask id="guide-mask" maskUnits="userSpaceOnUse"><rect class="guide-mask-base" fill="white" width="100%" height="100%"/><rect id="guide-hole" fill="black" rx="20"/><rect id="guide-help-hole" fill="black" rx="16"/></mask></defs><rect width="100%" height="100%" fill="#101637" fill-opacity=".76" mask="url(#guide-mask)"/><rect id="guide-ring" rx="20" fill="none" stroke="#ffd23f" stroke-width="3"/><rect id="guide-help-ring" rx="16" fill="none" stroke="#ffd23f" stroke-width="2"/></svg>
    <svg id="guide-actor" aria-hidden="true"><g id="guide-body"></g><g id="guide-arms"></g></svg>
    <span id="guide-recommend" hidden>${'Recommended'}</span>
    <button type="button" id="guide-skip" class="sub-btn">${'Skip'}</button>
    <section id="guide-card" aria-live="polite" aria-atomic="true">
      <h2 id="guide-heading"></h2><p id="guide-text"></p>
      <div id="guide-dots" role="img"></div>
      <div class="guide-actions"><button type="button" class="sub-btn" id="guide-back">${'Back'}</button><button type="button" class="big-btn" id="guide-next">${'Next'}</button></div>
    </section>`;
  document.body.append(overlay);
  const $ = (s) => overlay.querySelector(s);
  const card = $('#guide-card');
  let pages = [], index = 0, active = false, epoch = 0, saved = null, frame = 0;

  function resetPose() {
    hero.begin();
    hero.hands.forEach((h) => { h.job = 0; h.mode = 'rest'; h.raise = 0; h.carry = null; });
    hero.lift = 0; hero.rot = 0; hero.shake = 0;
    hero.stretchX = 1; hero.stretchY = 1;
    for (const name of ['sq', 'lean', 'tilt', 'earL', 'earR']) {
      hero[name].value = hero[name].target = name === 'sq' ? 1 : 0;
      hero[name].velocity = 0;
    }
    hero.resetFace();
  }

  function spotlight(rect, ids = ['#guide-hole', '#guide-ring'], pad = 5) {
    for (const id of ids) {
      const el = $(id);
      el.style.display = rect ? '' : 'none';
      if (!rect) continue;
      for (const [key, value] of Object.entries({ x: rect.left - pad, y: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 })) el.setAttribute(key, value);
    }
  }

  function mascotBounds() {
    const a = hero.root.getBoundingClientRect(), b = hero.armsFront.getBoundingClientRect();
    return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
  }

  function pointPose(feet, aim) {
    resetPose();
    hero.place(feet.x, feet.y);
    hero.point(aim, 0, { staticPose: true });
    hero.update(0, 0);
  }

  function chooseSpot(rect, extraObstacles = []) {
    const W = innerWidth, H = innerHeight;
    const cardRect = card.getBoundingClientRect();
    const hole = rect ? expand(rect, 5) : null;
    const labels = [...title.querySelectorAll('button')].filter((el) => !el.hidden).map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height && r.bottom > 0 && r.top < H);
    const obstacles = [cardRect, $('#guide-skip').getBoundingClientRect(), ...extraObstacles, ...(hole ? [hole] : [])];
    if (pages[index].recommend) obstacles.push($('#guide-recommend').getBoundingClientRect());
    const cx = rect ? (rect.left + rect.right) / 2 : W / 2;
    const cy = rect ? (rect.top + rect.bottom) / 2 : cardRect.top - 70;
    const spots = [];
    const add = (x, y, side) => {
      const feet = { x, y };
      // Stop well short of the hole; the hand must also keep the 12px gap.
      const aim = !hole ? { x: x + 45, y: y - 85 }
        : side === 'left' ? { x: hole.left - 40, y: clamp(y - 40, hole.top, hole.bottom) }
        : side === 'right' ? { x: hole.right + 40, y: clamp(y - 40, hole.top, hole.bottom) }
        : { x: clamp(x, hole.left + 20, hole.right - 20), y: hole.top - 40 };
      pointPose(feet, aim);
      spots.push({ feet, aim, side, bounds: mascotBounds(), distance: Math.hypot(x - cx, y - cy) });
    };
    const modes = document.querySelector('#modes').getBoundingClientRect();
    if (hole) {
      for (const distance of [105, 155, 210]) {
        for (const y of [cy + 38, cy, hole.top - 36]) {
          add(hole.left - distance, y, 'left');
          add(hole.right + distance, y, 'right');
        }
      }
      // The wide empty margins are better than standing on adjacent buttons.
      for (const y of [cy + 38, cy, hole.top - 36]) {
        add(modes.left - 110, y, 'left');
        add(modes.right + 110, y, 'right');
      }
    }
    for (const x of [cx, W / 2, W * 0.28, W * 0.72]) {
      for (const lift of [42, 90, 150, 210]) add(x, (hole ? hole.top : cardRect.top) - lift, 'above');
    }
    return rankGuideSpots(spots, { obstacles, labels, width: W, height: H })[0];
  }

  async function layout(animate = false) {
    if (!active) return;
    const ticket = ++epoch;
    const alive = () => active && ticket === epoch;
    const previous = { x: hero.x, y: hero.y };
    resetPose();
    overlay.dataset.ready = 'false';
    const page = pages[index];
    const target = page.target ? document.querySelector(page.target) : null;
    const W = innerWidth, H = innerHeight;
    const cardH = card.getBoundingClientRect().height;
    let rect = null, helpRect = null;
    hero.S = W < 700 ? 0.56 : 0.68;
    if (target) {
      rect = target.getBoundingClientRect();
      const wantedTop = Math.max(195, Math.min(H * 0.47, H - cardH - rect.height - 48));
      let scroll = title.scrollTop + rect.top - wantedTop;
      if (page.recommend) {
        const help = document.querySelector('#open-guide').getBoundingClientRect();
        // Intersect the scroll ranges that fit help, start and the caption.
        const lower = Math.max(0, title.scrollTop + rect.bottom + 24 + cardH - H + 20);
        const upper = Math.min(title.scrollHeight - title.clientHeight, title.scrollTop + help.top - 16, title.scrollTop + rect.top - 195);
        if (lower <= upper) scroll = clamp(scroll, lower, upper);
      }
      title.scrollTo({ top: scroll, behavior: 'instant' });
      rect = target.getBoundingClientRect();
      card.style.top = `${rect.bottom + 24}px`;
      if (page.recommend) {
        const r = document.querySelector('#open-guide').getBoundingClientRect();
        if (r.top >= 16 && r.bottom <= H - 16) helpRect = r;
      }
    } else {
      title.scrollTo({ top: 0, behavior: 'instant' });
      card.style.top = `${Math.min(H * 0.47, H - cardH - 58) + 32}px`;
    }
    spotlight(rect);
    spotlight(helpRect, ['#guide-help-hole', '#guide-help-ring'], 4);
    overlay.dataset.help = page.recommend ? (helpRect ? 'button' : 'caption') : '';
    $('#guide-help-icon')?.classList.toggle('guide-help-fallback', !helpRect);
    $('#guide-recommend').hidden = !page.recommend;
    if (page.recommend) {
      $('#guide-recommend').style.left = `${rect.left + 8}px`;
      $('#guide-recommend').style.top = `${rect.top - 23}px`;
    }
    overlay.dataset.target = page.target || '';
    const spot = chooseSpot(rect, helpRect ? [expand(helpRect, 4)] : []);
    const { feet, aim } = spot;
    overlay.dataset.placement = spot.side;
    overlay.dataset.collision = String(spot.hard);
    resetPose();
    hero.place(previous.x, previous.y);
    hero.update(0, 0);
    if (animate && !reduced()) {
      if (!target) { hero.place(feet.x, feet.y); hero.hands[1].raise = 0.6; await hero.hop(22, 320); }
      else await hero.leapTo(feet, 28);
      if (!alive()) return;
      hero.place(feet.x, feet.y);
      if (page.recommend) { await hero.celebrate(0.15, { variant: 'hop' }); if (!alive()) return; }
    } else hero.place(feet.x, feet.y);
    if (!alive()) return;
    hero.hands.forEach((h) => { h.raise = 0; });
    if (animate && !reduced() && target) {
      await hero.point(aim, 300);
      if (!alive()) return;
    }
    // Restore the exact measured pose after the landing/pointing animation.
    pointPose(feet, aim);
    hero.setFace(page.recommend || !target ? 'happy' : 'open', 'smile');
    hero.lookAt(aim);
    hero.update(0, 0);
    overlay.dataset.ready = 'true';
  }

  function render() {
    const page = pages[index];
    overlay.dataset.page = String(index + 1);
    overlay.dataset.total = String(pages.length);
    $('#guide-heading').textContent = page.title;
    $('#guide-text').textContent = page.text;
    overlay.classList.toggle('guide-last', !!page.recommend);
    if (page.recommend) {
      $('#guide-text').replaceChildren(document.createTextNode('You can see this guide\nagain with '));
      const icon = document.createElement('span');
      icon.id = 'guide-help-icon';
      icon.className = 'icon-btn guide-help-icon';
      icon.setAttribute('role', 'img');
      icon.setAttribute('aria-label', 'How to play');
      icon.append(document.querySelector('#open-guide svg').cloneNode(true));
      $('#guide-text').append(icon, document.createTextNode(''));
    }
    $('#guide-dots').innerHTML = pages.map((_, i) => `<i${i === index ? ' class="current"' : ''} aria-hidden="true"></i>`).join('');
    $('#guide-dots').setAttribute('aria-label', `Page ${index + 1} of ${pages.length}`);
    $('#guide-back').disabled = index === 0;
    $('#guide-next').textContent = index === pages.length - 1 ? "Let's go!" : 'Next';
    layout(true);
    $('#guide-next').focus({ preventScroll: true });
  }

  function close() {
    if (!active) return;
    active = false; epoch += 1; cancelAnimationFrame(frame);
    resetPose();
    saved.bodyParent.append(hero.root); saved.armsParent.append(hero.armsFront);
    overlay.hidden = true;
    app.inert = saved.inert;
    document.body.classList.remove('guide-open');
    title.scrollTo({ top: saved.scroll, behavior: 'instant' });
    saved.focus?.focus({ preventScroll: true });
    onClose();
  }
  function next() { if (index === pages.length - 1) close(); else { index += 1; render(); } }
  function back() { if (index > 0) { index -= 1; render(); } }
  function open({ help = false } = {}) {
    if (active) return;
    saved = { focus: document.activeElement, scroll: title.scrollTop, inert: app.inert, bodyParent: hero.root.parentNode, armsParent: hero.armsFront.parentNode };
    pages = [INTRO, LEVEL, GRADES, TREE, ...(help ? [TROPHY, COLLECTION] : []), LAST];
    index = 0; active = true;
    overlay.hidden = false;
    document.body.classList.add('guide-open');
    $('#guide-body').append(hero.root); $('#guide-arms').append(hero.armsFront);
    app.inert = true;
    render();
  }
  function keydown(e) {
    if (!active) return false;
    if (['Enter', 'ArrowRight', 'ArrowLeft', 'Escape', 'Tab', ' '].includes(e.key)) {
      e.preventDefault();
      if (e.repeat) return true;
      if (e.key === 'Enter' || e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === 'Escape') close();
      else if (e.key === ' ') document.activeElement?.click();
      else {
        const buttons = [...overlay.querySelectorAll('button:not(:disabled)')];
        const i = buttons.indexOf(document.activeElement);
        buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus({ preventScroll: true });
      }
    }
    return true;
  }
  $('#guide-next').addEventListener('click', next);
  $('#guide-back').addEventListener('click', back);
  $('#guide-skip').addEventListener('click', close);
  // Block native scrolling and programmatic title clicks while the tour owns input.
  overlay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  overlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  title.addEventListener('click', (e) => { if (active) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  function relayout() {
    if (!active) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => layout());
  }
  addEventListener('resize', relayout);
  document.fonts.ready.then(() => {
    if (!active) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => layout(true));
  });
  return { open, close, keydown, get active() { return active; } };
}
