(function () {
  const L = window.Logic;
  const $ = (id) => document.getElementById(id);
  const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  let storage;
  try { storage = window.localStorage; storage.getItem('x'); }
  catch (e) { storage = { getItem: () => null, setItem: () => { throw e; } }; }

  const state = L.loadState(storage);

  function persist() {
    $('warn').style.display = L.saveState(storage, state) ? 'none' : 'block';
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DAY_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ddmm = (d) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1);

  const calView = { year: new Date().getFullYear(), month: new Date().getMonth() };
  let selectedDay = null; // ms do dia selecionado no calendario

  function itemButton(e) {
    const b = document.createElement('button');
    b.className = 'item';
    b.type = 'button';
    const t = new Date(e.ts);
    const left = document.createElement('span');
    left.textContent = e.description || 'Sem descrição';
    if (!e.description) left.className = 'd';
    const right = document.createElement('span');
    right.textContent = L.formatBRL(L.toCents(e.amount)) + ' · ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
    b.append(left, right);
    b.addEventListener('click', () => {
      if (confirm('Apagar este gasto?\n' + (e.description || 'Sem descrição') + ' — ' + L.formatBRL(L.toCents(e.amount)))) {
        state.expenses = state.expenses.filter((x) => x.id !== e.id);
        persist();
        render();
      }
    });
    return b;
  }

  function cell(tag, cls, text) {
    const el = document.createElement(tag);
    el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function renderCalendar(now) {
    const sd = state.startDay;
    $('cal-title').textContent = MONTHS[calView.month] + ' ' + calView.year;
    const grid = $('cal-grid');
    grid.textContent = '';
    grid.append(cell('div', 'cal-wk'));
    for (let i = 0; i < 7; i++) grid.append(cell('div', 'cal-wd', DAY_ABBR[(sd + i) % 7]));

    const curWeek = L.weekStart(now, sd).getTime();
    const todayMs = L.dayStart(now).getTime();
    L.monthGrid(calView.year, calView.month, sd).forEach((w) => {
      const wo = L.weekOfMonth(w.start, sd);
      const wk = cell('div', 'cal-wk', 'S' + wo.index);
      if (wo.month !== calView.month) wk.append(cell('small', '', MONTHS[wo.month].slice(0, 3)));
      grid.append(wk);
      w.days.forEach((d) => {
        const cents = L.todayTotalCents(state.expenses, d);
        const btn = cell('button', 'cal-day');
        btn.type = 'button';
        if (d.getMonth() !== calView.month) btn.classList.add('out');
        if (w.start.getTime() === curWeek) btn.classList.add('curweek');
        if (d.getTime() === todayMs) btn.classList.add('today');
        if (d.getTime() === selectedDay) btn.classList.add('sel');
        btn.append(cell('span', 'n', String(d.getDate())));
        if (cents > 0) btn.append(cell('span', 't', String(Math.round(cents / 100))));
        btn.addEventListener('click', () => {
          selectedDay = selectedDay === d.getTime() ? null : d.getTime();
          renderCalendar(new Date());
        });
        grid.append(btn);
      });
    });

    const det = $('cal-detail');
    det.textContent = '';
    if (selectedDay !== null) {
      const d = new Date(selectedDay);
      const items = L.weekDays(state.expenses, d, d.getDay())[0].items;
      const head = cell('div', 'day-head');
      head.append(cell('span', '', DAY_NAMES[d.getDay()] + ' ' + ddmm(d)), cell('span', '', L.formatBRL(L.todayTotalCents(state.expenses, d))));
      det.append(head);
      if (items.length === 0) det.append(cell('div', 'mut', 'Sem gastos neste dia.'));
      items.forEach((e) => det.append(itemButton(e)));
    }
  }

  function render() {
    const now = new Date();
    const s = L.weekSummary(state.expenses, state.budget, now, state.startDay);

    const wo = L.weekOfMonth(now, state.startDay);
    const wEnd = L.addDays(wo.start, 6);
    $('week-label').textContent = 'Semana ' + wo.index + ' de ' + wo.total + ' · ' + MONTHS[wo.month] +
      ' · ' + ddmm(wo.start) + ' – ' + ddmm(wEnd);

    $('week-text').textContent = L.formatBRL(s.spentCents) + ' de ' + L.formatBRL(s.budgetCents);
    $('bar').classList.toggle('over', s.over);
    $('bar-fill').style.width = s.pct + '%';
    const rem = $('remaining');
    rem.className = s.over ? 'over-txt' : 'mut';
    rem.textContent = s.over
      ? 'Estourou ' + L.formatBRL(-s.remainingCents)
      : 'Restam ' + L.formatBRL(s.remainingCents);

    $('today-total').textContent = L.formatBRL(L.todayTotalCents(state.expenses, now));

    const daysEl = $('days');
    daysEl.textContent = '';
    const todayMs = L.dayStart(now).getTime();
    L.weekDays(state.expenses, now, state.startDay).forEach((day) => {
      const box = document.createElement('div');
      box.className = 'day' + (day.date.getTime() === todayMs ? ' today' : '');

      const head = document.createElement('div');
      head.className = 'day-head';
      const name = document.createElement('span');
      name.textContent = DAY_NAMES[day.date.getDay()] + ' ' + pad(day.date.getDate()) + '/' + pad(day.date.getMonth() + 1);
      const tot = document.createElement('span');
      tot.textContent = L.formatBRL(day.totalCents);
      head.append(name, tot);
      box.append(head);

      day.items.forEach((e) => box.append(itemButton(e)));
      daysEl.append(box);
    });

    renderCalendar(now);
  }

  $('add-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const amount = L.parseAmount($('amount').value);
    const err = $('amount-err');
    if (amount === null) {
      $('amount').classList.add('err');
      err.textContent = 'Digite um valor maior que zero (ex: 12,50).';
      return;
    }
    $('amount').classList.remove('err');
    err.textContent = '';
    state.expenses.push({
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
      amount,
      description: $('desc').value.trim(),
      ts: Date.now(),
    });
    persist();
    $('amount').value = '';
    $('desc').value = '';
    $('amount').focus();
    render();
  });

  $('gear').addEventListener('click', () => {
    const open = $('settings').classList.toggle('open');
    if (open) {
      $('budget-input').value = String(state.budget).replace('.', ',');
      $('start-day').value = String(state.startDay);
    }
  });

  $('budget-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = L.parseAmount($('budget-input').value);
    if (v === null) {
      $('budget-input').classList.add('err');
      $('budget-err').textContent = 'Digite um valor maior que zero.';
      return;
    }
    $('budget-input').classList.remove('err');
    $('budget-err').textContent = '';
    state.budget = v;
    state.startDay = Number($('start-day').value);
    persist();
    $('settings').classList.remove('open');
    render();
  });

  function shiftMonth(delta) {
    const d = new Date(calView.year, calView.month + delta, 1);
    calView.year = d.getFullYear();
    calView.month = d.getMonth();
    selectedDay = null;
    renderCalendar(new Date());
  }
  $('cal-prev').addEventListener('click', () => shiftMonth(-1));
  $('cal-next').addEventListener('click', () => shiftMonth(1));

  // Re-render ao voltar pro app (virada de dia/semana).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  persist();
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
