'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const atelier = {
  data: null, view: 'today', selectedDay: 0, transactionQuery: '',
  transactionKind: '', transactionMonth: null, transactionCategory: '', month: null,
  calendar: null, calendarDay: null
};

const money = cents => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format((Number(cents) || 0) / 100);
const moneyInput = value => (Number(value || 0) / 100).toFixed(2).replace('.', ',');
const day = value => new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00Z`));
const monthLabel = value => new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00Z`));
const escape = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&gt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
const cap = (value, min, max) => Math.max(min, Math.min(max, value));

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('bas-de-laine-theme', theme);
  const button = $('#atelier-theme');
  if (button) {
    button.textContent = theme === 'dark' ? 'Clair' : 'Sombre';
    button.setAttribute('aria-label', theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre');
  }
}

function initialiseTheme() {
  const stored = localStorage.getItem('bas-de-laine-theme');
  applyTheme(stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
}

async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const result = await response.json();
  if (!response.ok || result.error) throw Error(result.error || 'Une erreur est survenue.');
  return result;
}

function toast(message) {
  const node = $('#atelier-toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3600);
}

function checkpointCopy(data) {
  const age = data.settings?.checkpointAge;
  if (age === 0) return 'Solde vérifié aujourd’hui';
  if (age === undefined || age === null) return 'Vérifier le solde';
  return `Solde vérifié il y a ${age} jour${age > 1 ? 's' : ''}`;
}

function categoryName(id) { return atelier.data.categories.find(category => category.id === id)?.name || 'Sans catégorie'; }
function signed(amount, kind) { return `${kind === 'income' ? '+' : '−'}${money(Math.abs(amount))}`; }
function nextLimit(category) {
  const event = (category.periods || []).find(period => period.date > atelier.data.today) || category.next_period;
  if (!event) return 'Aucun renouvellement prévu';
  return category.funding === 'income' ? `À couvrir avant ${day(event.date || event)}` : `Renouvelle ${day(event.date || event)}`;
}
function limitTotal(category) { return category.mode === 'monthly_weekly' ? category.month_budget : category.amount; }
function limitRemaining(category) { return category.mode === 'monthly_weekly' ? category.month_remaining : category.reserve; }
function frequencyLabel(value) { return ({ w: 'Chaque semaine', b: 'Aux 2 semaines', m: 'Chaque mois', a: 'Chaque année' })[value] || 'Chaque mois'; }
function kindLabel(value) { return ({ income: 'Revenu', expense: 'Facture', card_payment: 'Paiement de carte' })[value] || 'Opération'; }
function empty(copy = 'Aucune donnée pour le moment.') { return `<div class="empty-state"><span>${escape(copy)}</span></div>`; }

async function refresh({ keepCalendar = false } = {}) {
  atelier.data = await api('/api/state');
  atelier.month ||= atelier.data.today.slice(0, 7);
  atelier.transactionMonth ??= atelier.data.today.slice(0, 7);
  if (!keepCalendar) atelier.calendar = null;
  $('#atelier-checkpoint').textContent = checkpointCopy(atelier.data);
  render();
}

function viewHead(kicker, title, copy, tools = '') {
  return `<header class="view-head"><div><div class="kicker">${escape(kicker)}</div><h1>${escape(title)}</h1>${copy ? `<p>${escape(copy)}</p>` : ''}</div>${tools ? `<div class="tools">${tools}</div>` : ''}</header>`;
}

function forecastSvg(days, selectedIndex) {
  const values = days.map(item => item.safe);
  const low = Math.min(...values), high = Math.max(...values), range = Math.max(1, high - low);
  const positions = values.map((value, index) => ({ x: 3 + (index / Math.max(1, values.length - 1)) * 94, y: 88 - ((value - low) / range) * 70 }));
  const points = positions.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const selected = positions[selectedIndex] || positions[0];
  const markers = days.flatMap((item, index) => [
    ...(item.events || []).map((event, offset) => `<circle class="marker-${event.kind === 'income' ? 'income' : 'expense'}" cx="${cap(positions[index].x + (offset - .5) * 2.2, 2, 98).toFixed(2)}" cy="${positions[index].y.toFixed(2)}" r="1.85"><title>${escape(event.name)}</title></circle>`),
    ...(item.limitEvents || []).map((event, offset) => `<rect class="marker-limit" x="${cap(positions[index].x + ((item.events || []).length + offset - .5) * 2.2, 2, 98).toFixed(2)}" y="${(positions[index].y - 1.65).toFixed(2)}" width="3.3" height="3.3"><title>${escape(event.name)}</title></rect>`)
  ]).join('');
  return `<svg class="forecast-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Prévision du disponible"><line class="axis" x1="0" y1="90" x2="100" y2="90"/><line class="selected-axis" x1="${selected.x}" y1="8" x2="${selected.x}" y2="90"/><path class="forecast-area" d="M3 90 L${points.replaceAll(' ', ' L')} L97 90 Z"/><polyline class="forecast-line" points="${points}"/>${markers}<circle class="marker-selected" cx="${selected.x}" cy="${selected.y}" r="2.9"/></svg>`;
}

function eventText(event) { return event.kind === 'income' ? 'Revenu prévu' : 'Facture prévue'; }
function todayStory(item) {
  const previous = atelier.data.daily[item.index - 1];
  const delta = previous ? item.day.safe - previous.safe : 0;
  const changes = [
    ...(item.day.events || []).map(event => `${event.name} · ${signed(event.amount, event.kind)}`),
    ...(item.day.limitEvents || []).map(event => `${event.name} · ${money(event.amount)}`)
  ];
  const copy = changes.length ? changes.join(' · ') : 'Aucun mouvement prévu à cette date.';
  return `<div class="selected-story"><div class="selected-date">${escape(day(item.day.date))}</div><div><b>${money(item.day.safe)} ${delta ? `· ${delta > 0 ? '+' : '−'}${money(Math.abs(delta))} depuis hier` : '· point de départ'}</b><p>${escape(copy)}</p></div></div>`;
}

function plainLimitRow(category) {
  const total = limitTotal(category);
  const remaining = limitRemaining(category);
  const ratio = total ? cap(remaining / total * 100, 0, 100) : 0;
  return `<button class="plain-row row-button" type="button" data-edit-limit="${category.id}"><div><b>${escape(category.name)}</b><small>${money(remaining)} restant · ${escape(nextLimit(category))}</small><div class="track"><i style="width:${ratio}%"></i></div></div><strong>${money(total)}</strong></button>`;
}

function plainEventRow(event) {
  return `<button class="plain-row row-button" type="button" data-open-occurrence="${event.rid}|${event.due}"><div><b>${escape(event.name)}</b><small>${escape(day(event.due))} · ${eventText(event)}</small></div><strong class="${event.kind === 'income' ? 'positive' : 'negative'}">${signed(event.amount, event.kind)}</strong></button>`;
}

function renderWelcome() {
  $('#atelier-view').innerHTML = `${viewHead('Bienvenue', 'Mettons de l’ordre', 'Quatre petites étapes suffisent pour obtenir un disponible fiable.')}
    <section class="welcome-grid"><div><span>01</span><h2>Le solde</h2><p>Commencez par le montant qui apparaît dans le compte conjoint aujourd’hui.</p><button class="add" type="button" data-open="setup">Commencer</button></div><div><span>02</span><h2>Les revenus</h2><p>Ajoutez ensuite les paies, la RRQ ou les allocations dans le Plan.</p></div><div><span>03</span><h2>Les factures</h2><p>Inscrivez seulement les sommes qui reviennent réellement.</p></div><div><span>04</span><h2>Les limites</h2><p>Épicerie, essence et le reste : l’application les protégera pour vous.</p></div></section>`;
}

function renderToday() {
  const data = atelier.data;
  if (!data.settings.setupComplete) return renderWelcome();
  const days = data.daily.slice(0, 30);
  const selectedIndex = cap(atelier.selectedDay, 0, Math.max(0, days.length - 1));
  atelier.selectedDay = selectedIndex;
  const chosen = { day: days[selectedIndex], index: selectedIndex };
  const upcoming = data.upcoming.slice(0, 5);
  const limits = [...data.categories].filter(category => limitTotal(category) > 0).sort((a, b) => limitRemaining(a) - limitRemaining(b)).slice(0, 4);
  const highPriority = upcoming.slice(0, 4).map(event => `<li><time>${escape(day(event.due))}</time><b>${escape(event.name)}</b><span>${eventText(event)}</span><strong class="${event.kind === 'income' ? 'positive' : 'negative'}">${signed(event.amount, event.kind)}</strong></li>`).join('') || '<li><span>Aucun mouvement prochain.</span></li>';
  const limitsRows = limits.map(category => plainLimitRow(category)).join('') || empty();
  const eventRows = upcoming.map(event => plainEventRow(event)).join('') || empty();
  $('#atelier-view').innerHTML = `${viewHead('Prévision vivante', 'Votre marge', 'La seule question qui compte : quel est votre point le plus bas ?', '<button class="quiet" type="button" data-open="afford">Puis-je acheter ?</button>')}
    <section class="runway">
      <section class="margin-column"><span class="metric-label">Point bas · 30 jours</span><div class="margin-value">${money(data.safe30.safe)}</div><span class="margin-copy">Prévu le ${escape(day(data.safe30.date))}. Ce montant inclut factures, cartes et limites.</span><div class="margin-stack"><div><small>Disponible aujourd’hui</small><b>${money(data.current.safe)}</b></div><div><small>Avant le prochain revenu</small><b>${money(data.safeUntilIncome.safe)}</b></div><div><small>Prochaine paie</small><b>${data.nextIncome ? escape(data.nextIncome.name) : '—'}</b></div></div></section>
      <section class="forecast-stage"><header><h2>La trajectoire des 30 jours</h2><span>Déplacez le repère pour lire une journée</span></header>${forecastSvg(days, selectedIndex)}<div class="forecast-control"><input id="atelier-day" type="range" min="0" max="${Math.max(0, days.length - 1)}" value="${selectedIndex}"><div><span>${escape(day(chosen.day.date))}</span><b>${money(chosen.day.safe)}</b></div></div>${todayStory(chosen)}</section>
      <aside class="signal-column"><span class="aside-title">Les prochains mouvements</span><ol class="signal-list">${highPriority}</ol></aside>
    </section>
    <section class="today-ledger"><article class="plain-section"><header><h2>Limites</h2><a href="#" data-view-link="plan">Voir tout le plan</a></header>${limitsRows}</article><article class="plain-section"><header><h2>À venir</h2><a href="#" data-view-link="calendar">Ouvrir le calendrier</a></header>${eventRows}</article></section>`;
}

function renderTransactions() {
  const query = atelier.transactionQuery.trim().toLocaleLowerCase('fr-CA');
  const kind = atelier.transactionKind;
  const month = atelier.transactionMonth;
  const category = atelier.transactionCategory;
  const rows = [...atelier.data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).filter(transaction => {
    const haystack = `${transaction.description} ${categoryName(transaction.category_id)}`.toLocaleLowerCase('fr-CA');
    return (!query || haystack.includes(query))
      && (!kind || transaction.kind === kind)
      && (!month || transaction.date.startsWith(month))
      && (!category || Number(transaction.category_id) === Number(category));
  });
  const income = rows.filter(transaction => transaction.kind === 'income').reduce((sum, transaction) => sum + transaction.amount, 0);
  const outflow = rows.filter(transaction => transaction.kind !== 'income').reduce((sum, transaction) => sum + transaction.amount, 0);
  $('#atelier-view').innerHTML = `${viewHead('Registre', 'Transactions', 'Une ligne par mouvement. Touchez une ligne pour la corriger.', '<button class="add" type="button" data-open="transaction">Ajouter une transaction</button>')}
    <section class="ledger-tools"><input id="atelier-search" placeholder="Rechercher un commerçant ou une catégorie" value="${escape(atelier.transactionQuery)}"><input id="atelier-transaction-month" aria-label="Mois" type="month" value="${escape(month || '')}"><select id="atelier-kind"><option value="">Toutes les opérations</option><option value="expense" ${kind === 'expense' ? 'selected' : ''}>Dépenses</option><option value="income" ${kind === 'income' ? 'selected' : ''}>Revenus</option><option value="card_payment" ${kind === 'card_payment' ? 'selected' : ''}>Paiements de carte</option></select><select id="atelier-category-filter"><option value="">Toutes les catégories</option>${categoryOptions(category, false)}</select><button class="tool" type="button" data-clear-transaction-filters>Tout</button><button class="tool" type="button" data-open="merchant-rules">Règles</button></section>
    <table class="ledger-table"><thead><tr><th>Date</th><th>Commerçant</th><th>Catégorie</th><th>Compte</th><th>Montant</th></tr></thead><tbody>${rows.length ? rows.map(transaction => `<tr tabindex="0" role="button" data-edit-transaction="${transaction.id}"><td class="subtle">${escape(day(transaction.date))}</td><td><span class="merchant">${escape(transaction.description || (transaction.kind === 'income' ? 'Revenu' : 'Sans description'))}</span></td><td><span class="tag">${escape(transaction.kind === 'expense' ? categoryName(transaction.category_id) : '—')}</span></td><td class="subtle">${transaction.method === 'card' ? 'Carte' : 'Conjoint'}</td><td class="${transaction.kind === 'income' ? 'positive' : 'negative'}"><b>${signed(transaction.amount, transaction.kind)}</b></td></tr>`).join('') : `<tr><td colspan="5">${empty()}</td></tr>`}</tbody></table>
    <footer class="ledger-foot"><span>Entrées <b class="positive">${money(income)}</b></span><span>Sorties <b class="negative">${money(outflow)}</b></span><span>Net <b class="${income - outflow >= 0 ? 'positive' : 'negative'}">${income - outflow >= 0 ? '+' : '−'}${money(Math.abs(income - outflow))}</b></span></footer>`;
}

function stream(title, ruleset, className, emptyText, kind) {
  return `<section class="stream"><header><h2>${title}</h2><span>${ruleset.length} règle${ruleset.length > 1 ? 's' : ''}</span><button class="small-add" type="button" data-open="recurring" data-rule-kind="${kind}">+</button></header>${ruleset.length ? ruleset.map(rule => {
    const next = atelier.data.upcoming.find(event => event.rid === rule.id);
    return `<button class="stream-row row-button" type="button" data-edit-rule="${rule.id}"><div><b>${escape(rule.name)}</b><small>${escape(next ? `${day(next.due)} · ` : '')}${frequencyLabel(rule.frequency)}</small></div><strong class="${className}">${signed(rule.amount, rule.kind)}</strong></button>`;
  }).join('') : `<div class="empty-state"><span>${emptyText}</span></div>`}</section>`;
}

function renderPlan() {
  const rules = atelier.data.recurring;
  const limits = atelier.data.categories.filter(category => limitTotal(category) > 0);
  const limitStream = `<section class="stream"><header><h2>Limites</h2><span>${limits.length} active${limits.length > 1 ? 's' : ''}</span><button class="small-add" type="button" data-open="limit">+</button></header>${limits.length ? limits.map(category => plainLimitRow(category)).join('') : `<div class="empty-state"><span>Ajoutez votre première limite.</span></div>`}</section>`;
  $('#atelier-view').innerHTML = `${viewHead('Les règles de l’argent', 'Plan', 'Ce qui entre, ce qui sort et ce qui est protégé.')}
    <div class="plan-streams">${stream('Revenus', rules.filter(rule => rule.kind === 'income'), 'positive', 'Ajoutez une paie, rente ou allocation.', 'income')}${stream('Factures', rules.filter(rule => rule.kind === 'expense'), 'negative', 'Ajoutez vos factures récurrentes.', 'expense')}${limitStream}</div>`;
}

async function renderBudget() {
  $('#atelier-view').innerHTML = viewHead('Le mois', 'Budget', 'Prévu, dépensé, restant.') + empty('Préparation du budget…');
  try {
    const budget = await api(`/api/budget?month=${encodeURIComponent(atelier.month)}`);
    if (atelier.view !== 'budget') return;
    const remaining = budget.income - budget.fixed - budget.variable;
    const categories = [...budget.categories].sort((a, b) => (b.planned ? b.spent / b.planned : 0) - (a.planned ? a.spent / a.planned : 0));
    $('#atelier-view').innerHTML = `${viewHead('Le mois', 'Budget', monthLabel(budget.month), '<button class="tool" type="button" data-month="prev">←</button><button class="tool" type="button" data-month="next">→</button>')}
      <section class="budget-summary"><div><small>Revenus prévus</small><b class="positive">${money(budget.income)}</b></div><div><small>Planifié</small><b>${money(budget.fixed + budget.variable)}</b></div><div><small>Reste du plan</small><b class="${remaining >= 0 ? 'positive' : 'negative'}">${money(remaining)}</b></div></section>
      <table class="budget-grid"><thead><tr><th>Catégorie</th><th>Budget</th><th>Dépensé</th><th>Restant</th></tr></thead><tbody>${categories.length ? categories.map(category => { const ratio = category.planned ? category.spent / category.planned : 0; const style = category.remaining < 0 ? 'over' : ratio >= .8 ? 'warn' : ''; const status = category.remaining < 0 ? ['over', 'Dépassement'] : ratio >= .8 ? ['watch', 'À surveiller'] : ['good', 'En bonne voie']; return `<tr tabindex="0" role="button" data-edit-limit="${category.id}"><td><span class="budget-name">${escape(category.name)}</span><span class="budget-note">${Math.round(ratio * 100)} % utilisé</span><span class="budget-status ${status[0]}">${status[1]}</span><div class="budget-bar ${style}"><i style="width:${cap(ratio * 100, 0, 100)}%"></i></div></td><td>${money(category.planned)}</td><td>${money(category.spent)}</td><td class="${category.remaining >= 0 ? 'positive' : 'negative'}"><b>${money(category.remaining)}</b></td></tr>`; }).join('') : `<tr><td colspan="4">${empty()}</td></tr>`}</tbody></table>`;
  } catch (error) { $('#atelier-view').innerHTML = viewHead('Le mois', 'Budget', '') + empty(error.message); }
}

function calendarEntries(item) { return [...item.transactions, ...item.events, ...item.limitEvents]; }
function calendarDayDetails(item) {
  if (!item) return '';
  const entries = calendarEntries(item);
  return `<section class="day-detail"><header><div><span class="kicker">${escape(day(item.date))}</span><h2>${item.safe === null ? 'Historique' : `Disponible : ${money(item.safe)}`}</h2></div><button class="quiet" type="button" data-close-calendar-detail>Fermer</button></header>${entries.length ? entries.map(entry => {
    const open = entry.rid ? `data-open-occurrence="${entry.rid}|${entry.due}"` : entry.id ? `data-edit-transaction="${entry.id}"` : entry.category_id ? `data-edit-limit="${entry.category_id}"` : '';
    const label = entry.name || entry.description || 'Limite';
    const type = entry.kind === 'income' ? 'positive' : entry.kind === 'expense' ? 'negative' : 'limit';
    const amount = entry.amount == null ? '' : (entry.kind ? signed(entry.amount, entry.kind) : money(entry.amount));
    return `<button class="detail-entry ${type}" type="button" ${open}><span><b>${escape(label)}</b><small>${entry.rid ? eventText(entry) : entry.id ? 'Transaction saisie' : 'Renouvellement de limite'}</small></span><strong>${amount}</strong></button>`;
  }).join('') : empty('Aucun mouvement cette journée.')}</section>`;
}

async function renderCalendar() {
  $('#atelier-view').innerHTML = viewHead('La ligne du mois', 'Calendrier', 'Prévu et réel, journée par journée.') + empty('Préparation du calendrier…');
  try {
    const calendar = await api(`/api/calendar?month=${encodeURIComponent(atelier.month)}`);
    if (atelier.view !== 'calendar') return;
    atelier.calendar = calendar;
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const selected = calendar.days.find(item => item.date === atelier.calendarDay);
    $('#atelier-view').innerHTML = `${viewHead('La ligne du mois', 'Calendrier', monthLabel(calendar.month), '<button class="tool" type="button" data-month="prev">←</button><button class="tool" type="button" data-month="next">→</button>')}
      <div class="calendar-bar"><b>Disponible prévu après la journée</b><span>Vert : revenu · rouge : facture · ocre : limite</span></div><div class="calendar-week">${days.map(label => `<span>${label}</span>`).join('')}</div><section class="calendar-grid">${calendar.days.map(item => { const entries = calendarEntries(item); const visible = entries.slice(0, 3); return `<button class="cal-day ${item.inMonth ? '' : 'outside'} ${item.date === atelier.data.today ? 'today' : ''}" type="button" data-calendar-day="${item.date}"><time>${Number(item.date.slice(-2))}${item.date === atelier.data.today ? '<span>Auj.</span>' : ''}</time><b class="cal-safe ${item.safe === null ? '' : item.safe < 0 ? 'negative' : 'positive'}">${item.safe === null ? '—' : money(item.safe)}</b>${visible.map(entry => `<span class="cal-event ${entry.kind === 'income' ? 'positive' : entry.kind === 'expense' ? 'negative' : 'limit'}">${escape(entry.name || entry.description)}</span>`).join('')}${entries.length > visible.length ? `<span class="cal-more">+ ${entries.length - visible.length} autres</span>` : ''}</button>`; }).join('')}</section>${calendarDayDetails(selected)}`;
  } catch (error) { $('#atelier-view').innerHTML = viewHead('La ligne du mois', 'Calendrier', '') + empty(error.message); }
}

function render() {
  if (!atelier.data) return;
  $$('.atelier-nav [data-view],.atelier-mobile-nav [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === atelier.view));
  if (atelier.view === 'today') return renderToday();
  if (atelier.view === 'transactions') return renderTransactions();
  if (atelier.view === 'plan') return renderPlan();
  if (atelier.view === 'budget') return renderBudget();
  if (atelier.view === 'calendar') return renderCalendar();
}

function shiftMonth(offset) {
  const base = new Date(`${atelier.month}-01T12:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + offset);
  atelier.month = base.toISOString().slice(0, 7);
  atelier.calendarDay = null;
  render();
}

function categoryOptions(selected = '', allowBlank = true) {
  return `${allowBlank ? '<option value="">Aucune</option>' : ''}${atelier.data.categories.map(category => `<option value="${category.id}" ${Number(selected) === category.id ? 'selected' : ''}>${escape(category.name)}</option>`).join('')}`;
}

function option(value, label, selected) { return `<option value="${escape(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escape(label)}</option>`; }
function formShell(kind, kicker, title, content, footer) {
  const modal = $('#atelier-modal');
  modal.innerHTML = `<form data-form="${kind}"><header><div><small>${escape(kicker)}</small><h2>${escape(title)}</h2></div><button class="close" value="cancel" formmethod="dialog" aria-label="Fermer">×</button></header><div class="form-grid">${content}</div><footer>${footer}</footer></form>`;
  modal.showModal();
}

function openTransaction(id = null) {
  const item = id ? atelier.data.transactions.find(transaction => transaction.id === Number(id)) : null;
  const tx = item || { kind: 'expense', amount: '', date: atelier.data.today, method: 'joint', description: '', category_id: '', included: 0 };
  const content = `<input type="hidden" name="id" value="${item ? item.id : ''}">
    <label>Type<select name="kind">${option('expense', 'Dépense', tx.kind)}${option('income', 'Revenu', tx.kind)}${option('card_payment', 'Paiement de carte', tx.kind)}</select></label>
    <label>Montant<input required name="amount" inputmode="decimal" value="${item ? moneyInput(tx.amount) : ''}" placeholder="0,00"></label>
    <label>Date<input required name="date" type="date" value="${escape(tx.date)}"></label>
    <label>Moyen<select name="method">${option('joint', 'Compte conjoint', tx.method)}${option('card', 'Carte de crédit', tx.method)}</select></label>
    <label class="wide">Description<input name="description" value="${escape(tx.description)}" placeholder="Ex. IGA, Hydro-Québec, Paie Alex"></label>
    <label class="wide">Catégorie / limite<select name="category_id">${categoryOptions(tx.category_id)}</select></label>
    <label class="check wide"><input type="checkbox" name="included" ${tx.included ? 'checked' : ''}> Déjà incluse dans le solde vérifié</label>
    <label class="check wide"><input type="checkbox" name="remember_rule"> Retenir ce commerçant pour la prochaine fois</label>`;
  const footer = `${item ? `<button class="danger-link" type="button" data-dialog-delete="transaction" data-id="${item.id}">Supprimer</button>` : ''}<span></span><button class="quiet" value="cancel" formmethod="dialog">Annuler</button><button class="add" type="submit">${item ? 'Enregistrer' : 'Ajouter'}</button>`;
  formShell('transaction', item ? 'Modifier une opération' : 'Nouvelle opération', item ? 'Corriger la transaction' : 'Inscrire une transaction', content, footer);
}

function openRecurring(id = null, preferredKind = 'expense') {
  const item = id ? atelier.data.recurring.find(rule => rule.id === Number(id)) : null;
  const rule = item || { kind: preferredKind, amount: '', frequency: 'm', anchor_date: atelier.data.today, adjustment: 'auto', method: 'joint', category_id: '' };
  const content = `<input type="hidden" name="id" value="${item ? item.id : ''}">
    <label class="wide">Nom<input required name="name" value="${escape(rule.name || '')}" placeholder="Ex. Paie Alex, Bell, Netflix"></label>
    <label>Type<select name="kind">${option('income', 'Revenu', rule.kind)}${option('expense', 'Facture', rule.kind)}</select></label>
    <label>Montant<input required name="amount" inputmode="decimal" value="${item ? moneyInput(rule.amount) : ''}" placeholder="0,00"></label>
    <label>Fréquence<select name="frequency">${option('w', 'Chaque semaine', rule.frequency)}${option('b', 'Aux 2 semaines', rule.frequency)}${option('m', 'Chaque mois', rule.frequency)}${option('a', 'Chaque année', rule.frequency)}</select></label>
    <label>Date de départ<input required name="anchor_date" type="date" value="${escape(rule.anchor_date)}"></label>
    <label>Si férié / week-end<select name="adjustment">${option('auto', 'Selon le type', rule.adjustment)}${option('prev', 'Jour ouvrable précédent', rule.adjustment)}${option('next', 'Jour ouvrable suivant', rule.adjustment)}${option('none', 'Ne pas déplacer', rule.adjustment)}${option('last', 'Dernier jour ouvrable', rule.adjustment)}</select></label>
    <label>Compte<select name="method">${option('joint', 'Compte conjoint', rule.method)}${option('card', 'Carte de crédit', rule.method)}</select></label>
    <label class="wide">Catégorie liée (facultatif)<select name="category_id">${categoryOptions(rule.category_id)}</select></label>`;
  const footer = `${item ? `<button class="danger-link" type="button" data-dialog-delete="recurring" data-id="${item.id}">Supprimer</button>` : ''}<span></span><button class="quiet" value="cancel" formmethod="dialog">Annuler</button><button class="add" type="submit">Enregistrer</button>`;
  formShell('recurring', item ? 'Modifier une règle' : 'Nouvelle règle', item ? 'Modifier la récurrence' : 'Planifier un revenu ou une facture', content, footer);
}

function openLimit(id = null) {
  const item = id ? atelier.data.categories.find(category => category.id === Number(id)) : null;
  const category = item || { name: '', mode: 'period', amount: '', frequency: 'w', renewal: '4', start_date: atelier.data.today, funding: 'start', monthly_four: '', monthly_five: '' };
  const content = `<input type="hidden" name="id" value="${item ? item.id : ''}">
    <label class="wide">Nom de la limite<input required name="name" value="${escape(category.name)}" placeholder="Ex. Épicerie"></label>
    <label>Organisation<select name="mode" data-limit-mode>${option('period', 'Par période', category.mode)}${option('monthly_weekly', 'Mois, réparti par semaine', category.mode)}</select></label>
    <label>Date de début<input required name="start_date" type="date" value="${escape(category.start_date || atelier.data.today)}"></label>
    <label class="period-only">Montant par période<input name="amount" inputmode="decimal" value="${category.mode === 'period' && item ? moneyInput(category.amount) : ''}" placeholder="0,00"></label>
    <label class="period-only">Période<select name="frequency" data-limit-frequency>${option('w', 'Chaque semaine', category.frequency)}${option('m', 'Chaque mois', category.frequency)}</select></label>
    <label class="renewal-field">Jour du renouvellement<select required name="renewal" data-limit-renewal data-current-renewal="${escape(category.renewal)}"></select></label>
    <label class="period-only monthly-funding">Protection<select name="funding">${option('start', 'Dès le départ', category.funding)}${option('income', 'Au prochain revenu', category.funding)}</select></label>
    <label class="monthly-only">Mois à 4 semaines<input name="monthly_four" inputmode="decimal" value="${category.mode === 'monthly_weekly' && item ? moneyInput(category.monthly_four) : ''}" placeholder="0,00"></label>
    <label class="monthly-only">Mois à 5 semaines<input name="monthly_five" inputmode="decimal" value="${category.mode === 'monthly_weekly' && item ? moneyInput(category.monthly_five) : ''}" placeholder="0,00"></label>
    <p class="form-note wide" data-limit-help>Choisissez le rythme et le jour : aucun numéro à retenir.</p>`;
  const footer = `${item ? `<button class="danger-link" type="button" data-dialog-delete="category" data-id="${item.id}">Supprimer</button>` : ''}<span></span><button class="quiet" value="cancel" formmethod="dialog">Annuler</button><button class="add" type="submit">Enregistrer</button>`;
  formShell('limit', item ? 'Modifier une limite' : 'Nouvelle limite', item ? 'Corriger la limite' : 'Ce montant sera protégé automatiquement', content, footer);
  updateLimitForm($('#atelier-modal form'));
}

function updateLimitForm(form) {
  const mode = $('[data-limit-mode]', form)?.value || 'period';
  const frequency = $('[data-limit-frequency]', form)?.value || 'w';
  $$('.period-only', form).forEach(node => { node.hidden = mode !== 'period'; });
  $$('.monthly-only', form).forEach(node => { node.hidden = mode !== 'monthly_weekly'; });
  $$('.monthly-funding', form).forEach(node => { node.hidden = mode !== 'period' || frequency !== 'm'; });
  const renewal = $('[data-limit-renewal]', form);
  const help = $('[data-limit-help]', form);
  const weekly = mode === 'monthly_weekly' || frequency === 'w';
  const current = renewal.value || renewal.dataset.currentRenewal || (weekly ? '4' : 'last');
  const days = [['0','Dimanche'],['1','Lundi'],['2','Mardi'],['3','Mercredi'],['4','Jeudi'],['5','Vendredi'],['6','Samedi']];
  const monthly = [['last','Dernier jour du mois'], ...Array.from({ length: 28 }, (_, index) => [String(index + 1), `Le ${index + 1}`])];
  const options = weekly ? days : monthly;
  renewal.innerHTML = options.map(([value, label]) => option(value, label, current === 'last' && weekly ? '4' : current)).join('');
  renewal.dataset.currentRenewal = renewal.value;
  help.textContent = weekly
    ? 'Le budget est renouvelé le jour choisi chaque semaine.'
    : 'Le budget est renouvelé chaque mois à cette date.';
}

function openSetup() {
  const content = `<p class="form-note wide">Vous pourrez corriger ce solde plus tard avec « Vérifier mon solde ». Rien n’est importé ou supprimé.</p><label class="wide">Solde actuel du compte conjoint<input required name="bank" inputmode="decimal" placeholder="0,00"></label><label class="check wide"><input type="checkbox" name="seed_limits" checked> Créer les limites de départ : épicerie, essence, lait et couches, pharmacie</label>`;
  formShell('setup', 'Configuration initiale', 'Votre point de départ', content, '<button class="quiet" value="cancel" formmethod="dialog">Plus tard</button><button class="add" type="submit">Continuer</button>');
}

function openCheckpoint() {
  const content = `<p class="form-note wide">Inscrivez le solde réellement affiché dans votre compte conjoint. Le calcul repartira de ce point.</p><label class="wide">Solde réel du compte<input required name="bank" inputmode="decimal" value="${moneyInput(atelier.data.current.cash)}"></label>`;
  formShell('checkpoint', 'Point de contrôle', 'Vérifier mon solde', content, '<button class="quiet" value="cancel" formmethod="dialog">Annuler</button><button class="add" type="submit">Vérifier</button>');
}

function openAfford() {
  const content = `<label>Date prévue<input required name="date" type="date" value="${escape(atelier.data.today)}"></label><label>Montant de l’achat<input required name="amount" inputmode="decimal" placeholder="0,00"></label><output class="afford-answer wide" id="atelier-afford-answer">Entrez la date et le montant. Le verdict tient compte des 30 jours suivants.</output>`;
  formShell('afford', 'Décision rapide', 'Puis-je faire cet achat ?', content, '<button class="quiet" value="cancel" formmethod="dialog">Fermer</button><button class="add" type="submit">Vérifier</button>');
}

function findOccurrence(key) {
  const [ridText, due] = String(key).split('|');
  const rid = Number(ridText);
  return (atelier.calendar?.days || []).flatMap(item => item.events).find(event => event.rid === rid && event.due === due) || atelier.data.upcoming.find(event => event.rid === rid && event.due === due) || null;
}

function openOccurrence(key) {
  const event = findOccurrence(key);
  if (!event) return toast('Cette échéance n’est plus disponible. Actualisez le calendrier.');
  const content = `<input type="hidden" name="recurring_id" value="${event.rid}"><input type="hidden" name="due_date" value="${escape(event.due)}"><p class="form-note wide"><b>${escape(event.name)}</b><br>${escape(day(event.due))} · ${eventText(event)}</p><label>Montant réel<input name="amount" inputmode="decimal" value="${moneyInput(event.amount)}"></label><label>Déplacer au<input id="atelier-move-date" type="date" value="${escape(event.due)}"></label>`;
  const footer = `<button class="danger-link" type="button" data-occurrence-state="skip">Ignorer</button><span></span><button class="quiet" type="button" data-occurrence-state="move">Déplacer</button><button class="add" type="submit">Marquer payé</button>`;
  formShell('occurrence', 'Échéance prévue', 'Qu’est-il arrivé ?', content, footer);
}

function openMerchantRules() {
  const rules = atelier.data.merchant_rules || [];
  const content = `<div class="merchant-rules wide">${rules.length ? rules.map(rule => `<div><span><b>${escape(rule.merchant)}</b><small>${escape(rule.category_name)}${rule.method ? ` · ${rule.method === 'card' ? 'Carte' : 'Conjoint'}` : ''}</small></span><button class="danger-link" type="button" data-delete-merchant-rule="${rule.id}">Supprimer</button></div>`).join('') : '<p class="form-note">Aucune règle encore. En enregistrant une dépense, cochez « Retenir ce commerçant ».</p>'}</div>`;
  formShell('merchant-rules', 'Classement automatique', 'Règles commerçants', content, '<button class="add" value="cancel" formmethod="dialog">Fermer</button>');
}

function formData(form) {
  const raw = Object.fromEntries(new FormData(form).entries());
  raw.included = form.elements.included?.checked || false;
  raw.remember_rule = form.elements.remember_rule?.checked || false;
  raw.seed_limits = form.elements.seed_limits?.checked || false;
  return raw;
}

async function saveForm(form) {
  const values = formData(form);
  if (form.dataset.form === 'transaction') return api('/api/action', { action: 'transaction', ...values });
  if (form.dataset.form === 'recurring') return api('/api/action', { action: 'recurring', ...values });
  if (form.dataset.form === 'limit') return api('/api/action', { action: 'category', ...values });
  if (form.dataset.form === 'setup') return api('/api/action', { action: 'setup', complete: true, ...values });
  if (form.dataset.form === 'checkpoint') return api('/api/action', { action: 'checkpoint', ...values });
  if (form.dataset.form === 'occurrence') return api('/api/action', { action: 'occurrence', state: 'paid', ...values });
  if (form.dataset.form === 'afford') return api('/api/action', { action: 'afford', ...values });
  return null;
}

async function deleteThing(type, id) {
  const labels = { transaction: 'cette transaction', recurring: 'cette règle', category: 'cette limite' };
  if (!confirm(`Supprimer ${labels[type] || 'cet élément'} ?`)) return;
  const action = type === 'transaction' ? 'delete_transaction' : type === 'recurring' ? 'delete_recurring' : 'delete_category';
  try {
    const result = await api('/api/action', { action, id: Number(id) });
    $('#atelier-modal').close();
    await refresh();
    toast(result.note || 'Supprimé.');
  } catch (error) { toast(error.message); }
}

async function occurrenceAction(button) {
  const form = button.closest('form');
  const values = formData(form);
  const state = button.dataset.occurrenceState;
  if (state === 'move') values.moved_to = $('#atelier-move-date', form).value;
  try {
    const result = await api('/api/action', { action: 'occurrence', state, ...values });
    $('#atelier-modal').close();
    await refresh();
    if (atelier.view === 'calendar') renderCalendar();
    toast(result.note || 'Échéance modifiée.');
  } catch (error) { toast(error.message); }
}

async function deleteMerchantRule(id) {
  if (!confirm('Supprimer cette règle de commerçant ?')) return;
  try {
    const result = await api('/api/action', { action: 'delete_merchant_rule', id: Number(id) });
    await refresh({ keepCalendar: true });
    openMerchantRules();
    toast(result.note || 'Règle supprimée.');
  } catch (error) { toast(error.message); }
}

function wire() {
  document.addEventListener('click', event => {
    const element = event.target.closest('button,[data-view-link],tr[data-edit-transaction],tr[data-edit-limit]');
    if (!element) return;
    if (element.id === 'atelier-theme') return applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    if (element.dataset.view) { atelier.view = element.dataset.view; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (element.dataset.viewLink) { event.preventDefault(); atelier.view = element.dataset.viewLink; render(); return; }
    if (element.dataset.open === 'transaction') return openTransaction();
    if (element.dataset.open === 'recurring') return openRecurring(null, element.dataset.ruleKind || 'expense');
    if (element.dataset.open === 'limit') return openLimit();
    if (element.dataset.open === 'setup') return openSetup();
    if (element.dataset.open === 'checkpoint') return openCheckpoint();
    if (element.dataset.open === 'afford') return openAfford();
    if (element.dataset.open === 'merchant-rules') return openMerchantRules();
    if (element.dataset.editTransaction) return openTransaction(element.dataset.editTransaction);
    if (element.dataset.editRule) return openRecurring(element.dataset.editRule);
    if (element.dataset.editLimit) return openLimit(element.dataset.editLimit);
    if (element.dataset.openOccurrence) return openOccurrence(element.dataset.openOccurrence);
    if (element.dataset.month) return shiftMonth(element.dataset.month === 'next' ? 1 : -1);
    if (element.dataset.clearTransactionFilters !== undefined) { atelier.transactionMonth = ''; atelier.transactionCategory = ''; atelier.transactionKind = ''; atelier.transactionQuery = ''; return renderTransactions(); }
    if (element.dataset.calendarDay) { atelier.calendarDay = element.dataset.calendarDay; return renderCalendar(); }
    if (element.dataset.closeCalendarDetail !== undefined) { atelier.calendarDay = null; return renderCalendar(); }
    if (element.dataset.dialogDelete) return deleteThing(element.dataset.dialogDelete, element.dataset.id);
    if (element.dataset.occurrenceState) return occurrenceAction(element);
    if (element.dataset.deleteMerchantRule) return deleteMerchantRule(element.dataset.deleteMerchantRule);
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'atelier-day') { atelier.selectedDay = Number(event.target.value); renderToday(); }
    if (event.target.id === 'atelier-search') { atelier.transactionQuery = event.target.value; renderTransactions(); }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'atelier-kind') { atelier.transactionKind = event.target.value; renderTransactions(); }
    if (event.target.id === 'atelier-transaction-month') { atelier.transactionMonth = event.target.value; renderTransactions(); }
    if (event.target.id === 'atelier-category-filter') { atelier.transactionCategory = event.target.value; renderTransactions(); }
    if (event.target.matches('[data-limit-mode],[data-limit-frequency]')) updateLimitForm(event.target.closest('form'));
  });
  $('#atelier-modal').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget.querySelector('form');
    try {
      const result = await saveForm(form);
      if (form.dataset.form === 'afford') {
        const answer = $('#atelier-afford-answer', form);
        answer.className = `afford-answer wide ${result.afford ? 'yes' : 'no'}`;
        answer.innerHTML = `<b>${result.afford ? 'Oui' : 'Non'}</b><span>Le point bas après cet achat serait ${money(result.low)}.</span>`;
        return;
      }
      $('#atelier-modal').close();
      await refresh();
      if (atelier.view === 'calendar') renderCalendar();
      toast(result.note || 'Enregistré.');
    } catch (error) { toast(error.message); }
  });
}

initialiseTheme();
wire();
refresh().catch(error => { $('#atelier-view').innerHTML = `<div class="empty-state"><b>Impossible de lire le budget.</b><span>${escape(error.message)}</span></div>`; });
