// Placement regressions use the reviewer's actual pc-4 geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rankGuideSpots } from '../app/en/js/guide.js';

const card = { left: 460, top: 452.4, right: 820, bottom: 663.4 };
const hole = { left: 443, top: 371.4, right: 643.6, bottom: 433.4 };
const scene = { obstacles: [card, hole], labels: [], width: 1280, height: 800 };
const spot = (id, bounds, distance = 100) => ({ id, bounds, distance });
const old = spot('old', { left: 659.9, top: 345.4, right: 809.6, bottom: 455.2 });
const left = spot('left', { left: 266, top: 345.4, right: 416, bottom: 455.2 }, 200);

test('pc-4 chooses empty left space instead of the recorded caption overlap', () => {
  const ranked = rankGuideSpots([old, left], scene);
  assert.equal(ranked[0].id, 'left');
  assert.equal(ranked[0].hard, 0);
  assert.ok(ranked[1].hard > 0);
});

test('12px clearance plus breathing reserve outranks any soft preference', () => {
  const near = spot('near', { left: 660, top: 200, right: 810, bottom: 300 }, 0);
  const far = spot('far', { left: 900, top: 200, right: 1050, bottom: 300 }, 10000);
  const options = { ...scene, obstacles: [{ left: 460, top: 320, right: 820, bottom: 400 }] };
  assert.equal(rankGuideSpots([near], options)[0].hard, 0);
  near.bounds.bottom += 0.1;
  const ranked = rankGuideSpots([near, far], { ...options, labels: [far.bounds] });
  assert.equal(ranked[0].id, 'far');
  assert.equal(ranked[0].hard, 0);
  assert.ok(ranked[1].hard > 0);
});

test('title label coverage breaks ties between collision-free positions', () => {
  const right = spot('right', { left: 900, top: 345, right: 1050, bottom: 455 }, 100);
  assert.equal(rankGuideSpots([left, right], scene)[0].id, 'right');
  assert.equal(rankGuideSpots([left, right], { ...scene, labels: [right.bounds] })[0].id, 'left');
});

test('phone placement rejects side positions outside the viewport', () => {
  for (const [width, height] of [[360, 640], [390, 844]]) {
    const phone = { width, height, labels: [], obstacles: [{ left: 10, top: 290, right: width - 10, bottom: 410 }, { left: 16, top: 440, right: width - 16, bottom: 620 }] };
    const above = spot('above', { left: 120, top: 125, right: 245, bottom: 245 });
    const outside = spot('right', { left: width - 20, top: 260, right: width + 100, bottom: 375 }, 0);
    assert.equal(rankGuideSpots([outside, above], phone)[0].id, 'above');
    assert.equal(rankGuideSpots([above], phone)[0].hard, 0);
  }
});
