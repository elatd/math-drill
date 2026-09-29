// Validates generated column-arithmetic problems for the public app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, generate, BASIC_SETS, EXTRA_TIERS } from '../app/en/js/problems.js';

const templates = [...new Set([...Object.values(BASIC_SETS).flat(), ...EXTRA_TIERS.flat()])];

test('every template yields steps that spell the correct answer', () => {
  const rng = makeRng(12345);
  for (const t of templates) {
    for (let i = 0; i < 300; i++) {
      const p = generate(t, rng);
      const digits = p.steps.map((s) => s.digit);
      if (p.kind === 'div') {
        assert.equal(p.a % p.b, 0, `${p.text} must divide exactly`);
        const q = p.steps.filter((s) => s.cell.startsWith('q')).map((s) => s.digit).join('');
        assert.equal(q, String(p.answer), p.text);
      } else {
        assert.equal([...digits].reverse().join(''), String(p.answer), p.text);
        assert.equal(Number(p.answer), p.kind === 'add' ? p.a + p.b : p.a - p.b);
      }
      for (const s of p.steps) {
        assert.match(s.digit, /^[0-9]$/);
        assert.ok(p.cells.some((c) => c.id === s.cell && c.kind === 'input'));
        for (const id of s.after || []) assert.ok(p.cells.some((c) => c.id === id) || p.lines.some((l) => l.id === id), `${p.text} reveals ${id}`);
      }
    }
  }
});

test('borrow marks follow the standard algorithm (503 - 278)', () => {
  const p = generate('sub3z', makeRng(1), { kind: 'sub', a: 503, b: 278 });
  assert.deepEqual(p.steps.map((s) => s.digit), ['5', '2', '2']);
  assert.deepEqual(p.steps[0].marks, [{ c: 2, text: '9' }, { c: 1, text: '4' }, { c: 3, text: '13' }]);
});

test('long division 156 / 4 matches the spec walkthrough', () => {
  const p = generate('div3', makeRng(1), { kind: 'div', a: 156, b: 4 });
  // Quotient tens, the remainder 15 - 12, then quotient ones; the final 0 is automatic.
  assert.deepEqual(p.steps.map((s) => s.digit), ['3', '3', '9']);
  assert.equal(p.cells.find((c) => c.id.startsWith('bd')).text, '6');
  assert.ok(p.cells.some((c) => c.id.startsWith('z') && c.text === '0'));
});

test('first basic problem is the spec example and sets have the chosen lengths', () => {
  for (const n of [6, 10, 14]) assert.equal(BASIC_SETS[n].length, n);
});
