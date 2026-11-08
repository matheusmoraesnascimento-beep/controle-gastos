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

  function render() {
    const now = new Date();
    const s = L.weekSummary(state.expenses, state.budget, now);

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
    L.weekDays(state.expenses, now).forEach((day) => {
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

      day.items.forEach((e) => {
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
        box.append(b);
      });
      daysEl.append(box);
    });
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
    if (open) $('budget-input').value = String(state.budget).replace('.', ',');
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
    persist();
    $('settings').classList.remove('open');
    render();
  });

  // Re-render ao voltar pro app (virada de dia/semana).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  persist();
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
