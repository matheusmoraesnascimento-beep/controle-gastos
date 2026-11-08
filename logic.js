(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_BUDGET = 250;

  // "12,50" -> 12.5 ; invalido/<=0 -> null. Max 2 casas decimais.
  function parseAmount(str) {
    const s = String(str).trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const n = parseFloat(s);
    return n > 0 ? n : null;
  }

  function toCents(reais) {
    return Math.round(reais * 100);
  }

  function formatBRL(cents) {
    const neg = cents < 0;
    const abs = Math.abs(cents);
    const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const cent = String(abs % 100).padStart(2, '0');
    return (neg ? '-' : '') + 'R$ ' + reais + ',' + cent;
  }

  function dayStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  // Segunda-feira 00:00 local da semana de `date`.
  function weekStart(date) {
    const d = dayStart(date);
    const offset = (d.getDay() + 6) % 7; // seg=0 ... dom=6
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  }

  function sumCents(expenses) {
    return expenses.reduce((acc, e) => acc + toCents(e.amount), 0);
  }

  function inRange(expenses, startDate, endDate) {
    const a = startDate.getTime(), b = endDate.getTime();
    return expenses.filter((e) => e.ts >= a && e.ts < b);
  }

  function addDays(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }

  function weekSummary(expenses, budget, now) {
    const start = weekStart(now);
    const spentCents = sumCents(inRange(expenses, start, addDays(start, 7)));
    const budgetCents = toCents(budget);
    const pct = budgetCents > 0 ? Math.min(100, (spentCents / budgetCents) * 100) : 100;
    return {
      spentCents,
      budgetCents,
      remainingCents: budgetCents - spentCents,
      over: spentCents > budgetCents,
      pct,
    };
  }

  function weekDays(expenses, now) {
    const start = weekStart(now);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const items = inRange(expenses, date, addDays(date, 1)).sort((x, y) => x.ts - y.ts);
      days.push({ date, items, totalCents: sumCents(items) });
    }
    return days;
  }

  function todayTotalCents(expenses, now) {
    const d = dayStart(now);
    return sumCents(inRange(expenses, d, addDays(d, 1)));
  }

  const STORAGE_KEY = 'gastos.v1';

  function defaultState() {
    return { budget: DEFAULT_BUDGET, expenses: [] };
  }

  function validExpense(e) {
    return e && typeof e === 'object' && typeof e.id === 'string' &&
      typeof e.amount === 'number' && isFinite(e.amount) && e.amount > 0 &&
      typeof e.ts === 'number' && isFinite(e.ts);
  }

  function loadState(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      const budget = typeof data.budget === 'number' && data.budget > 0 ? data.budget : DEFAULT_BUDGET;
      const expenses = Array.isArray(data.expenses)
        ? data.expenses.filter(validExpense).map((e) => ({
            id: e.id, amount: e.amount, description: typeof e.description === 'string' ? e.description : '', ts: e.ts,
          }))
        : [];
      return { budget, expenses };
    } catch (err) {
      return defaultState();
    }
  }

  function saveState(storage, state) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  return { DEFAULT_BUDGET, parseAmount, toCents, formatBRL, dayStart, weekStart, sumCents, weekSummary, weekDays, todayTotalCents, STORAGE_KEY, loadState, saveState };
});
