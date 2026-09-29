// Skill tree data integrity (id019).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SKILL, DEPTH, LANES } from '../app/en/js/skills.js';

test('ids are unique and prerequisites exist', () => {
  assert.equal(new Set(SKILLS.map((s) => s.id)).size, SKILLS.length);
  for (const s of SKILLS) for (const r of s.req) assert.ok(SKILL[r], `${s.id} needs ${r}`);
});

test('prerequisites never come from a later grade and the graph is acyclic', () => {
  for (const s of SKILLS) for (const r of s.req) assert.ok(SKILL[r].grade <= s.grade, `${s.id} <- ${r}`);
  for (const s of SKILLS) assert.ok(Number.isFinite(DEPTH[s.id]));
});

test('every grade and lane is populated', () => {
  for (let g = 1; g <= 6; g++) assert.ok(SKILLS.some((s) => s.grade === g), `grade ${g}`);
  LANES.forEach((_, i) => assert.ok(SKILLS.some((s) => s.lane === i), `lane ${i}`));
  assert.ok(SKILLS.length >= 50);
});
