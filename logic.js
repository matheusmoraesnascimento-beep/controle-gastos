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

  const DEFAULT_START_DAY = 1; // segunda (0=dom ... 6=sab)

  // 00:00 local do dia `startDay` mais recente (ou o proprio dia) em relacao a `date`.
  function weekStart(date, startDay = DEFAULT_START_DAY) {
    const d = dayStart(date);
    const offset = (d.getDay() - startDay + 7) % 7;
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

  function weekSummary(expenses, budget, now, startDay) {
    const start = weekStart(now, startDay);
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

  function weekDays(expenses, now, startDay) {
    const start = weekStart(now, startDay);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const items = inRange(expenses, date, addDays(date, 1)).sort((x, y) => x.ts - y.ts);
      days.push({ date, items, totalCents: sumCents(items) });
    }
    return days;
  }

  // Datas (00:00) em que comecam as semanas do mes (month: 0-11).
  function monthWeekStarts(year, month, startDay = DEFAULT_START_DAY) {
    const offset = (startDay - new Date(year, month, 1).getDay() + 7) % 7;
    const out = [];
    for (let d = new Date(year, month, 1 + offset); d.getMonth() === month; d = addDays(d, 7)) out.push(d);
    return out;
  }

  // Semana pertence ao mes em que COMECA. index 1-based.
  function weekOfMonth(date, startDay = DEFAULT_START_DAY) {
    const start = weekStart(date, startDay);
    const year = start.getFullYear(), month = start.getMonth();
    const starts = monthWeekStarts(year, month, startDay);
    const index = starts.findIndex((s) => s.getTime() === start.getTime()) + 1;
    return { index, total: starts.length, year, month, start };
  }

  // Semanas inteiras que cobrem o mes, para desenhar o calendario.
  function monthGrid(year, month, startDay = DEFAULT_START_DAY) {
    const first = weekStart(new Date(year, month, 1), startDay);
    const lastStart = weekStart(new Date(year, month + 1, 0), startDay);
    const weeks = [];
    for (let s = first; s.getTime() <= lastStart.getTime(); s = addDays(s, 7)) {
      weeks.push({ start: s, days: [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(s, i)) });
    }
    return weeks;
  }

  function todayTotalCents(expenses, now) {
    const d = dayStart(now);
    return sumCents(inRange(expenses, d, addDays(d, 1)));
  }

  const STORAGE_KEY = 'gastos.v1';

  function defaultState() {
    return { budget: DEFAULT_BUDGET, startDay: DEFAULT_START_DAY, expenses: [] };
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
      const startDay = Number.isInteger(data.startDay) && data.startDay >= 0 && data.startDay <= 6
        ? data.startDay : DEFAULT_START_DAY;
      const expenses = Array.isArray(data.expenses)
        ? data.expenses.filter(validExpense).map((e) => ({
            id: e.id, amount: e.amount, description: typeof e.description === 'string' ? e.description : '', ts: e.ts,
          }))
        : [];
      return { budget, startDay, expenses };
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

  return { DEFAULT_BUDGET, DEFAULT_START_DAY, parseAmount, toCents, formatBRL, dayStart, weekStart, sumCents, weekSummary, weekDays, todayTotalCents, monthWeekStarts, weekOfMonth, monthGrid, addDays, STORAGE_KEY, loadState, saveState };
});
