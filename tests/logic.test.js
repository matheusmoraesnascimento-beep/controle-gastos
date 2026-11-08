const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

test('parseAmount aceita virgula e ponto', () => {
  assert.equal(L.parseAmount('12,50'), 12.5);
  assert.equal(L.parseAmount('12.5'), 12.5);
  assert.equal(L.parseAmount(' 7 '), 7);
  assert.equal(L.parseAmount('0,99'), 0.99);
});

test('parseAmount rejeita invalidos', () => {
  for (const s of ['', '   ', 'abc', '-3', '0', '0,00', '1,234', '1,2,3', '12,5x']) {
    assert.equal(L.parseAmount(s), null, s);
  }
});

test('toCents evita erro de ponto flutuante', () => {
  assert.equal(L.toCents(12.5), 1250);
  assert.equal(L.toCents(0.1 + 0.2), 30);
  assert.equal(L.toCents(19.99), 1999);
});

test('formatBRL formata centavos', () => {
  assert.equal(L.formatBRL(0), 'R$ 0,00');
  assert.equal(L.formatBRL(5), 'R$ 0,05');
  assert.equal(L.formatBRL(25000), 'R$ 250,00');
  assert.equal(L.formatBRL(123456), 'R$ 1.234,56');
  assert.equal(L.formatBRL(-1250), '-R$ 12,50');
});

test('weekStart devolve segunda 00:00 local', () => {
  // 2026-11-02 = segunda ; 2026-11-08 = domingo
  const seg = new Date(2026, 10, 2).getTime();
  assert.equal(L.weekStart(new Date(2026, 10, 2, 0, 0)).getTime(), seg);
  assert.equal(L.weekStart(new Date(2026, 10, 4, 15, 30)).getTime(), seg);
  assert.equal(L.weekStart(new Date(2026, 10, 8, 23, 59)).getTime(), seg);
  assert.equal(L.weekStart(new Date(2026, 10, 9, 0, 0)).getTime(), new Date(2026, 10, 9).getTime());
});

test('dayStart zera hora', () => {
  assert.equal(L.dayStart(new Date(2026, 10, 4, 15, 30)).getTime(), new Date(2026, 10, 4).getTime());
});

const at = (d, h = 12) => new Date(2026, 10, d, h).getTime();
const ex = (id, amount, d, description = '') => ({ id, amount, description, ts: at(d) });

test('weekSummary soma so a semana atual', () => {
  const expenses = [
    ex('a', 100, 2),   // seg desta semana
    ex('b', 12.5, 8),  // dom desta semana
    ex('c', 50, 1),    // domingo da semana passada
    ex('d', 70, 9),    // segunda da proxima semana
  ];
  const now = new Date(2026, 10, 4, 10);
  const s = L.weekSummary(expenses, 250, now);
  assert.equal(s.spentCents, 11250);
  assert.equal(s.budgetCents, 25000);
  assert.equal(s.remainingCents, 13750);
  assert.equal(s.over, false);
  assert.equal(Math.round(s.pct), 45);
});

test('weekSummary detecta estouro e limita pct a 100', () => {
  const s = L.weekSummary([ex('a', 300, 3)], 250, new Date(2026, 10, 4));
  assert.equal(s.over, true);
  assert.equal(s.remainingCents, -5000);
  assert.equal(s.pct, 100);
});

test('weekDays devolve 7 dias seg-dom com totais e itens ordenados', () => {
  const expenses = [ex('a', 10, 4), ex('b', 5.5, 4), ex('c', 20, 8), ex('x', 99, 9)];
  const days = L.weekDays(expenses, new Date(2026, 10, 4));
  assert.equal(days.length, 7);
  assert.equal(days[0].date.getTime(), new Date(2026, 10, 2).getTime());
  assert.equal(days[2].totalCents, 1550);
  assert.equal(days[2].items.length, 2);
  assert.equal(days[6].totalCents, 2000);
  assert.equal(days[0].totalCents, 0);
});

test('todayTotalCents soma so o dia', () => {
  const expenses = [ex('a', 10, 4), ex('b', 5.5, 4), ex('c', 20, 5)];
  assert.equal(L.todayTotalCents(expenses, new Date(2026, 10, 4, 22)), 1550);
});

function fakeStorage(initial) {
  const m = new Map(initial ? [['gastos.v1', initial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}

test('loadState vazio devolve padrao', () => {
  assert.deepEqual(L.loadState(fakeStorage()), { budget: 250, expenses: [] });
});

test('loadState com JSON corrompido devolve padrao', () => {
  assert.deepEqual(L.loadState(fakeStorage('{nao e json')), { budget: 250, expenses: [] });
});

test('loadState descarta gastos invalidos e budget invalido', () => {
  const raw = JSON.stringify({
    budget: -5,
    expenses: [
      { id: 'a', amount: 10, description: 'ok', ts: 1 },
      { id: 'b', amount: 'x', ts: 2 },
      null,
    ],
  });
  const s = L.loadState(fakeStorage(raw));
  assert.equal(s.budget, 250);
  assert.equal(s.expenses.length, 1);
  assert.equal(s.expenses[0].id, 'a');
});

test('save/load ida e volta', () => {
  const st = fakeStorage();
  const state = { budget: 300, expenses: [{ id: 'a', amount: 1.5, description: '', ts: 5 }] };
  L.saveState(st, state);
  assert.deepEqual(L.loadState(st), state);
});

test('saveState nao quebra se storage lanca', () => {
  const bad = { setItem() { throw new Error('quota'); }, getItem() { return null; } };
  assert.equal(L.saveState(bad, { budget: 1, expenses: [] }), false);
});
