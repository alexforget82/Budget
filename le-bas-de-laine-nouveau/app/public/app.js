/* Le Bas de Laine — interface sans dépendance */
'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const state = { data: null, page: 'today', month: null, selectedTransactions: new Set(), csv: null };
const money = cents => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format((Number(cents) || 0) / 100);
const signed = (cents, kind) => `${kind === 'income' ? '+' : '−'}${money(Math.abs(cents))}`;
const dateFmt = value => new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00Z`));
const dayFmt = value => new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00Z`));
const parseCents = value => {
  const string = String(value || '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(string)) return null;
  const [whole, fraction = ''] = string.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};
const escape = value => String(value || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const localDate = () => new Date().toISOString().slice(0, 10);
const merchantKey = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\b(?:TERMINAL|SUCCURSALE|SUCC|BRANCH|STORE)\.?\s*(?:NO\.?\s*)?[#:]?\s*\d+\b/g, ' ').replace(/#\s*\d+\b/g, ' ').replace(/\s+/g, ' ').trim();

async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const json = await response.json();
  if (!response.ok || json.error) throw Error(json.error || 'Une erreur est survenue.');
  return json;
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 4200); }
async function refresh(note) { state.data = await api('/api/state'); state.month ||= state.data.today.slice(0, 7); render(); if (note) toast(note); }
async function act(body) { const result = await api('/api/action', body); if (result.version) { state.data = result; render(); toast(result.note || 'Enregistré.'); return result; } return result; }
function open(name) { const dialog = $(`#dialog-${name}`); if (!dialog) return; dialog.showModal(); }
function close(dialog) { dialog?.close(); }
function filled(form) { return Object.fromEntries(new FormData(form).entries()); }
function setText(sel, text) { const el = $(sel); if (el) el.textContent = text; }
function isoPlus(date, offset) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
function activePage(page) { return state.page === page; }

function changePage(page) {
  state.page = page;
  $$('.page').forEach(el => el.hidden = el.id !== `page-${page}`);
  $$('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = { today:['Aujourd’hui','Votre argent, sans les complications.'], transactions:['Transactions','Chaque achat est saisi une seule fois.'], plan:['Plan','Ce qui arrive, dans un seul endroit.'], calendar:['Calendrier','La prévision jour par jour.'], budget:['Budget','La vue mensuelle, sans effets sur le disponible.'] };
  setText('#top-title', titles[page][0]); setText('#top-subtitle', titles[page][1]);
  if (page === 'budget') renderBudget();
  window.scrollTo({ top:0, behavior:'instant' });
}
function upcomingByKind(kind) { return state.data.upcoming.filter(e => e.kind === kind); }
function categoryName(id) { return state.data.categories.find(c => c.id === id)?.name || 'Sans limite'; }
function nextLimitText(c) { const starts = c.starts || []; const next = starts.find(d => d > state.data.today); if (!next) return 'aucun renouvellement sous 30 jours'; return c.funding === 'income' ? `à couvrir avant ${dateFmt(next)}` : `renouvelle ${dateFmt(next)}`; }
function progressWidth(c) { if (!c.amount) return 0; return Math.max(0, Math.min(100, (c.reserve / c.amount) * 100)); }
function renderSetup() {
  const holder = $('#setup-banner');
  if (state.data.settings.setupComplete) { holder.innerHTML = ''; return; }
  holder.innerHTML = `<article class="card pad setup"><div class="section-head" style="padding:0"><div><div class="eyebrow">Première installation</div><h3>Votre budget prend forme en quelques minutes</h3><p>Solde, revenus, factures et limites : vous pouvez tout faire progressivement.</p></div><button class="primary" data-open="setup" type="button">Commencer</button></div><div class="steps"><div class="step ${state.data.settings.bank ? 'done':''}"><b>1. Solde</b><span>${state.data.settings.bank ? 'enregistré' : 'à inscrire'}</span></div><div class="step ${state.data.recurring.some(r=>r.kind==='income') ? 'done':''}"><b>2. Revenus</b><span>${state.data.recurring.some(r=>r.kind==='income') ? 'ajoutés' : 'dans Plan'}</span></div><div class="step ${state.data.recurring.some(r=>r.kind==='expense') ? 'done':''}"><b>3. Factures</b><span>${state.data.recurring.some(r=>r.kind==='expense') ? 'ajoutées' : 'dans Plan'}</span></div><div class="step ${state.data.categories.length ? 'done':''}"><b>4. Limites</b><span>${state.data.categories.length ? 'ajoutées' : 'dans Plan'}</span></div></div></article>`;
}
function renderToday() {
  const d = state.data, min = d.safe30;
  setText('#side-version', `Nouvelle base · ${d.version}`);
  setText('#safe30', money(min.safe));
  setText('#safe30-note', `Point le plus bas prévu le ${dateFmt(min.date)}.`);
  setText('#safe-now', money(d.current.safe));
  setText('#safe-until', money(d.safeUntilIncome.safe));
  setText('#checkpoint-label', d.settings.checkpointDate ? `Solde vérifié le ${dayFmt(d.settings.checkpointDate)}` : 'Solde à vérifier');
  renderChart();
  const income = d.nextIncome;
  const bill = upcomingByKind('expense')[0];
  const urgent = [...d.categories].filter(c => c.amount > 0).sort((a,b) => (a.reserve / a.amount) - (b.reserve / b.amount))[0];
  $('#glance').innerHTML = [
    income ? `<article class="card glance-card income"><small>Prochain revenu</small><b>${escape(income.name)} · ${money(income.amount)}</b><span>${dateFmt(income.due)}</span></article>` : `<article class="card glance-card income"><small>Prochain revenu</small><b>À ajouter dans Plan</b><span>Une paie rend la prévision plus juste.</span></article>`,
    bill ? `<article class="card glance-card bill"><small>Prochaine facture</small><b>${escape(bill.name)} · ${money(bill.amount)}</b><span>${dateFmt(bill.due)}</span></article>` : `<article class="card glance-card bill"><small>Prochaine facture</small><b>Aucune facture prévue</b><span>Ajoutez-en une dans Plan si nécessaire.</span></article>`,
    urgent ? `<article class="card glance-card limit"><small>Limite à surveiller</small><b>${escape(urgent.name)} · ${money(urgent.reserve)} restant</b><span>${nextLimitText(urgent)}</span></article>` : `<article class="card glance-card limit"><small>Limites</small><b>À configurer</b><span>Épicerie, essence ou autres dépenses variables.</span></article>`
  ].join('');
  const limits = [...d.categories].filter(c => c.amount).sort((a,b) => a.reserve - b.reserve);
  $('#today-limits').innerHTML = limits.length ? limits.slice(0,5).map(limitRow).join('') : `<div class="empty">Ajoutez une limite pour protéger une dépense variable dans votre disponible.</div>`;
  const events = d.upcoming.slice(0,7);
  $('#today-events').innerHTML = events.length ? events.map(eventRow).join('') : `<div class="empty">Aucune échéance. Ajoutez vos paies et factures dans Plan.</div>`;
  const alert = $('#negative-alert');
  const lowDay = d.daily.find(day => day.date === min.date);
  const drivers = [...(lowDay?.events || []).filter(event => event.kind === 'expense').map(event => event.name), ...(lowDay?.limitEvents || []).map(event => event.name)];
  const namedDrivers = drivers.slice(0, 2).map(escape);
  const otherDrivers = drivers.length > namedDrivers.length ? ` et ${drivers.length - namedDrivers.length} autre${drivers.length - namedDrivers.length > 1 ? 's' : ''}` : '';
  if (d.firstNegative) {
    alert.innerHTML = `<article class="notice forecast-alert"><span><b>Le disponible passera sous zéro le ${dateFmt(d.firstNegative.date)} : ${money(d.firstNegative.safe)}.</b><br>Vous pouvez reporter une facture ou ajuster une limite pour cette période.</span><button class="primary" type="button" data-open="adjust">Ajuster le plan</button></article>`;
  } else if (lowDay && drivers.length) {
    alert.innerHTML = `<article class="notice forecast-alert"><span><b>À surveiller le ${dateFmt(lowDay.date)} : ${namedDrivers.join(' et ')}${otherDrivers} ${drivers.length > 1 ? 'font' : 'fait'} descendre le disponible à ${money(lowDay.safe)}.</b><br>Ce montant reste positif, mais c’est le point le plus bas des 30 prochains jours.</span><button class="secondary" type="button" data-chart-day="${lowDay.date}">Voir cette journée</button></article>`;
  } else alert.innerHTML = '';
}
function limitRow(c, plan = false) {
  const ratio = progressWidth(c), css = ratio <= 20 ? 'over' : ratio <= 45 ? 'warn' : '';
  const override = state.data.limitOverrides?.find(o => o.category_id === c.id);
  const changed = override ? `<small class="negative">Ajustement ponctuel prévu.</small>` : '';
  return `<div class="limit-item"><div class="grow"><b>${escape(c.name)}</b><small>${money(c.reserve)} restant · ${nextLimitText(c)}</small>${changed}<div class="bar"><i class="${css}" style="width:${ratio}%"></i></div></div><div class="amount">${money(c.amount)}</div>${plan ? `<div class="actions"><button class="mini" data-edit-limit="${c.id}">Modifier</button>${override ? `<button class="mini danger" data-cancel-limit="${c.id}|${override.due_date}">Annuler l’ajustement</button>` : ''}</div>` : ''}</div>`;
}
function eventRow(e) {
  return `<button class="event-item link" data-occurrence="${e.rid}|${e.nominal}" type="button"><div class="grow"><b>${escape(e.name)}</b><small>${dateFmt(e.due)}${e.moved ? ' · date déplacée' : ''}</small></div><div class="amount ${e.kind === 'income' ? 'positive' : 'negative'}">${signed(e.amount,e.kind)}</div></button>`;
}
function renderChart() {
  const days = state.data.daily.slice(0,30), svg = $('#safe-chart'), slider = $('#safe-slider');
  if (!days.length) return;
  slider.max = Math.max(0, days.length - 1); if (Number(slider.value) > Number(slider.max)) slider.value = 0;
  const values = days.map(d => d.safe), lo = Math.min(...values), hi = Math.max(...values), span = Math.max(1, hi - lo);
  const coordinates = values.map((value, index) => ({ x: (index / Math.max(1, values.length - 1)) * 100, y: 94 - ((value - lo) / span * 78) }));
  const points = coordinates.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const index = Number(slider.value), point = coordinates[index] || coordinates[0];
  const marker = (event, dayIndex, markerIndex, kind) => {
    const coordinate = coordinates[dayIndex];
    const offset = (markerIndex % 3 - 1) * 3.4;
    const x = Math.max(2, Math.min(98, coordinate.x + offset));
    const label = kind === 'income' ? `Revenu : ${event.name} · ${money(event.amount)}` : kind === 'limit' ? `Limite : ${event.name} · ${money(event.amount)}` : `Facture : ${event.name} · ${money(event.amount)}`;
    if (kind === 'limit') return `<rect class="forecast-marker forecast-limit" x="${(x - 1.8).toFixed(2)}" y="${(coordinate.y - 1.8).toFixed(2)}" width="3.6" height="3.6" rx=".7"><title>${escape(label)}</title></rect>`;
    return `<circle class="forecast-marker forecast-${kind}" cx="${x.toFixed(2)}" cy="${coordinate.y.toFixed(2)}" r="2.25"><title>${escape(label)}</title></circle>`;
  };
  const markers = days.flatMap((day, dayIndex) => [
    ...(day.events || []).map((event, eventIndex) => marker(event, dayIndex, eventIndex, event.kind === 'income' ? 'income' : 'expense')),
    ...(day.limitEvents || []).map((event, eventIndex) => marker(event, dayIndex, (day.events || []).length + eventIndex, 'limit'))
  ]).join('');
  svg.setAttribute('viewBox','0 0 100 100');
  svg.innerHTML = `<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9fe0ce" stop-opacity=".34"/><stop offset="1" stop-color="#9fe0ce" stop-opacity="0"/></linearGradient></defs><path d="M0 94 L${points.replaceAll(' ', ' L')} L100 94 Z" fill="url(#fill)"/><line x1="${point.x.toFixed(2)}" y1="8" x2="${point.x.toFixed(2)}" y2="94" class="forecast-selected-line" vector-effect="non-scaling-stroke"/><polyline points="${points}" fill="none" stroke="#9fe0ce" stroke-width="2.4" vector-effect="non-scaling-stroke"/><line x1="0" y1="94" x2="100" y2="94" stroke="rgba(255,255,255,.18)" vector-effect="non-scaling-stroke"/>${markers}<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.2" fill="#f3bf45" stroke="#fff" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`;
  setText('#chart-date', index === 0 ? `Aujourd’hui · ${dayFmt(days[index].date)}` : dateFmt(days[index].date)); setText('#chart-value', money(days[index].safe));
  const day = days[index], previous = days[index - 1], change = previous ? day.safe - previous.safe : 0;
  const eventRows = [
    ...(day.events || []).map(event => `<li class="${event.kind === 'income' ? 'positive' : 'negative'}"><span>${event.kind === 'income' ? '↑' : '↓'} ${escape(event.name)}</span><b>${signed(event.amount, event.kind)}</b></li>`),
    ...(day.limitEvents || []).map(event => `<li class="limit-change"><span>◇ ${escape(event.name)}${event.funded ? ' · mise de côté' : ' · renouvellement'}</span><b>${money(event.amount)}</b></li>`)
  ];
  const explanation = eventRows.length ? `<ul class="chart-events">${eventRows.join('')}</ul>` : `<p class="chart-quiet">Aucune paie, facture ou limite ne change ce jour-là.</p>`;
  $('#chart-details').innerHTML = `<div class="chart-detail-head"><b>Le ${dateFmt(day.date)}</b><span class="${change < 0 ? 'negative' : change > 0 ? 'positive' : ''}">${previous ? `${change >= 0 ? '+' : '−'}${money(Math.abs(change))} depuis hier` : 'Point de départ'}</span></div>${explanation}<div class="chart-calculation"><span>Compte ${money(day.cash)}</span><span>Cartes −${money(day.cards)}</span><span>Limites −${money(day.limits)}</span></div>`;
  svg.onclick = event => {
    const rect = svg.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    slider.value = String(Math.round(ratio * (days.length - 1)));
    renderChart();
  };
}
function transactionCategory(t) { return t.kind === 'expense' ? categoryName(t.category_id) : '—'; }
function populateTransactionMonths() {
  const select = $('#tx-month'), chosen = select.value;
  const months = [...new Set(state.data.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  select.innerHTML = `<option value="">Tous les mois</option>${months.map(month => `<option value="${month}">${new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric'}).format(new Date(`${month}-01T12:00:00Z`))}</option>`).join('')}`;
  select.value = months.includes(chosen) ? chosen : '';
}
function transactionRuleFor(description, method) {
  const key = merchantKey(description);
  return (state.data.merchant_rules || []).find(rule => key.includes(rule.normalized) && (!rule.method || rule.method === method)) || null;
}
function renderTransactions() {
  populateTransactionMonths();
  const search = ($('#tx-search').value || '').toLocaleLowerCase('fr-CA');
  const kind = $('#tx-kind').value, method = $('#tx-method').value, month = $('#tx-month').value, status = $('#tx-status').value, sorting = $('#tx-sort').value;
  const rows = state.data.transactions
    .filter(t => !month || t.date.startsWith(month))
    .filter(t => !kind || t.kind === kind)
    .filter(t => !method || t.method === method)
    .filter(t => status !== 'unclassified' || (t.kind === 'expense' && !t.category_id && !t.recurring_id))
    .filter(t => `${t.description} ${transactionCategory(t)} ${t.method === 'card' ? 'carte' : 'conjoint'}`.toLocaleLowerCase('fr-CA').includes(search));
  const byDate = (a,b) => b.date.localeCompare(a.date) || b.id - a.id;
  rows.sort((a,b) => {
    if (sorting === 'date_asc') return -byDate(a,b);
    if (sorting === 'amount_desc') return b.amount - a.amount || byDate(a,b);
    if (sorting === 'amount_asc') return a.amount - b.amount || byDate(a,b);
    if (sorting === 'description') return String(a.description).localeCompare(String(b.description),'fr-CA') || byDate(a,b);
    if (sorting === 'category') return transactionCategory(a).localeCompare(transactionCategory(b),'fr-CA') || byDate(a,b);
    return byDate(a,b);
  });
  const ids = new Set(rows.filter(t => t.kind === 'expense').map(t => t.id));
  for (const id of state.selectedTransactions) if (!ids.has(id)) state.selectedTransactions.delete(id);
  $('#tx-body').innerHTML = rows.map(t => `<tr><td class="select-column">${t.kind === 'expense' ? `<input type="checkbox" data-tx-select="${t.id}" aria-label="Sélectionner ${escape(t.description)}" ${state.selectedTransactions.has(t.id)?'checked':''}>` : ''}</td><td>${dateFmt(t.date)}</td><td><b>${escape(t.description || (t.kind === 'income' ? 'Revenu' : t.kind === 'card_payment' ? 'Paiement de carte' : 'Dépense'))}</b></td><td>${t.kind === 'expense' ? escape(transactionCategory(t)) : '—'}</td><td><span class="tag ${t.method === 'card' ? 'card':''}">${t.kind === 'card_payment' ? 'Paiement carte' : t.method === 'card' ? 'Carte' : 'Conjoint'}</span></td><td class="right amount ${t.kind === 'income' ? 'positive' : 'negative'}">${signed(t.amount,t.kind)}</td><td class="right"><button class="mini" data-edit-tx="${t.id}">Modifier</button><button class="mini danger" data-delete-tx="${t.id}">Supprimer</button></td></tr>`).join('');
  $('#tx-empty').hidden = rows.length > 0;
  const ins = rows.filter(t => t.kind === 'income').reduce((n,t)=>n+t.amount,0), outs = rows.filter(t=>t.kind!=='income').reduce((n,t)=>n+t.amount,0);
  $('#tx-total').innerHTML = rows.length ? `<span class="tag">${rows.length} opération${rows.length>1?'s':''}</span><span class="tag positive">Entrées ${money(ins)}</span><span class="tag negative">Sorties ${money(outs)}</span><span class="tag">Net ${money(ins-outs)}</span>` : '';
  const notice = $('#tx-review-notice'), review = state.data.review_count || 0;
  notice.hidden = !review || status === 'unclassified';
  if (!notice.hidden) notice.innerHTML = `<b>${review} dépense${review>1?'s':''} à classer.</b><span> Choisissez une limite pour que le suivi et le restant soient justes.</span> <button type="button" class="mini" id="tx-show-review">Voir la file</button>`;
  $('#tx-show-review')?.addEventListener('click', () => { $('#tx-status').value='unclassified'; renderTransactions(); });
  const selected = rows.filter(t => state.selectedTransactions.has(t.id));
  const selection = $('#tx-selection');
  selection.hidden = !selected.length;
  if (selected.length) {
    const total = selected.reduce((sum,t)=>sum+t.amount,0), average = Math.round(total / selected.length);
    selection.innerHTML = `<span class="tag">${selected.length} sélectionnée${selected.length>1?'s':''} · Total ${money(total)} · Moyenne ${money(average)}</span><select class="filter" id="tx-bulk-category"><option value="">Choisir une limite</option>${state.data.categories.map(c=>`<option value="${c.id}">${escape(c.name)}</option>`).join('')}</select><button class="secondary" type="button" id="tx-bulk-apply">Classer la sélection</button>`;
    $('#tx-bulk-apply').addEventListener('click', async () => {
      const category_id = $('#tx-bulk-category').value;
      if (!category_id) return toast('Choisissez une limite.');
      try { await act({ action:'classify_transactions', ids:[...state.selectedTransactions], category_id }); state.selectedTransactions.clear(); } catch(error) { toast(error.message); }
    });
  }
  $$('#tx-body [data-tx-select]').forEach(box => box.addEventListener('change', () => { box.checked ? state.selectedTransactions.add(Number(box.dataset.txSelect)) : state.selectedTransactions.delete(Number(box.dataset.txSelect)); renderTransactions(); }));
  const all = $('#tx-select-all');
  all.checked = !!ids.size && [...ids].every(id=>state.selectedTransactions.has(id));
  all.indeterminate = state.selectedTransactions.size > 0 && !all.checked;
  all.onchange = () => { for (const id of ids) all.checked ? state.selectedTransactions.add(id) : state.selectedTransactions.delete(id); renderTransactions(); };
}
function renderPlan() {
  const rules = state.data.recurring;
  const listRules = (kind, empty) => {
    const entries = rules.filter(rule => rule.kind === kind);
    return entries.length ? entries.map(r => { const next = state.data.upcoming.find(e=>e.rid===r.id); return `<div class="compact-row"><div class="grow"><strong>${escape(r.name)}</strong><small>${labelFrequency(r.frequency)}${next ? ` · ${dateFmt(next.due)}` : ''}</small></div><span class="amount ${r.kind==='income'?'positive':'negative'}">${signed(r.amount,r.kind)}</span><button class="mini" data-edit-rule="${r.id}">Modifier</button></div>`; }).join('') : `<div class="empty">${empty}</div>`;
  };
  $('#income-list').innerHTML = listRules('income', 'Ajoutez une paie, une rente ou une allocation.');
  $('#bill-list').innerHTML = listRules('expense', 'Ajoutez vos factures fixes.');
  $('#limit-list').innerHTML = state.data.categories.length ? state.data.categories.map(c=>limitRow(c,true)).join('') : `<div class="empty">Ajoutez Épicerie, Essence ou une autre dépense variable.</div>`;
  setText('#plan-checkpoint', state.data.settings.checkpointDate ? `Solde vérifié le ${dateFmt(state.data.settings.checkpointDate)}.` : 'Aucun solde vérifié : inscrivez votre solde actuel pour démarrer.');
}
function labelFrequency(f) { return ({w:'chaque semaine',b:'aux 2 semaines',m:'chaque mois',a:'chaque année'})[f] || f; }
function renderCalendar() {
  const d = state.data, rows = d.daily.slice(0,30);
  $('#calendar-grid').innerHTML = rows.map(row => {
    const events = row.events.slice(0,3).map(e=>`<button class="evt link ${e.kind==='income'?'positive':'negative'}" data-occurrence="${e.rid}|${e.nominal}">${e.kind==='income'?'+':'−'} ${escape(e.name)} · ${money(e.amount)}</button>`).join('');
    const limitStarts = row.limitEvents.map(e=>`<button class="evt link" data-open="adjust">↻ ${escape(e.name)} · ${money(e.amount)}</button>`).join('');
    return `<article class="day-card ${row.date===d.today?'today':''}"><div class="date">${dateFmt(row.date)}</div><div class="safe">Disponible ${money(row.safe)}</div>${events}${limitStarts}</article>`;
  }).join('');
}
async function renderBudget() {
  if (!state.data) return;
  const b = await api(`/api/budget?month=${encodeURIComponent(state.month)}`);
  const m = new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric'}).format(new Date(`${b.month}-01T12:00:00Z`));
  setText('#budget-month', m);
  const rest = b.income-b.fixed-b.variable;
  $('#budget-summary').innerHTML = `<article class="card budget-summary-card income"><small>Revenus prévus</small><b class="positive">${money(b.income)}</b><span>Revenus programmés ce mois-ci</span></article><article class="card budget-summary-card"><small>Factures fixes</small><b>${money(b.fixed)}</b><span>Ce qui est déjà planifié</span></article><article class="card budget-summary-card"><small>Limites du mois</small><b>${money(b.variable)}</b><span>${b.categories.length} catégorie${b.categories.length>1?'s':''} à suivre</span></article><article class="card budget-summary-card ${rest < 0 ? 'negative-card':''}"><small>Reste du plan</small><b class="${rest >= 0 ? 'positive':'negative'}">${money(rest)}</b><span>Revenus moins factures et limites</span></article>`;
  const monthName = month => new Intl.DateTimeFormat('fr-CA',{month:'long'}).format(new Date(`${month}-01T12:00:00Z`));
  $('#budget-history').innerHTML = `<div class="budget-history-copy"><div><div class="eyebrow">Comparaison</div><h3>Vos dépenses variables</h3><p>Une vue rapide des trois derniers mois.</p></div><div class="budget-history-current"><small>Dépensé ce mois-ci</small><b>${money(b.actualVariable)}</b></div></div><div class="budget-history-months">${b.history.map(row => `<div class="budget-history-month"><span>${escape(monthName(row.month))}</span><b>${money(row.spent)}</b><small>sur ${money(row.planned)} prévu</small></div>`).join('')}</div>`;
  const sorted = [...b.categories].sort((a,b) => {
    const ratioA = a.planned ? a.spent / a.planned : 0, ratioB = b.planned ? b.spent / b.planned : 0;
    return ratioB - ratioA || a.name.localeCompare(b.name, 'fr-CA');
  });
  $('#budget-body').innerHTML = sorted.map(c => {
    const ratio = c.planned ? c.spent / c.planned : 0;
    const percent = Math.round(ratio * 100), width = Math.max(0, Math.min(100, percent));
    const stateClass = c.remaining < 0 ? 'over' : ratio >= .8 ? 'warn' : '';
    const status = c.remaining < 0 ? `Dépassement de ${money(Math.abs(c.remaining))}` : c.remaining === 0 ? 'Limite atteinte' : `${money(c.remaining)} restant`;
    const comparison = c.previousSpent ? `Mois dernier : ${money(c.previousSpent)}` : `Moyenne 3 mois : ${money(c.averageSpent)}`;
    return `<article class="budget-category ${stateClass}"><div class="budget-category-head"><div><h3>${escape(c.name)}</h3><p>${labelFrequency(c.frequency)} · ${percent}% utilisé</p></div><span class="budget-status ${stateClass}">${status}</span></div><div class="budget-amounts"><div><small>Budget</small><b>${money(c.planned)}</b></div><div><small>Dépensé</small><b>${money(c.spent)}</b></div><div><small>Disponible</small><b class="${c.remaining < 0 ? 'negative' : ''}">${money(c.remaining)}</b></div></div><div class="budget-progress" aria-label="${percent}% utilisé"><i class="${stateClass}" style="width:${width}%"></i></div><footer><span>${comparison}</span><button class="mini" type="button" data-edit-limit="${c.id}">Modifier</button></footer></article>`;
  }).join('');
  $('#budget-empty').hidden = b.categories.length > 0;
}
function render() { renderSetup(); renderToday(); renderTransactions(); renderPlan(); renderCalendar(); if (state.page === 'budget') renderBudget(); }

function csvDelimiter(text) {
  const first = String(text || '').split(/\r?\n/, 1)[0] || '';
  return [';', ',', '\t'].sort((a,b) => (first.split(b).length - first.split(a).length))[0];
}
function parseCsv(text) {
  const delimiter = csvDelimiter(text), rows = [], row = [];
  let field = '', quoted = false;
  const push = () => { row.push(field.trim()); field = ''; };
  const finish = () => { push(); if (row.some(value => value !== '')) rows.push(row.splice(0)); };
  for (let index = 0; index < text.length; index++) {
    const char = text[index], next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) push();
    else if (char === '\n') finish();
    else if (char !== '\r') field += char;
  }
  if (field || row.length) finish();
  return rows;
}
function csvHeader(value) { return merchantKey(value).replace(/[^A-Z0-9]/g, ''); }
function csvDate(value) {
  const raw = String(value || '').trim();
  let found = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (found) return `${found[1]}-${String(found[2]).padStart(2,'0')}-${String(found[3]).padStart(2,'0')}`;
  found = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (found) return `${found[3]}-${String(found[1]).padStart(2,'0')}-${String(found[2]).padStart(2,'0')}`;
  return '';
}
function csvAmount(value) {
  let raw = String(value || '').trim().replace(/\$/g, '').replace(/\s/g, '');
  const negative = raw.startsWith('-') || /^\(.*\)$/.test(raw);
  raw = raw.replace(/[()−-]/g, '');
  if (raw.includes(',') && raw.includes('.')) raw = raw.replace(/,/g, '');
  else raw = raw.replace(',', '.');
  const cents = parseCents(raw);
  return cents === null ? null : negative ? -cents : cents;
}
function selectOptions(headers, selected) { return headers.map((header,index) => `<option value="${index}" ${index===selected?'selected':''}>${escape(header || `Colonne ${index + 1}`)}</option>`).join(''); }
function guessedColumn(headers, names, fallback) {
  const index = headers.findIndex(header => names.some(name => csvHeader(header).includes(name)));
  return index >= 0 ? index : fallback;
}
function csvRows() {
  const csv = state.csv;
  if (!csv) return [];
  const method = $('#csv-method').value;
  return csv.rows.map((cells,index) => {
    const date = csvDate(cells[csv.map.date]);
    const description = String(cells[csv.map.description] || '').trim();
    const signedAmount = csvAmount(cells[csv.map.amount]);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !description || signedAmount === null || !signedAmount) throw Error(`Vérifie la ligne ${index + 2} du CSV.`);
    const kind = signedAmount < 0 ? 'expense' : 'income';
    const rule = kind === 'expense' ? transactionRuleFor(description, method) : null;
    const category_id = kind === 'expense' ? Number(csv.categories.get(index) || rule?.category_id || 0) || '' : '';
    return { date, description, amount: (Math.abs(signedAmount) / 100).toFixed(2), kind, method, category_id, import_key: `csv|${date}|${encodeURIComponent(description)}|${Math.abs(signedAmount)}|${kind}|${method}|${index}` };
  });
}
function renderCsvPreview() {
  const csv = state.csv, mapping = $('#csv-mapping'), preview = $('#csv-preview'), button = $('#csv-import');
  if (!csv) { mapping.hidden = true; preview.innerHTML = ''; button.disabled = true; return; }
  mapping.hidden = false;
  mapping.innerHTML = `<div class="form-grid"><label class="field">Colonne date<select id="csv-map-date">${selectOptions(csv.headers,csv.map.date)}</select></label><label class="field">Colonne description<select id="csv-map-description">${selectOptions(csv.headers,csv.map.description)}</select></label><label class="field full">Colonne montant signé<select id="csv-map-amount">${selectOptions(csv.headers,csv.map.amount)}</select><small>Un montant négatif est une dépense; un montant positif est un revenu.</small></label></div>`;
  ['date','description','amount'].forEach(key => $(`#csv-map-${key}`).addEventListener('change', event => { csv.map[key] = Number(event.target.value); renderCsvPreview(); }));
  try {
    const rows = csvRows();
    preview.innerHTML = `<p class="csv-summary"><b>${rows.length} ligne${rows.length>1?'s':''} prête${rows.length>1?'s':''}.</b> Les catégories proposées viennent de vos règles; vous pouvez les modifier avant l’import.</p><div class="table-card csv-table"><table class="table"><thead><tr><th>Date</th><th>Description</th><th>Montant</th><th>Limite proposée</th></tr></thead><tbody>${rows.slice(0,30).map((row,index) => `<tr><td>${escape(row.date)}</td><td>${escape(row.description)}</td><td class="right ${row.kind==='income'?'positive':'negative'}">${row.kind==='income'?'+':'−'}${money(Number(row.amount)*100)}</td><td>${row.kind === 'expense' ? `<select class="filter csv-category" data-csv-category="${index}"><option value="">À classer</option>${state.data.categories.map(category=>`<option value="${category.id}" ${String(category.id)===String(row.category_id)?'selected':''}>${escape(category.name)}</option>`).join('')}</select>` : 'Revenu'}</td></tr>`).join('')}</tbody></table></div>${rows.length>30?`<p class="muted">Aperçu des 30 premières lignes sur ${rows.length}.</p>`:''}`;
    $$('.csv-category').forEach(select => select.addEventListener('change', () => { csv.categories.set(Number(select.dataset.csvCategory), select.value); renderCsvPreview(); }));
    button.disabled = false;
  } catch(error) { preview.innerHTML = `<p class="notice"><b>Import à vérifier.</b><br>${escape(error.message)}</p>`; button.disabled = true; }
}
async function loadCsv(file) {
  const matrix = parseCsv(await file.text());
  if (matrix.length < 2) throw Error('Le fichier CSV ne contient pas de lignes à importer.');
  const headers = matrix[0].map((value,index) => value.replace(/^\uFEFF/,'') || `Colonne ${index + 1}`);
  state.csv = { headers, rows: matrix.slice(1), categories: new Map(), map: {
    date: guessedColumn(headers, ['DATE'], 0),
    description: guessedColumn(headers, ['DESCRIPTION','LIBELLE','MEMO','DETAIL','PAYEE','MERCHANT','COMMER'], Math.min(1, headers.length - 1)),
    amount: guessedColumn(headers, ['MONTANT','AMOUNT','SOMME'], Math.min(2, headers.length - 1))
  }};
  renderCsvPreview();
}
function prepareCsv() {
  const form = $('#csv-form'); form.reset(); form.included.checked = true; form.method.value = 'joint'; state.csv = null; renderCsvPreview(); open('csv');
}
function renderMerchantRules(edit = null) {
  const rules = state.data.merchant_rules || [], holder = $('#merchant-rules-list'), form = $('#merchant-rule-form');
  holder.innerHTML = rules.length ? rules.map(rule => `<div class="compact-row"><div class="grow"><strong>${escape(rule.merchant)}</strong><small>${escape(rule.category_name)}${rule.method ? ` · ${rule.method === 'card' ? 'carte' : 'compte conjoint'}` : ' · tous les moyens'}</small></div><button type="button" class="mini" data-edit-merchant-rule="${rule.id}">Modifier</button><button type="button" class="mini danger" data-delete-merchant-rule="${rule.id}">Supprimer</button></div>`).join('') : '<div class="empty">Aucune règle. Créez-en une après avoir classé un premier achat.</div>';
  form.reset();
  $('#merchant-rule-category').innerHTML = state.data.categories.map(category => `<option value="${category.id}">${escape(category.name)}</option>`).join('');
  form.id.value = edit?.id || '';
  form.merchant.value = edit?.merchant || '';
  form.category_id.value = edit?.category_id || state.data.categories[0]?.id || '';
  form.method.value = edit?.method || '';
}
function prepareMerchantRules(rule = null) { renderMerchantRules(rule); open('merchant-rules'); }
function applyTransactionRule() {
  const form = $('#transaction-form'), hint = $('#tx-rule-hint');
  hint.textContent = '';
  if (form.kind.value !== 'expense' || form.id.value || form.category_id.value) return;
  const rule = transactionRuleFor(form.description.value, form.method.value);
  if (!rule) return;
  form.category_id.value = rule.category_id;
  hint.textContent = `Proposée par la règle « ${rule.merchant} » : ${rule.category_name}.`;
}

function populateCategories(selected='') { $('#tx-category').innerHTML = `<option value="">Sans limite</option>${state.data.categories.map(c=>`<option value="${c.id}" ${String(c.id)===String(selected)?'selected':''}>${escape(c.name)} · ${money(c.reserve)} restant</option>`).join('')}`; }
function populateMatches(selected='') { const nearby = state.data.upcoming.filter(e=>e.kind==='expense' && Math.abs((new Date(`${e.due}T12:00Z`)-new Date(`${state.data.today}T12:00Z`))/86400000)<=10); $('#tx-recurring').innerHTML = `<option value="">Aucune association</option>${nearby.map(e=>`<option value="${e.rid}|${e.nominal}" ${`${e.rid}|${e.nominal}`===selected?'selected':''}>${escape(e.name)} · ${dateFmt(e.due)} · ${money(e.amount)}</option>`).join('')}`; }
function prepareTransaction(tx=null) { const f=$('#transaction-form'); f.reset(); populateCategories(tx?.category_id || ''); populateMatches(tx?.recurring_id && tx?.recurring_date ? `${tx.recurring_id}|${tx.recurring_date}` : ''); f.id.value=tx?.id||''; f.kind.value=tx?.kind||'expense'; f.amount.value=tx ? (tx.amount/100).toFixed(2).replace('.',',') : ''; f.date.value=tx?.date||state.data.today; f.method.value=tx?.method||'joint'; f.description.value=tx?.description||''; updateTransactionFields(); if (!tx) applyTransactionRule(); $('#transaction-title').textContent=tx?'Modifier la transaction':'Ajouter une transaction'; open('transaction'); }
function updateTransactionFields() { const kind=$('#tx-form-kind').value, card = $('#tx-form-method'); $('#tx-category-field').hidden=kind!=='expense'; $('#tx-remember-field').hidden=kind!=='expense'; $('#match-field').hidden=kind!=='expense'; card.closest('.field').hidden=kind==='income'; if(kind==='card_payment') card.value='joint'; if(kind!=='expense') $('#tx-rule-hint').textContent=''; }
function prepareLimit(c=null) { const f=$('#limit-form'); f.reset(); f.id.value=c?.id||''; f.name.value=c?.name||''; f.amount.value=c?(c.amount/100).toFixed(2).replace('.',','):''; f.frequency.value=c?.frequency||'w'; f.funding.value=c?.funding||'start'; f.start_date.value=c?.start_date||state.data.today; if(c?.frequency==='m') f.monthly_renewal.value=c.renewal; else f.renewal.value=c?.renewal||'4'; $('#limit-title').textContent=c?'Modifier la limite':'Ajouter une limite'; $('#delete-limit').hidden=!c; updateLimitFields(); open('limit'); }
function updateLimitFields() { const monthly=$('#limit-frequency').value==='m'; $('#limit-weekday').hidden=monthly; $('#limit-monthday').hidden=!monthly; $('#limit-funding').hidden=!monthly; if(!monthly) $('#limit-form').funding.value='start'; }
function prepareRule(rule=null) { const f=$('#recurring-form'); f.reset(); f.id.value=rule?.id||''; f.name.value=rule?.name||''; f.kind.value=rule?.kind||'income'; f.amount.value=rule?(rule.amount/100).toFixed(2).replace('.',','):''; f.frequency.value=rule?.frequency||'m'; f.anchor_date.value=rule?.anchor_date||state.data.today; f.adjustment.value=rule?.adjustment||'auto'; f.method.value=rule?.method||'joint'; $('#recurring-title').textContent=rule?'Modifier la règle':'Ajouter une règle'; $('#delete-recurring').hidden=!rule; open('recurring'); }
function prepareOccurrence(key) { const [rid,due]=key.split('|'); const event=state.data.upcoming.find(e=>String(e.rid)===rid&&e.nominal===due); if(!event)return; const f=$('#occurrence-form'); f.reset(); f.recurring_id.value=rid;f.due_date.value=due;$('#occurrence-copy').textContent=`${event.name} · ${dateFmt(event.due)} · ${money(event.amount)}`;open('occurrence'); }
function prepareAdjust() {
  const negative = state.data.firstNegative;
  if (!negative) { toast('Aucun jour négatif à corriger dans les 90 prochains jours.'); return; }
  $('#adjust-copy').innerHTML = `<b>Le disponible atteint ${money(negative.safe)} le ${dateFmt(negative.date)}.</b><br>Choisissez une modification réelle du plan. Elle ne vaut que pour l’occurrence ou la période choisie.`;
  const bills = state.data.upcoming.filter(e => e.kind === 'expense' && e.due >= state.data.today && e.due <= negative.date);
  const limits = state.data.daily.filter(d=>d.date>=state.data.today&&d.date<=negative.date).flatMap(d=>d.limitEvents).filter((e,i,a)=>a.findIndex(x=>x.category_id===e.category_id&&x.due===e.due)===i);
  const billRows = bills.map(e=>`<div class="compact-row"><div class="grow"><strong>${escape(e.name)}</strong><small>Facture de ${money(e.amount)} · ${dateFmt(e.due)}</small></div><button class="secondary" data-move-event="${e.rid}|${e.nominal}|${e.due}" type="button">Reporter</button></div>`).join('');
  const limitRows = limits.map(e=>`<div class="compact-row"><div class="grow"><strong>${escape(e.name)}</strong><small>Limite de ${money(e.amount)} · renouvellement ${dateFmt(e.date)}</small></div><button class="secondary" data-move-limit="${e.category_id}|${e.due}|${e.date}" type="button">Décaler</button><button class="secondary" data-reduce-limit="${e.category_id}|${e.due}|${e.amount}" type="button">Réduire</button></div>`).join('');
  $('#adjust-options').innerHTML = (billRows || limitRows) ? `${billRows}${limitRows}` : `<div class="notice">Aucune échéance précise ne tombe avant ce jour. Vérifiez le solde, les achats de carte ou les limites déjà actives.</div>`;
  if (!$('#dialog-adjust').open) open('adjust');
}

function wire() {
  document.addEventListener('click', async event => {
    const button=event.target.closest('button,[data-page-link]'); if(!button)return;
    if(button.dataset.page) return changePage(button.dataset.page);
    if(button.dataset.pageLink) return changePage(button.dataset.pageLink);
    if(button.dataset.chartDay) { const dayIndex=state.data.daily.slice(0,30).findIndex(day=>day.date===button.dataset.chartDay); if(dayIndex>=0){ $('#safe-slider').value=String(dayIndex); renderChart(); document.querySelector('#safe-chart')?.scrollIntoView({behavior:'smooth',block:'center'}); } return; }
    if(button.dataset.open) { if(button.dataset.open==='transaction')prepareTransaction(); else if(button.dataset.open==='limit')prepareLimit(); else if(button.dataset.open==='recurring')prepareRule(); else if(button.dataset.open==='merchant-rules')prepareMerchantRules(); else if(button.dataset.open==='csv')prepareCsv(); else if(button.dataset.open==='adjust')prepareAdjust(); else if(button.dataset.open==='afford'){ $('#afford-form').reset();$('#afford-form').date.value=state.data.today;$('#afford-result').hidden=true;open('afford'); } else open(button.dataset.open); return; }
    if(button.hasAttribute('data-close')) return close(button.closest('dialog'));
    if(button.dataset.editTx) return prepareTransaction(state.data.transactions.find(t=>String(t.id)===button.dataset.editTx));
    if(button.dataset.deleteTx) { if(confirm('Supprimer cette transaction ?')) await act({action:'delete_transaction',id:button.dataset.deleteTx}); return; }
    if(button.dataset.editLimit) return prepareLimit(state.data.categories.find(c=>String(c.id)===button.dataset.editLimit));
    if(button.dataset.editRule) return prepareRule(state.data.recurring.find(r=>String(r.id)===button.dataset.editRule));
    if(button.dataset.editMerchantRule) return prepareMerchantRules(state.data.merchant_rules.find(r=>String(r.id)===button.dataset.editMerchantRule));
    if(button.dataset.deleteMerchantRule) { if(confirm('Supprimer cette règle de commerçant ?')) { await act({action:'delete_merchant_rule',id:button.dataset.deleteMerchantRule}); renderMerchantRules(); } return; }
    if(button.dataset.occurrence) return prepareOccurrence(button.dataset.occurrence);
    if(button.dataset.cancelLimit) { const [category_id,due_date]=button.dataset.cancelLimit.split('|'); if(confirm('Annuler cet ajustement et reprendre la limite normale ?')) await act({action:'delete_limit_override',category_id,due_date}); return; }
    if(button.dataset.moveEvent) { const [recurring_id,due_date,current]=button.dataset.moveEvent.split('|'); const moved_to=prompt('Nouvelle date (AAAA-MM-JJ) :',state.data.nextIncome?.due || isoPlus(current,7)); if(moved_to){ try{await act({action:'occurrence',recurring_id,due_date,state:'move',moved_to});prepareAdjust();}catch(error){toast(error.message);} } return; }
    if(button.dataset.moveLimit) { const [category_id,due_date,current]=button.dataset.moveLimit.split('|'); const moved_to=prompt('Nouvelle date (AAAA-MM-JJ) :',state.data.nextIncome?.due || isoPlus(current,7)); if(moved_to){ try{await act({action:'limit_override',type:'move',category_id,due_date,moved_to});prepareAdjust();}catch(error){toast(error.message);} } return; }
    if(button.dataset.reduceLimit) { const [category_id,due_date,current]=button.dataset.reduceLimit.split('|'); const amount=prompt('Montant pour cette période seulement :',(Number(current)/100).toFixed(2).replace('.',',')); if(amount!==null){ try{await act({action:'limit_override',type:'amount',category_id,due_date,amount});prepareAdjust();}catch(error){toast(error.message);} } return; }
  });
  $('#theme-button').addEventListener('click',()=>{ const dark=document.documentElement.dataset.theme==='dark'; document.documentElement.dataset.theme=dark?'light':'dark'; localStorage.setItem('bdl-theme',dark?'light':'dark'); });
  $('#safe-slider').addEventListener('input',renderChart);
  $('#quick-afford').addEventListener('click',()=>{ const n=parseCents($('#quick-amount').value); if(n===null)return toast('Inscrivez un montant valide.'); $('#afford-form').reset();$('#afford-form').amount.value=(n/100).toFixed(2).replace('.',',');$('#afford-form').date.value=state.data.today;$('#afford-result').hidden=true;open('afford'); });
  ['#tx-search','#tx-kind','#tx-method','#tx-month','#tx-status','#tx-sort'].forEach(s=>$(s).addEventListener(s==='#tx-search'?'input':'change',renderTransactions));
  $('#tx-form-kind').addEventListener('change',()=>{updateTransactionFields();applyTransactionRule();}); $('#tx-form-method').addEventListener('change',applyTransactionRule); $('#tx-description').addEventListener('input',applyTransactionRule); $('#limit-frequency').addEventListener('change',updateLimitFields);
  $('#budget-prev').addEventListener('click',()=>{const d=new Date(`${state.month}-01T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()-1);state.month=d.toISOString().slice(0,7);renderBudget();});
  $('#budget-next').addEventListener('click',()=>{const d=new Date(`${state.month}-01T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+1);state.month=d.toISOString().slice(0,7);renderBudget();});
  $('#setup-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await act({...filled(form),action:'setup',complete:true});close(form.closest('dialog'));changePage('plan');toast('Solde enregistré. Ajoutez maintenant vos revenus, factures et limites.');}catch(error){toast(error.message);}});
  $('#checkpoint-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await act({...filled(form),action:'checkpoint'});close(form.closest('dialog'));}catch(error){toast(error.message);}});
  $('#transaction-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{const v=filled(form), key=v.recurring_key; delete v.recurring_key;if(key){[v.recurring_id,v.recurring_date]=key.split('|');}await act({...v,action:'transaction'});close(form.closest('dialog'));}catch(error){toast(error.message);}});
  $('#merchant-rule-form').addEventListener('submit',async e=>{e.preventDefault();try{await act({...filled(e.currentTarget),action:'merchant_rule'});renderMerchantRules();}catch(error){toast(error.message);}});
  $('#csv-file').addEventListener('change',async event=>{const file=event.target.files?.[0]; if(!file)return; try{await loadCsv(file);}catch(error){state.csv=null;renderCsvPreview();toast(error.message);}});
  $('#csv-method').addEventListener('change',renderCsvPreview);
  $('#csv-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget, dialog=form.closest('dialog');try{const rows=csvRows(), values=filled(form);await act({action:'import_transactions',rows,method:values.method,included:!!values.included});state.csv=null;close(dialog);}catch(error){toast(error.message);}});
  $('#limit-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{const v=filled(form); if(v.frequency==='m')v.renewal=v.monthly_renewal;delete v.monthly_renewal;await act({...v,action:'category'});close(form.closest('dialog'));}catch(error){toast(error.message);}});
  $('#delete-limit').addEventListener('click',async()=>{const id=$('#limit-form').id.value;if(id&&confirm('Supprimer cette limite ? Les transactions restent conservées.')){await act({action:'delete_category',id});close($('#dialog-limit'));}});
  $('#recurring-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await act({...filled(form),action:'recurring'});close(form.closest('dialog'));}catch(error){toast(error.message);}});
  $('#delete-recurring').addEventListener('click',async()=>{const id=$('#recurring-form').id.value;if(id&&confirm('Supprimer cette règle ?')){await act({action:'delete_recurring',id});close($('#dialog-recurring'));}});
  $('#occurrence-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await act({...filled(form),action:'occurrence',state:'paid'});close(form.closest('dialog'));}catch(error){toast(error.message);}});
  $('#skip-occurrence').addEventListener('click',async()=>{const f=$('#occurrence-form');if(confirm('Ignorer cette échéance uniquement ?')){await act({action:'occurrence',recurring_id:f.recurring_id.value,due_date:f.due_date.value,state:'skip'});close($('#dialog-occurrence'));}});
  $('#move-occurrence').addEventListener('click',async()=>{const f=$('#occurrence-form'), moved=prompt('Nouvelle date (AAAA-MM-JJ) :',f.due_date.value);if(moved){try{await act({action:'occurrence',recurring_id:f.recurring_id.value,due_date:f.due_date.value,state:'move',moved_to:moved});close($('#dialog-occurrence'));}catch(error){toast(error.message);}}});
  $('#afford-form').addEventListener('submit',async e=>{e.preventDefault();try{const r=await act({...filled(e.currentTarget),action:'afford'}), out=$('#afford-result');out.hidden=false;out.innerHTML=`<b class="${r.afford?'positive':'negative'}">${r.afford?'Oui, cet achat semble possible.':'Non, cet achat ferait passer le disponible sous zéro.'}</b><br>Après cet achat, le minimum prévu serait ${money(r.low)}.`;}catch(error){toast(error.message);}});
}
async function boot() {
  document.documentElement.dataset.theme=localStorage.getItem('bdl-theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  wire();
  try { await refresh(); if(!state.data.settings.setupComplete) setTimeout(()=>open('setup'),200); } catch(error){document.body.innerHTML=`<main class="simple"><h1>Le Bas de Laine ne répond pas</h1><p>${escape(error.message)}</p></main>`;}
}
boot();
