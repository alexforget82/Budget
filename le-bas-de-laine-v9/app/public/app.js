'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const formatter = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
const dateLong = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
const dateShort = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
const monthLong = new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' });
let state = null;
let calendarPayload = null;
let calendarMonth = null;
let editing = null;
let guideStep = 0;
let guideResume = null;
let guideAutoShown = false;

function localToday() { return new Date().toLocaleDateString('en-CA'); }
function money(cents) { return formatter.format((Number(cents) || 0) / 100); }
function absMoney(cents) { return money(Math.abs(Number(cents) || 0)); }
function inputMoney(cents) { return (Math.abs(Number(cents) || 0) / 100).toFixed(2).replace('.', ','); }
function parseMoney(value) {
  const text = String(value || '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Error('Inscris un montant avec au plus deux décimales.');
  return Math.round(Number(text) * 100);
}
function prettyDate(value, long = false) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return (long ? dateLong : dateShort).format(date).replace(/^./, letter => letter.toUpperCase());
}
function escapeHTML(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function frequencyLabel(value) {
  return ({ weekly: 'Chaque semaine', biweekly: 'Aux 2 semaines', monthly: 'Chaque mois', twice_monthly: '2 fois par mois', quarterly: 'Aux 3 mois', semiannual: 'Aux 6 mois', yearly: 'Chaque année' })[value] || value;
}
function api(path, options = {}) {
  return fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options })
    .then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || 'Une erreur est survenue.');
      return data;
    });
}
function toast(message) {
  const target = $('#toast');
  target.textContent = message;
  target.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => target.classList.remove('show'), 3300);
}

async function loadState() {
  state = await api('/state');
  document.documentElement.dataset.theme = state.settings.theme;
  $('#versionText').textContent = `v${state.version.replace('-dev', '')}`;
  if (!state.settings.configured) {
    $('#onboarding').hidden = false;
    $('#appShell').hidden = true;
    $('#setupForm [name=date]').value = localToday();
    return;
  }
  $('#onboarding').hidden = true;
  $('#appShell').hidden = false;
  if (!calendarMonth) calendarMonth = state.today.slice(0, 7);
  renderAll();
  if (!guideAutoShown && !state.settings.onboarding_complete && !state.recurring.length && !state.limit_config.length) {
    guideAutoShown = true;
    setTimeout(() => openGuide(0), 180);
  }
}

function renderAll() {
  $('#dateLabel').textContent = prettyDate(state.today, true).toUpperCase();
  renderToday();
  renderLimitOptions();
  renderTransactions();
  renderRecurring();
  renderLimits();
  renderSettings();
  loadCalendar().catch(error => toast(error.message));
}

function renderToday() {
  const forecast = state.forecast;
  $('#availableAmount').textContent = money(forecast.available_cents);
  $('#cashAmount').textContent = money(forecast.balance_cents);
  $('#reserveAmount').textContent = `− ${money(forecast.reserve_cents)}`;
  $('#minimumAmount').textContent = money(forecast.minimum_cents);
  $('#minimumDate').textContent = `Prévu ${prettyDate(forecast.minimum_date, true).toLowerCase()}`;
  const low = forecast.days.find(day => day.date === forecast.minimum_date);
  const reasons = low?.events?.map(event => event.name).slice(0, 2) || [];
  $('#minimumWhy').textContent = reasons.length ? `Influencé par ${reasons.join(' et ')}.` : 'Inclut les limites prévues et les mouvements connus.';
  const nearby = forecast.events.slice(0, 4);
  $('#nearbyEvents').innerHTML = nearby.length ? nearby.map(event => `
    <div class="event"><span class="event-date">${escapeHTML(prettyDate(event.date))}</span><span class="event-name">${escapeHTML(event.name)}</span><span class="${event.amount_cents >= 0 ? 'amount-positive' : 'amount-negative'}">${event.amount_cents >= 0 ? '+' : '−'}${absMoney(event.amount_cents)}</span></div>`).join('') : '<p class="subtle">Aucun mouvement prévu pour le moment.</p>';
  let previousReserve = null;
  $('#forecastRows').innerHTML = forecast.days.map(day => {
    const pills = [...day.events];
    if (previousReserve !== null && day.reserve_cents !== previousReserve) pills.push({ type: 'reserve', name: day.reserve_cents > previousReserve ? 'Limite protégée' : 'Fin de période' });
    previousReserve = day.reserve_cents;
    const lowClass = day.date === forecast.minimum_date ? ' is-low' : '';
    return `<button class="forecast-row${lowClass}" data-day="${day.date}"><span class="forecast-date">${escapeHTML(prettyDate(day.date))}</span><span class="forecast-events">${pills.slice(0, 3).map(event => `<i class="event-pill ${escapeHTML(event.type)}">${escapeHTML(event.name)}</i>`).join('') || '<i class="event-pill">—</i>'}</span><span class="forecast-reserve">${day.reserve_cents ? `Réserve ${money(day.reserve_cents)}` : ''}</span><strong class="forecast-value">${money(day.available_cents)}</strong></button>`;
  }).join('');
  $$('.forecast-row').forEach(button => button.addEventListener('click', () => showDay(button.dataset.day)));
  $('#limitGlance').innerHTML = state.limits.length ? state.limits.slice(0, 6).map(limit => {
    const percentage = limit.budget_cents ? Math.max(0, Math.min(100, Math.round((limit.spent_cents / limit.budget_cents) * 100))) : 0;
    const over = limit.spent_cents > limit.budget_cents;
    return `<article class="limit-glance"><div class="limit-glance-name"><span>${escapeHTML(limit.name)}</span><span>${money(limit.remaining_cents)} restant</span></div><p class="limit-glance-meta">${money(limit.spent_cents)} dépensé sur ${money(limit.budget_cents)} · ${limit.next_start ? `prochaine protection ${escapeHTML(prettyDate(limit.next_start).toLowerCase())}` : 'à venir'}</p><div class="limit-bar${over ? ' over' : ''}"><span style="width:${percentage}%"></span></div></article>`;
  }).join('') : '<p class="subtle">Ajoute une limite pour réserver une portion du disponible à la cadence qui te convient.</p>';
}

function renderLimitOptions() {
  const options = '<option value="">Sans limite</option>' + state.limit_config.map(limit => `<option value="${limit.id}">${escapeHTML(limit.name)}</option>`).join('');
  $('#quickLimit').innerHTML = options;
}

function renderTransactions() {
  const query = ($('#transactionSearch')?.value || '').trim().toLocaleLowerCase('fr-CA');
  const limits = new Map(state.limit_config.map(item => [item.id, item.name]));
  const transactions = state.transactions.filter(item => !query || `${item.description} ${limits.get(item.limit_id) || ''}`.toLocaleLowerCase('fr-CA').includes(query));
  const positive = transactions.filter(item => item.amount_cents > 0).reduce((sum, item) => sum + item.amount_cents, 0);
  const negative = transactions.filter(item => item.amount_cents < 0).reduce((sum, item) => sum + item.amount_cents, 0);
  $('#transactionSummary').textContent = `${transactions.length} mouvement${transactions.length > 1 ? 's' : ''} · Entrées ${money(positive)} · Sorties ${money(Math.abs(negative))}`;
  $('#transactionRows').innerHTML = transactions.length ? transactions.map(item => `<tr><td>${escapeHTML(prettyDate(item.date))}</td><td><strong>${escapeHTML(item.description)}</strong></td><td class="transaction-limit">${escapeHTML(limits.get(item.limit_id) || '—')}</td><td class="amount-cell ${item.amount_cents >= 0 ? 'amount-positive' : 'amount-negative'}">${item.amount_cents >= 0 ? '+' : '−'}${absMoney(item.amount_cents)}</td><td class="row-actions"><button data-edit-transaction="${item.id}">Modifier</button></td></tr>`).join('') : '<tr><td colspan="5" class="subtle">Aucune transaction ne correspond.</td></tr>';
  $('#transactionFoot').innerHTML = `<tr class="table-total"><td colspan="3">Net</td><td class="amount-cell ${positive + negative >= 0 ? 'amount-positive' : 'amount-negative'}">${positive + negative >= 0 ? '+' : '−'}${absMoney(positive + negative)}</td><td></td></tr>`;
  $$('[data-edit-transaction]').forEach(button => button.addEventListener('click', () => openEditor('transaction', state.transactions.find(item => item.id === Number(button.dataset.editTransaction)))));
}

function renderRecurring() {
  const render = (kind, target, count) => {
    const list = state.recurring.filter(item => item.kind === kind);
    $(count).textContent = `${list.length} règle${list.length > 1 ? 's' : ''}`;
    $(target).innerHTML = list.length ? list.map(item => `<article class="rule-row"><div><div class="rule-name">${escapeHTML(item.name)}</div><p class="rule-meta">${escapeHTML(frequencyLabel(item.frequency))} · prochaine occurrence calculée dans le calendrier</p></div><strong class="rule-amount ${kind === 'income' ? 'amount-positive' : 'amount-negative'}">${kind === 'income' ? '+' : '−'}${absMoney(item.amount_cents)}</strong><div class="rule-actions"><button data-edit-recurring="${item.id}">Modifier</button></div></article>`).join('') : '<p class="subtle">Aucune règle pour le moment.</p>';
  };
  render('income', '#incomeRules', '#incomeCount');
  render('bill', '#billRules', '#billCount');
  $$('[data-edit-recurring]').forEach(button => button.addEventListener('click', () => openEditor('recurring', state.recurring.find(item => item.id === Number(button.dataset.editRecurring)))));
}

function renderLimits() {
  const info = new Map(state.limits.map(item => [item.id, item]));
  $('#limitRows').innerHTML = state.limit_config.length ? state.limit_config.map(config => {
    const item = info.get(config.id) || { budget_cents: config.amount_cents, spent_cents: 0, remaining_cents: config.amount_cents, next_start: config.anchor_date };
    return `<tr><td><div class="limit-name">${escapeHTML(config.name)}</div><p class="limit-mode">${config.mode === 'monthly_flexible' ? 'Budget mensuel · libéré par période' : 'Budget par période'} · ${escapeHTML(frequencyLabel(config.frequency))}</p></td><td class="limit-number">${money(item.budget_cents)}</td><td>${money(item.spent_cents)}</td><td class="limit-number ${item.remaining_cents <= 0 && item.spent_cents ? 'warning' : ''}">${money(item.remaining_cents)}</td><td class="limit-next">${item.next_start ? prettyDate(item.next_start) : '—'}</td><td class="row-actions"><button data-edit-limit="${config.id}">Modifier</button></td></tr>`;
  }).join('') : '<tr><td colspan="6" class="subtle">Aucune limite. Une limite réserve le Safe-to-Spend à la date et à la fréquence de ton choix.</td></tr>';
  $$('[data-edit-limit]').forEach(button => button.addEventListener('click', () => openEditor('limit', state.limit_config.find(item => item.id === Number(button.dataset.editLimit)))));
}

function renderSettings() {
  $('#balanceForm [name=balance]').value = inputMoney(state.settings.balance_cents);
  $('#balanceForm [name=date]').value = state.settings.balance_verified_on || state.today;
  $('#verifiedLabel').textContent = state.settings.balance_verified_on ? `Solde vérifié le ${prettyDate(state.settings.balance_verified_on, true).toLowerCase()}.` : 'Solde jamais vérifié.';
  $$('#themeChoices button').forEach(button => button.classList.toggle('active', button.dataset.theme === state.settings.theme));
}

function renderGuide() {
  const incomeCount = state.recurring.filter(item => item.kind === 'income').length;
  const billCount = state.recurring.filter(item => item.kind === 'bill').length;
  const limitCount = state.limit_config.length;
  const content = [
    {
      title: 'Le vrai point de départ',
      body: `<h3>Ton solde conjoint est la base.</h3><p>Il comprend tout ce qui est déjà passé à la banque. Les nouveaux revenus et dépenses modifieront ensuite ce montant automatiquement.</p><p class="guide-status">Solde enregistré : ${money(state.settings.balance_cents)} · ${escapeHTML(prettyDate(state.settings.balance_verified_on).toLowerCase())}</p>`,
      action: 'Vérifier le solde', route: 'settings'
    },
    {
      title: 'Les revenus réguliers',
      body: `<h3>Ajoute ce qui entre.</h3><p>Paies, RRQ, ACE ou allocations : une seule règle suffit. L’application détecte ensuite les mois avec une paie supplémentaire selon la vraie fréquence.</p><p class="guide-status">${incomeCount} revenu${incomeCount > 1 ? 's' : ''} configuré${incomeCount > 1 ? 's' : ''}</p>`,
      action: 'Ajouter un revenu', create: 'income'
    },
    {
      title: 'Les factures à prévoir',
      body: `<h3>Ajoute seulement ce qui revient.</h3><p>Une facture prévue protège le disponible jusqu’à ce qu’elle soit saisie comme payée. Tu peux modifier une seule occurrence sans changer le mois suivant.</p><p class="guide-status">${billCount} facture${billCount > 1 ? 's' : ''} configurée${billCount > 1 ? 's' : ''}</p>`,
      action: 'Ajouter une facture', create: 'bill'
    },
    {
      title: 'Les limites à protéger',
      body: `<h3>Choisis quand l’argent se met de côté.</h3><p>Épicerie, essence et tout autre budget peuvent être protégés chaque semaine, deux semaines, mois ou autre cadence. Une limite ne crée jamais une deuxième dépense.</p><p class="guide-status">${limitCount} limite${limitCount > 1 ? 's' : ''} configurée${limitCount > 1 ? 's' : ''}</p>`,
      action: 'Ajouter une limite', create: 'limit'
    }
  ];
  const current = content[guideStep];
  $('#guideCount').textContent = `BIEN DÉMARRER · ${guideStep + 1} / 4`;
  $('#guideTitle').textContent = current.title;
  $('#guideBody').innerHTML = `${current.body}<button class="outline-button" type="button" id="guideAction">${current.action}</button>`;
  $$('.guide-progress i').forEach((item, index) => item.classList.toggle('active', index <= guideStep));
  $('#guideBack').hidden = guideStep === 0;
  $('#guideNext').textContent = guideStep === 3 ? 'Terminer le guide' : 'Suivant';
  $('#guideAction').addEventListener('click', () => {
    if (current.route) {
      $('#guideDialog').close();
      go(current.route);
      return;
    }
    guideResume = Math.min(guideStep + 1, 3);
    $('#guideDialog').close();
    openEditor(current.create === 'limit' ? 'limit' : 'recurring', null, { kind: current.create });
  });
}

function openGuide(step = 0) {
  if (!state?.settings.configured) return;
  guideStep = Math.max(0, Math.min(3, step));
  renderGuide();
  if (!$('#guideDialog').open) $('#guideDialog').showModal();
}

async function loadCalendar() {
  if (!state?.settings.configured) return;
  calendarPayload = await api(`/calendar?month=${calendarMonth}`);
  const [year, month] = calendarMonth.split('-').map(Number);
  $('#calendarMonth').textContent = monthLong.format(new Date(year, month - 1, 1)).replace(/^./, letter => letter.toUpperCase());
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const events = new Map();
  for (const day of calendarPayload.state.forecast.days) events.set(day.date, day.events);
  for (const item of calendarPayload.occurrences) {
    const list = events.get(item.date) || [];
    if (!list.some(existing => existing.id === item.id)) list.push(item);
    events.set(item.date, list);
  }
  const dayMap = new Map(calendarPayload.state.forecast.days.map(day => [day.date, day]));
  const cells = [];
  for (let index = 0; index < startOffset; index += 1) cells.push('<div class="calendar-day muted"></div>');
  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = `${calendarMonth}-${String(day).padStart(2, '0')}`;
    const row = dayMap.get(date);
    const list = events.get(date) || [];
    const items = list.slice(0, 2).map(item => `<span class="calendar-item ${item.type === 'income' ? 'income' : 'bill'}">${escapeHTML(item.name)}</span>`).join('');
    const extra = list.length > 2 ? `<span class="more-events">+ ${list.length - 2} autre${list.length > 3 ? 's' : ''}</span>` : '';
    cells.push(`<button class="calendar-day${date === state.today ? ' today' : ''}" data-calendar-day="${date}"><span class="calendar-date">${day}</span>${row ? `<strong class="calendar-amount">${money(row.available_cents)}</strong>` : ''}${items}${extra}</button>`);
  }
  $('#calendarGrid').innerHTML = cells.join('');
  $$('[data-calendar-day]').forEach(button => button.addEventListener('click', () => showDay(button.dataset.calendarDay)));
}

function showDay(date) {
  const days = calendarPayload?.state?.forecast?.days || state.forecast.days;
  const day = days.find(item => item.date === date) || state.forecast.days.find(item => item.date === date);
  $('#dayDialogEyebrow').textContent = prettyDate(date).toUpperCase();
  $('#dayDialogTitle').textContent = day ? `Disponible prévu : ${money(day.available_cents)}` : 'Aperçu de la journée';
  const fromCalendar = calendarPayload?.occurrences?.filter(item => item.date === date) || [];
  const events = [...(day?.events || []), ...fromCalendar.filter(item => !(day?.events || []).some(existing => existing.id === item.id))];
  const limits = day?.limits || [];
  $('#dayDialogContent').innerHTML = [
    ...events.map(item => `<div class="day-detail"><span>${escapeHTML(item.name)}<small>${item.type === 'income' ? 'Revenu prévu' : item.type === 'pending_bill' ? 'Facture échue, à confirmer' : 'Facture ou mouvement prévu'}${item.adjusted ? ' · date déplacée' : ''}</small>${item.recurring_id ? `<button class="text-button" data-edit-occurrence="${item.recurring_id}" data-due-date="${item.rawDate || item.date}" data-event-date="${item.date}" data-amount="${Math.abs(item.amount_cents)}" data-name="${escapeHTML(item.name)}">Modifier cette occurrence</button>${item.date <= state.today ? `<button class="text-button" data-pay-occurrence="${item.recurring_id}" data-due-date="${item.rawDate || item.date}" data-amount="${Math.abs(item.amount_cents)}" data-name="${escapeHTML(item.name)}">Saisir comme payé</button>` : ''}` : ''}</span><strong class="${item.amount_cents >= 0 ? 'amount-positive' : 'amount-negative'}">${item.amount_cents >= 0 ? '+' : '−'}${absMoney(item.amount_cents)}</strong></div>`),
    ...limits.filter(item => item.reserve_cents).map(item => `<div class="day-detail"><span>${escapeHTML(item.name)}<small>Réserve de limite active</small></span><strong>− ${money(item.reserve_cents)}</strong></div>`),
    !events.length && !limits.length ? '<p class="subtle">Aucun mouvement ou réserve à cette date.</p>' : ''
  ].join('');
  $$('[data-edit-occurrence]', $('#dayDialogContent')).forEach(button => button.addEventListener('click', () => {
    openOccurrenceEditor({ recurring_id: Number(button.dataset.editOccurrence), due_date: button.dataset.dueDate, date: button.dataset.eventDate, amount_cents: Number(button.dataset.amount), name: button.dataset.name });
  }));
  $$('[data-pay-occurrence]', $('#dayDialogContent')).forEach(button => button.addEventListener('click', async () => {
    if (!confirm(`Saisir « ${button.dataset.name} » comme payé aujourd’hui ?`)) return;
    try {
      await api(`/occurrences/${button.dataset.payOccurrence}/${button.dataset.dueDate}/pay`, { method: 'POST', body: JSON.stringify({ amount_cents: Number(button.dataset.amount), date: state.today }) });
      $('#dayDialog').close();
      toast('Mouvement enregistré une seule fois.');
      await loadState();
    } catch (error) { toast(error.message); }
  }));
  $('#dayDialog').showModal();
}

function openOccurrenceEditor(item) {
  editing = { type: 'occurrence', item };
  $('#editorEyebrow').textContent = 'EXCEPTION';
  $('#editorTitle').textContent = item.name;
  $('#deleteItem').hidden = false;
  $('#editorFields').innerHTML = `<label>Montant de cette occurrence<input name="amount" required inputmode="decimal" value="${inputMoney(item.amount_cents)}"></label><label>Date de cette occurrence<input name="moved_to" required type="date" value="${item.date}"></label><label class="full">État<select name="state">${option('changed', 'changed', 'Prévue avec cette modification')}${option('skipped', '', 'Ignorer cette occurrence')}</select></label><p class="field-note">Seule cette occurrence est changée. La règle régulière reste intacte.</p>`;
  $('#dayDialog').close();
  $('#editorDialog').showModal();
}

function option(value, selected, label) { return `<option value="${value}"${String(value) === String(selected) ? ' selected' : ''}>${label}</option>`; }
function commonFrequency(selected) { return `<select name="frequency">${option('weekly', selected, 'Chaque semaine')}${option('biweekly', selected, 'Aux 2 semaines')}${option('monthly', selected, 'Chaque mois')}${option('twice_monthly', selected, '2 fois par mois')}${option('quarterly', selected, 'Aux 3 mois')}${option('semiannual', selected, 'Aux 6 mois')}${option('yearly', selected, 'Chaque année')}</select>`; }
function commonAdjustment(selected) { return `<select name="adjustment">${option('none', selected, 'Ne pas déplacer')}${option('previous', selected, 'Jour ouvrable précédent')}${option('next', selected, 'Jour ouvrable suivant')}</select>`; }
function commonDateMode(selected) { return `<select name="date_mode">${option('anchor', selected, 'Jour choisi')}${option('last_day', selected, 'Dernier jour du mois')}${option('last_business_day', selected, 'Dernier jour ouvrable du mois')}</select>`; }

function openEditor(type, item = null, preset = {}) {
  editing = { type, item };
  const form = $('#editorForm');
  const fields = $('#editorFields');
  const title = item ? 'Modifier' : 'Ajouter';
  $('#editorEyebrow').textContent = title.toUpperCase();
  $('#deleteItem').hidden = !item;
  if (type === 'transaction') {
    $('#editorTitle').textContent = item ? 'Modifier la transaction' : 'Nouvelle transaction';
    const limits = '<option value="">Sans limite</option>' + state.limit_config.map(limit => `<option value="${limit.id}"${Number(item?.limit_id) === limit.id ? ' selected' : ''}>${escapeHTML(limit.name)}</option>`).join('');
    fields.innerHTML = `<label>Type<select name="kind">${option('expense', item?.amount_cents >= 0 ? 'income' : 'expense', 'Dépense')}${option('income', item?.amount_cents >= 0 ? 'income' : 'expense', 'Revenu')}</select></label><label>Montant<input name="amount" required inputmode="decimal" value="${item ? inputMoney(item.amount_cents) : ''}" placeholder="0,00"></label><label class="full">Description<input name="description" required maxlength="80" value="${escapeHTML(item?.description || '')}" placeholder="ex. IGA"></label><label>Date<input name="date" required type="date" value="${item?.date || state.today}"></label><label>Limite<select name="limit_id">${limits}</select></label><p class="field-note">Un achat dans une limite diminue le solde réel et consomme la réserve correspondante : il n’est pas compté deux fois.</p>`;
  } else if (type === 'recurring') {
    $('#editorTitle').textContent = item ? 'Modifier la récurrence' : 'Nouvelle récurrence';
    const recurringKind = item?.kind || preset.kind || 'income';
    fields.innerHTML = `<label>Type<select name="kind">${option('income', recurringKind, 'Revenu')}${option('bill', recurringKind, 'Facture')}</select></label><label>Montant<input name="amount" required inputmode="decimal" value="${item ? inputMoney(item.amount_cents) : ''}" placeholder="0,00"></label><label class="full">Nom<input name="name" required maxlength="80" value="${escapeHTML(item?.name || '')}" placeholder="ex. Paie Alex ou Bell"></label><label>Fréquence${commonFrequency(item?.frequency || 'monthly')}</label><label>Échéance mensuelle${commonDateMode(item?.date_mode || 'anchor')}</label><label>Date de départ<input name="anchor_date" required type="date" value="${item?.anchor_date || state.today}"></label><label>Deuxième jour (si 2 fois/mois)<input name="second_day" type="number" min="1" max="31" value="${item?.second_day || 15}"></label><label>Si week-end ou férié${commonAdjustment(item?.adjustment || 'none')}</label><p class="field-note">Pour la Rente RRQ, choisis « dernier jour ouvrable du mois ». Le déplacement sera affiché dans le calendrier.</p>`;
  } else {
    $('#editorTitle').textContent = item ? 'Modifier la limite' : 'Nouvelle limite';
    fields.innerHTML = `<label class="full">Nom<input name="name" required maxlength="80" value="${escapeHTML(item?.name || '')}" placeholder="ex. Épicerie"></label><label>Montant à protéger<input name="amount" required inputmode="decimal" value="${item ? inputMoney(item.amount_cents) : ''}" placeholder="0,00"></label><label>Quand la protéger${commonFrequency(item?.frequency || 'weekly')}</label><label>Échéance mensuelle${commonDateMode(item?.date_mode || 'anchor')}</label><label>Première protection<input name="anchor_date" required type="date" value="${item?.anchor_date || state.today}"></label><label>Deuxième jour (si 2 fois/mois)<input name="second_day" type="number" min="1" max="31" value="${item?.second_day || 15}"></label><label>Si week-end ou férié${commonAdjustment(item?.adjustment || 'none')}</label><label>Mode de budget<select name="mode">${option('period', item?.mode || 'period', 'Montant strict par période')}${option('monthly_flexible', item?.mode || 'period', 'Budget mensuel, libéré par période')}</select></label><p class="field-note">« Budget mensuel, libéré par période » convient à l’épicerie : 225 $ se protège chaque jeudi, sans réserver le mois au complet d’avance. Le total se remet à zéro le mois suivant.</p>`;
  }
  $('#editorDialog').showModal();
  setTimeout(() => $('input,select', fields)?.focus(), 0);
}

function payloadFromEditor() {
  const data = new FormData($('#editorForm'));
  const type = editing.type;
  if (type === 'transaction') return { kind: data.get('kind'), amount_cents: parseMoney(data.get('amount')), description: data.get('description'), date: data.get('date'), limit_id: data.get('limit_id') || null };
  if (type === 'occurrence') return { amount_cents: parseMoney(data.get('amount')), moved_to: data.get('moved_to'), state: data.get('state') };
  if (type === 'recurring') return { kind: data.get('kind'), amount_cents: parseMoney(data.get('amount')), name: data.get('name'), frequency: data.get('frequency'), date_mode: data.get('date_mode'), anchor_date: data.get('anchor_date'), second_day: Number(data.get('second_day')), adjustment: data.get('adjustment') };
  return { name: data.get('name'), amount_cents: parseMoney(data.get('amount')), frequency: data.get('frequency'), date_mode: data.get('date_mode'), anchor_date: data.get('anchor_date'), second_day: Number(data.get('second_day')), adjustment: data.get('adjustment'), mode: data.get('mode') };
}

async function saveEditor(event) {
  event.preventDefault();
  try {
    const item = editing.item;
    const type = editing.type;
    const path = type === 'occurrence' ? `/occurrences/${item.recurring_id}/${item.due_date}` : `/${type === 'transaction' ? 'transactions' : type === 'recurring' ? 'recurring' : 'limits'}${item ? `/${item.id}` : ''}`;
    await api(path, { method: item ? 'PUT' : 'POST', body: JSON.stringify(payloadFromEditor()) });
    $('#editorDialog').close();
    toast(item ? 'Modification enregistrée.' : 'Ajouté au budget.');
    await loadState();
    if (guideResume !== null) {
      const next = guideResume;
      guideResume = null;
      openGuide(next);
    }
  } catch (error) { toast(error.message); }
}

async function deleteEditor() {
  if (!editing?.item || !confirm(`Supprimer « ${editing.item.name || editing.item.description} » ?`)) return;
  try {
    const path = editing.type === 'occurrence' ? `/occurrences/${editing.item.recurring_id}/${editing.item.due_date}` : `/${editing.type === 'transaction' ? 'transactions' : editing.type === 'recurring' ? 'recurring' : 'limits'}/${editing.item.id}`;
    await api(path, { method: 'DELETE' });
    $('#editorDialog').close();
    toast('Élément supprimé.');
    await loadState();
  } catch (error) { toast(error.message); }
}

function go(route) {
  if (!state?.settings.configured) return;
  const allowed = ['today', 'transactions', 'recurring', 'limits', 'calendar', 'settings'];
  const page = allowed.includes(route) ? route : 'today';
  $$('.page').forEach(section => section.classList.toggle('active', section.dataset.page === page));
  $$('[data-route]').forEach(button => button.classList.toggle('active', button.dataset.route === page));
  location.hash = page === 'today' ? '' : page;
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('#moreDialog')?.close();
}

function bind() {
  $$('[data-route]').forEach(button => button.addEventListener('click', () => go(button.dataset.route)));
  $('#quickAdd').addEventListener('click', () => openEditor('transaction'));
  $('#mobileQuickAdd').addEventListener('click', () => openEditor('transaction'));
  $('#mobileMore').addEventListener('click', () => $('#moreDialog').showModal());
  $('#openGuide').addEventListener('click', () => openGuide(0));
  $('#guideDismiss').addEventListener('click', () => $('#guideDialog').close());
  $('#guideLater').addEventListener('click', () => $('#guideDialog').close());
  $('#guideBack').addEventListener('click', () => { guideStep = Math.max(0, guideStep - 1); renderGuide(); });
  $('#guideNext').addEventListener('click', async () => {
    if (guideStep < 3) {
      guideStep += 1;
      renderGuide();
      return;
    }
    try {
      await api('/settings', { method: 'PUT', body: JSON.stringify({ onboarding_complete: true }) });
      $('#guideDialog').close();
      toast('Configuration guidée terminée. Tu peux toujours rouvrir le guide dans Réglages.');
      await loadState();
    } catch (error) { toast(error.message); }
  });
  $$('[data-open-editor]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.openEditor)));
  $('#purchaseButton').addEventListener('click', () => { $('#purchaseForm [name=date]').value = state.today; $('#purchaseResult').hidden = true; $('#purchaseDialog').showModal(); });
  $('#themeButton').addEventListener('click', () => go('settings'));
  $('#transactionSearch').addEventListener('input', renderTransactions);
  $('#quickTransactionForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      await api('/transactions', { method: 'POST', body: JSON.stringify({ kind: data.get('kind'), amount_cents: parseMoney(data.get('amount')), description: data.get('description'), date: data.get('date'), limit_id: data.get('limit_id') || null }) });
      event.currentTarget.reset(); event.currentTarget.date.value = state.today; toast('Transaction enregistrée.'); await loadState();
    } catch (error) { toast(error.message); }
  });
  $('#editorForm').addEventListener('submit', saveEditor);
  $('#cancelEditor').addEventListener('click', () => $('#editorDialog').close());
  $('#deleteItem').addEventListener('click', deleteEditor);
  $('#setupForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      await api('/setup', { method: 'POST', body: JSON.stringify({ balance_cents: parseMoney(data.get('balance')), date: data.get('date'), owner_name: data.get('owner_name') }) });
      toast('Point de départ enregistré. Ajoute maintenant tes revenus, factures et limites.');
      await loadState();
      go('recurring');
    } catch (error) { toast(error.message); }
  });
  $('#balanceForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      await api('/settings', { method: 'PUT', body: JSON.stringify({ balance_cents: parseMoney(data.get('balance')), balance_verified_on: data.get('date') }) });
      toast('Solde vérifié.'); await loadState();
    } catch (error) { toast(error.message); }
  });
  $$('#themeChoices button').forEach(button => button.addEventListener('click', async () => {
    try { await api('/settings', { method: 'PUT', body: JSON.stringify({ theme: button.dataset.theme }) }); await loadState(); } catch (error) { toast(error.message); }
  }));
  $('#purchaseForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      const result = await api('/check-purchase', { method: 'POST', body: JSON.stringify({ amount_cents: parseMoney(data.get('amount')), date: data.get('date') }) });
      const target = $('#purchaseResult');
      target.hidden = false; target.classList.toggle('no', !result.can_afford);
      target.innerHTML = result.can_afford ? `Oui. Le point le plus bas resterait à <strong>${money(result.minimum_cents)}</strong>, le ${escapeHTML(prettyDate(result.minimum_date).toLowerCase())}.` : `Non. Cet achat ferait descendre le disponible à <strong>${money(result.minimum_cents)}</strong>, le ${escapeHTML(prettyDate(result.minimum_date).toLowerCase())}.`;
    } catch (error) { toast(error.message); }
  });
  $('#previousMonth').addEventListener('click', () => { const [y, m] = calendarMonth.split('-').map(Number); calendarMonth = new Date(y, m - 2, 1).toLocaleDateString('en-CA').slice(0, 7); loadCalendar().catch(error => toast(error.message)); });
  $('#nextMonth').addEventListener('click', () => { const [y, m] = calendarMonth.split('-').map(Number); calendarMonth = new Date(y, m, 1).toLocaleDateString('en-CA').slice(0, 7); loadCalendar().catch(error => toast(error.message)); });
}

window.addEventListener('hashchange', () => go(location.hash.slice(1) || 'today'));
bind();
loadState().then(() => {
  $('#quickTransactionForm [name=date]').value = state?.today || localToday();
  if (state?.settings.configured && location.hash) go(location.hash.slice(1));
}).catch(error => { document.body.innerHTML = `<main class="onboarding"><h1>Impossible d’ouvrir Le Bas de Laine</h1><p>${escapeHTML(error.message)}</p></main>`; });
