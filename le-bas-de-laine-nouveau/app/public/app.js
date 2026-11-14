/* Le Bas de Laine — interface sans dépendance */
'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const state = { data: null, page: 'today', month: null, calendarMonth: null, calendar: null, selectedTransactions: new Set(), csv: null };
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
  const titles = { today:['Aujourd’hui','Votre argent, sans les complications.'], transactions:['Transactions','Chaque achat est saisi une seule fois.'], plan:['Plan','Ce qui arrive, dans un seul endroit.'], calendar:['Calendrier','La prévision mensuelle, jour par jour.'], budget:['Budget','La vue mensuelle, sans effets sur le disponible.'] };
  setText('#top-title', titles[page][0]); setText('#top-subtitle', titles[page][1]);
  if (page === 'budget') renderBudget();
  if (page === 'calendar') renderCalendar();
  window.scrollTo({ top:0, behavior:'instant' });
}
function upcomingByKind(kind) { return state.data.upcoming.filter(e => e.kind === kind); }
function categoryName(id) { return state.data.categories.find(c => c.id === id)?.name || 'Sans limite'; }
function nextLimitText(c) { const starts = c.starts || []; const next = starts.find(d => d > state.data.today); if (!next) return 'aucun renouvellement sous 30 jours'; return c.funding === 'income' ? `à couvrir avant ${dateFmt(next)}` : `renouvelle ${dateFmt(next)}`; }
function progressWidth(c) { if (!c.amount) return 0; return Math.max(0, Math.min(100, (c.reserve / c.amount) * 100)); }
function checkpointText(settings) {
  if (settings.checkpointAge === null || settings.checkpointAge === undefined) return 'Solde à vérifier';
  if (settings.checkpointAge === 0) return 'Solde vérifié aujourd’hui';
  return `Solde vérifié il y a ${settings.checkpointAge} jour${settings.checkpointAge > 1 ? 's' : ''}`;
}
function signedMoney(cents) { return `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${money(Math.abs(cents))}`; }
function renderSetup() {
  const holder = $('#setup-banner');
  if (state.data.settings.setupComplete) { holder.innerHTML = ''; return; }
  holder.innerHTML = `<article class="card pad setup"><div class="section-head" style="padding:0"><div><div class="eyebrow">Première installation</div><h3>Votre budget prend forme en quelques minutes</h3><p>Solde, revenus, factures et limites : vous pouvez tout faire progressivement.</p></div><button class="primary" data-open="setup" type="button">Commencer</button></div><div class="steps"><div class="step ${state.data.settings.bank ? 'done':''}"><b>1. Solde</b><span>${state.data.settings.bank ? 'enregistré' : 'à inscrire'}</span></div><div class="step ${state.data.recurring.some(r=>r.kind==='income') ? 'done':''}"><b>2. Revenus</b><span>${state.data.recurring.some(r=>r.kind==='income') ? 'ajoutés' : 'dans Plan'}</span></div><div class="step ${state.data.recurring.some(r=>r.kind==='expense') ? 'done':''}"><b>3. Factures</b><span>${state.data.recurring.some(r=>r.kind==='expense') ? 'ajoutées' : 'dans Plan'}</span></div><div class="step ${state.data.categories.length ? 'done':''}"><b>4. Limites</b><span>${state.data.categories.length ? 'ajoutées' : 'dans Plan'}</span></div></div></article>`;
}
function renderToday() {
  const d = state.data, min = d.safe30;
  const lowDay = d.daily.find(day => day.date === min.date);
  const lowDrivers = [...(lowDay?.events || []).filter(event => event.kind === 'expense').map(event => event.name), ...(lowDay?.limitEvents || []).map(event => event.name)];
  const drop = min.safe - d.current.safe;
  setText('#side-version', `Nouvelle base · ${d.version}`);
  setText('#safe30', money(min.safe));
  setText('#safe30-note', `Point le plus bas prévu le ${dateFmt(min.date)}.`);
  setText('#safe-now', money(d.current.safe));
  setText('#safe-until', money(d.safeUntilIncome.safe));
  setText('#safe-bank', money(d.current.cash));
  setText('#safe-cards', `−${money(d.current.cards)}`);
  setText('#safe-limits', `−${money(d.current.limits)}`);
  setText('#safe-next-note', d.nextIncome ? `jusqu’au ${dateFmt(d.nextIncome.due)}` : 'sur les 30 prochains jours');
  const safeStatus = $('#safe-status');
  safeStatus.className = `safe-status ${min.safe < 0 ? 'risk' : min.safe < d.current.safe ? 'watch' : 'steady'}`;
  safeStatus.textContent = min.safe < 0 ? 'À corriger' : min.safe < d.current.safe ? 'À surveiller' : 'Stable';
  const lowDetail = $('#safe-low-detail');
  if (lowDetail) {
    const causes = lowDrivers.length ? `${escape(lowDrivers.slice(0, 2).join(' · '))}${lowDrivers.length > 2 ? ` + ${lowDrivers.length - 2} autre${lowDrivers.length > 3 ? 's' : ''}` : ''}` : 'Aucun mouvement majeur prévu';
    lowDetail.innerHTML = `<div><small>Écart jusqu’au point bas</small><b class="${drop < 0 ? 'negative' : drop > 0 ? 'positive' : ''}">${signedMoney(drop)}</b></div><div><small>Ce qui l’explique</small><b>${causes}</b></div>`;
  }
  setText('#checkpoint-label', checkpointText(d.settings));
  renderChart();
  const income = d.nextIncome;
  const bill = upcomingByKind('expense')[0];
  const urgent = [...d.categories].filter(c => c.amount > 0).sort((a,b) => (a.reserve / a.amount) - (b.reserve / b.amount))[0];
  const confidence = d.checkpointActivity || {};
  const checkpointDate = d.settings.checkpointDate ? dateFmt(d.settings.checkpointDate) : 'à confirmer';
  const confidenceFlow = `${confidence.income ? `+${money(confidence.income)} entrées` : 'aucune entrée'} · ${confidence.outflow ? `−${money(confidence.outflow)} sorties` : 'aucune sortie'}`;
  const confidenceOpen = confidence.openEvents?.length ? `${confidence.openEvents.length} échéance${confidence.openEvents.length > 1 ? 's' : ''} passée${confidence.openEvents.length > 1 ? 's' : ''} à décider.` : 'Toutes les opérations bancaires saisies sont expliquées.';
  $('#glance').innerHTML = [
    income ? `<article class="card glance-card income"><small>Prochain revenu</small><b>${escape(income.name)} · ${money(income.amount)}</b><span>${dateFmt(income.due)}</span></article>` : `<article class="card glance-card income"><small>Prochain revenu</small><b>À ajouter dans Plan</b><span>Une paie rend la prévision plus juste.</span></article>`,
    bill ? `<article class="card glance-card bill"><small>Prochaine facture</small><b>${escape(bill.name)} · ${money(bill.amount)}</b><span>${dateFmt(bill.due)}</span></article>` : `<article class="card glance-card bill"><small>Prochaine facture</small><b>Aucune facture prévue</b><span>Ajoutez-en une dans Plan si nécessaire.</span></article>`,
    urgent ? `<article class="card glance-card limit"><small>Limite à surveiller</small><b>${escape(urgent.name)} · ${money(urgent.reserve)} restant</b><span>${nextLimitText(urgent)}</span></article>` : `<article class="card glance-card limit"><small>Limites</small><b>À configurer</b><span>Épicerie, essence ou autres dépenses variables.</span></article>`,
    `<article class="card glance-card trust ${d.settings.checkpointAge === null || d.settings.checkpointAge > 7 ? 'needs-check' : ''}"><small>Solde de confiance · ${checkpointText(d.settings)}</small><b>${money(confidence.startingBank ?? d.settings.bank)} → ${money(d.settings.expectedBank)}</b><span>Confirmé ${checkpointDate} · ${confidenceFlow}</span><span class="trust-state ${confidence.openEvents?.length ? 'warning' : ''}">${confidenceOpen}</span><div class="glance-actions"><button class="mini" type="button" data-open="checkpoint">Vérifier mon solde</button><button class="mini" type="button" data-open="transaction">Ajouter une opération</button></div></article>`
  ].join('');
  const limits = [...d.categories].filter(c => c.amount).sort((a,b) => a.reserve - b.reserve);
  $('#today-limits').innerHTML = limits.length ? limits.slice(0,5).map(limitRow).join('') : `<div class="empty">Ajoutez une limite pour protéger une dépense variable dans votre disponible.</div>`;
  const events = d.upcoming.slice(0,7);
  $('#today-events').innerHTML = events.length ? events.map(eventRow).join('') : `<div class="empty">Aucune échéance. Ajoutez vos paies et factures dans Plan.</div>`;
  const alert = $('#negative-alert');
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
function transactionCategory(t) {
  if (t.kind !== 'expense') return '—';
  if (t.splits?.length) {
    const names = t.splits.map(split => split.category_name || categoryName(split.category_id));
    return names.length > 2 ? `${names.slice(0, 2).join(' + ')} + ${names.length - 2}` : names.join(' + ');
  }
  return categoryName(t.category_id);
}
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
    .filter(t => status !== 'unclassified' || (t.kind === 'expense' && !t.category_id && !t.splits?.length && !t.recurring_id))
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
  if (!notice.hidden) notice.innerHTML = `<b>Boîte de réception : ${review} dépense${review>1?'s':''} à classer.</b><span> Choisissez une limite pour que le suivi et le restant soient justes.</span> <button type="button" class="mini" id="tx-show-review">Ouvrir la boîte</button>`;
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
  const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
  const nextFor = entries => entries.map(rule => state.data.upcoming.find(event => event.rid === rule.id)).filter(Boolean).sort((a,b) => a.due.localeCompare(b.due))[0];
  const listRules = (kind, empty) => {
    const entries = rules.filter(rule => rule.kind === kind);
    return entries.length ? entries.map(r => { const next = state.data.upcoming.find(e=>e.rid===r.id); return `<div class="compact-row"><div class="grow"><strong>${escape(r.name)}</strong><small>${labelFrequency(r.frequency)}${next ? ` · ${dateFmt(next.due)}` : ''}</small></div><span class="amount ${r.kind==='income'?'positive':'negative'}">${signed(r.amount,r.kind)}</span><button class="mini" data-edit-rule="${r.id}">Modifier</button></div>`; }).join('') : `<div class="empty">${empty}</div>`;
  };
  const incomeRules = rules.filter(rule => rule.kind === 'income');
  const billRules = rules.filter(rule => rule.kind === 'expense');
  const nextIncome = nextFor(incomeRules), nextBill = nextFor(billRules);
  const limits = state.data.categories;
  const urgent = [...limits].filter(limit => limit.amount > 0).sort((a,b) => a.reserve - b.reserve)[0];
  $('#income-list').innerHTML = listRules('income', 'Ajoutez une paie, une rente ou une allocation.');
  $('#bill-list').innerHTML = listRules('expense', 'Ajoutez vos factures fixes.');
  $('#limit-list').innerHTML = limits.length ? limits.map(c=>limitRow(c,true)).join('') : `<div class="empty">Ajoutez Épicerie, Essence ou une autre dépense variable.</div>`;
  setText('#plan-income-meta', incomeRules.length ? `${plural(incomeRules.length, 'règle')} · ${nextIncome ? `prochaine : ${dateFmt(nextIncome.due)}` : 'aucune échéance dans 30 jours'}` : 'Aucune règle');
  setText('#plan-bill-meta', billRules.length ? `${plural(billRules.length, 'règle')} · ${nextBill ? `prochaine : ${dateFmt(nextBill.due)}` : 'aucune échéance dans 30 jours'}` : 'Aucune règle');
  setText('#plan-limit-meta', limits.length ? `${plural(limits.length, 'limite')} · ${urgent ? `${urgent.name} : ${money(urgent.reserve)} restant` : 'à suivre'}` : 'Aucune limite');
  const settings = state.data.settings;
  setText('#plan-checkpoint', settings.checkpointDate ? `${checkpointText(settings)}.` : 'Aucun solde vérifié : inscrivez votre solde actuel pour démarrer.');
  setText('#plan-checkpoint-detail', settings.checkpointDate ? `Solde inscrit : ${money(settings.bank)} · solde prévu aujourd’hui : ${money(settings.expectedBank)} · écart depuis la vérification : ${signedMoney(settings.checkpointChange)}.` : 'Le solde réel est le point de départ. Les opérations saisies après sa vérification s’ajoutent automatiquement.');
}
function labelFrequency(f) { return ({w:'chaque semaine',b:'aux 2 semaines',m:'chaque mois',a:'chaque année'})[f] || f; }
function shiftedMonthClient(month, offset) { const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); }
function calendarMonthLabel(month) { return new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric'}).format(new Date(`${month}-01T12:00:00Z`)); }
async function renderCalendar() {
  if (!state.data) return;
  const requested = state.calendarMonth || state.data.today.slice(0, 7);
  const calendar = await api(`/api/calendar?month=${encodeURIComponent(requested)}`);
  if (requested !== (state.calendarMonth || state.data.today.slice(0, 7))) return;
  state.calendar = calendar;
  state.calendarMonth = calendar.month;
  setText('#calendar-month', calendarMonthLabel(calendar.month));
  setText('#calendar-kicker', calendar.historical ? 'Historique réel' : 'Prévu et réel');
  setText('#calendar-copy', calendar.historical ? 'Transactions et échéances enregistrées. Le Safe-to-Spend n’est pas recalculé pour les journées passées.' : 'Paies, factures, limites et opérations réellement saisies, jour par jour.');
  $('#calendar-prev').disabled = calendar.month <= calendar.minMonth;
  $('#calendar-next').disabled = calendar.month >= calendar.maxMonth;
  $('#calendar-today').disabled = calendar.month === state.data.today.slice(0, 7);
  const inMonth = calendar.days.filter(day => day.inMonth);
  const forecast = inMonth.filter(day => day.safe !== null);
  const firstForecast = forecast.find(day => day.date >= state.data.today) || forecast[0];
  const low = forecast.reduce((current, day) => !current || day.safe < current.safe ? day : current, null);
  const movements = inMonth.reduce((count, day) => count + day.events.length + day.transactions.length + day.limitEvents.length, 0);
  $('#calendar-summary').innerHTML = `<article class="card calendar-summary-card"><small>${calendar.historical ? 'Dernier solde connu' : 'Disponible au début'}</small><b>${firstForecast ? money(firstForecast.safe) : '—'}</b><span>${firstForecast ? dateFmt(firstForecast.date) : 'Aucune prévision'}</span></article><article class="card calendar-summary-card ${low && low.safe < 0 ? 'negative-card' : ''}"><small>${calendar.historical ? 'Valeur enregistrée la plus basse' : 'Point bas du mois'}</small><b class="${low && low.safe < 0 ? 'negative' : 'positive'}">${low ? money(low.safe) : '—'}</b><span>${low ? dateFmt(low.date) : 'Aucune prévision'}</span></article><article class="card calendar-summary-card"><small>Mouvements du mois</small><b>${movements}</b><span>Paies, factures, limites et saisies</span></article>`;
  const agendaDays = (calendar.historical ? inMonth : inMonth.filter(day => day.date >= state.data.today));
  const highlights = agendaDays.filter(day => day.events.length || day.transactions.length || day.limitEvents.length).slice(0, 5);
  $('#calendar-agenda').innerHTML = `<div class="calendar-agenda-head"><div><div class="eyebrow">Repères du mois</div><h3>${calendar.historical ? 'Les journées enregistrées' : 'Les prochaines journées importantes'}</h3></div><small>Touchez une journée pour son détail</small></div><div class="calendar-agenda-list">${highlights.length ? highlights.map(day => { const entries = [...day.transactions, ...day.events, ...day.limitEvents]; const labels = entries.slice(0, 2).map(entry => escape(entry.description || entry.name)).join(' · '); const more = entries.length > 2 ? ` + ${entries.length - 2}` : ''; return `<button class="calendar-agenda-item" type="button" data-calendar-expand="${day.date}"><time>${dayFmt(day.date)}</time><span><b>${labels}${more}</b><small>${day.safe === null ? 'Historique réel' : `Disponible prévu : ${money(day.safe)}`}</small></span><i>›</i></button>`; }).join('') : `<p class="calendar-agenda-empty">Aucun mouvement dans ce mois.</p>`}</div>`;
  $('#calendar-grid').innerHTML = calendar.days.map(day => {
    const statusLabel = { planned:'Prévu', moved:'Déplacé', skipped:'Ignoré', paid:'Payé', entered:'Saisi' };
    const actual = day.transactions.map(transaction => ({ ...transaction, type:'transaction' }));
    const planned = day.events.map(event => ({ ...event, type:'occurrence' }));
    const items = [...actual, ...planned];
    const rows = items.slice(0, 3).map(item => {
      const direction = item.kind === 'income' ? 'income' : 'expense', label = statusLabel[item.status] || 'Prévu';
      const control = item.type === 'transaction' ? `data-edit-tx="${item.id}"` : `data-occurrence="${item.rid}|${item.nominal}"`;
      return `<button class="calendar-event ${direction} status-${item.status}" type="button" ${control}><span>${item.status === 'paid' ? '✓' : item.status === 'skipped' ? '⊘' : item.status === 'moved' ? '↪' : item.status === 'entered' ? '•' : item.kind === 'income' ? '↑' : '↓'} ${escape(item.name)}</span><em>${label}</em><b>${signed(item.amount,item.kind)}</b></button>`;
    });
    const limits = day.limitEvents.slice(0, Math.max(0, 3 - rows.length)).map(event => `<button class="calendar-event limit" type="button" data-page-link="plan"><span>◇ ${escape(event.name)}</span><em>${event.funded ? 'Réservé' : 'Limite'}</em><b>${money(event.amount)}</b></button>`);
    const extra = Math.max(0, items.length + day.limitEvents.length - rows.length - limits.length);
    const safeLabel = day.safe === null ? (calendar.historical && day.inMonth ? 'Historique' : '—') : money(day.safe);
    return `<article class="calendar-day ${day.inMonth ? '' : 'outside'} ${day.date === state.data.today ? 'today' : ''}"><button class="calendar-day-open" type="button" data-calendar-expand="${day.date}" aria-label="Ouvrir le ${dateFmt(day.date)}"><span class="calendar-date"><b>${Number(day.date.slice(-2))}</b>${day.date === state.data.today ? '<span>Auj.</span>' : ''}</span><span class="calendar-safe">${safeLabel}</span></button><div class="calendar-events">${rows.join('')}${limits.join('')}${extra ? `<button class="calendar-more" type="button" data-calendar-expand="${day.date}">+ ${extra} autre${extra > 1 ? 's' : ''}</button>` : ''}</div></article>`;
  }).join('');
}
function prepareCalendarDay(date) {
  const day = state.calendar?.days.find(item => item.date === date);
  if (!day) return;
  const statusLabel = { planned:'Prévu', moved:'Déplacé', skipped:'Ignoré', paid:'Payé', entered:'Saisi' };
  const actual = (day.transactions || []).map(transaction => ({ ...transaction, type:'transaction' }));
  const planned = (day.events || []).map(event => ({ ...event, type:'occurrence' }));
  const items = [...actual, ...planned];
  const rows = items.map(item => {
    const label = statusLabel[item.status] || 'Prévu', direction = item.kind === 'income' ? 'positive' : 'negative';
    const control = item.type === 'transaction' ? `data-calendar-day-tx="${item.id}"` : `data-calendar-day-occurrence="${item.rid}|${item.nominal}"`;
    return `<button type="button" class="calendar-day-detail-item ${item.status || ''}" ${control}><span><b>${escape(item.name)}</b><small>${label} · ${item.type === 'transaction' ? 'touchez pour modifier' : 'touchez pour gérer'}</small></span><strong class="${direction}">${signed(item.amount,item.kind)}</strong></button>`;
  });
  const limits = (day.limitEvents || []).map(event => `<button type="button" class="calendar-day-detail-item limit" data-calendar-day-plan="1"><span><b>${escape(event.name)}</b><small>${event.funded ? 'Montant réservé' : 'Renouvellement de limite'} · voir dans Plan</small></span><strong>${money(event.amount)}</strong></button>`);
  setText('#calendar-day-title', `Le ${dateFmt(date)}`);
  setText('#calendar-day-copy', day.safe === null ? (state.calendar?.historical ? 'Historique réel : le Safe-to-Spend n’est pas recalculé pour une journée passée.' : 'Aucun disponible prévu pour cette journée.') : `Disponible prévu après les opérations du jour : ${money(day.safe)}.`);
  $('#calendar-day-detail').innerHTML = rows.length || limits.length ? `${rows.join('')}${limits.join('')}` : `<p class="checkpoint-review-empty">Aucune opération ou échéance pour cette journée.</p>`;
  open('calendar-day');
}
async function renderBudget() {
  if (!state.data) return;
  const b = await api(`/api/budget?month=${encodeURIComponent(state.month)}`);
  const m = new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric'}).format(new Date(`${b.month}-01T12:00:00Z`));
  setText('#budget-month', m);
  const rest = b.income-b.fixed-b.variable;
  $('#budget-summary').innerHTML = `<article class="card budget-summary-card income"><small>Revenus prévus</small><b class="positive">${money(b.income)}</b><span>Ce qui est programmé ce mois-ci</span></article><article class="card budget-summary-card"><small>Planifié à dépenser</small><b>${money(b.fixed+b.variable)}</b><span>Factures et limites du mois</span></article><article class="card budget-summary-card"><small>Dépensé dans les limites</small><b>${money(b.actualVariable)}</b><span>Achats déjà saisis ce mois-ci</span></article><article class="card budget-summary-card ${rest < 0 ? 'negative-card':''}"><small>Reste du plan</small><b class="${rest >= 0 ? 'positive':'negative'}">${money(rest)}</b><span>Revenus moins factures et limites</span></article>`;
  const monthName = month => new Intl.DateTimeFormat('fr-CA',{month:'long'}).format(new Date(`${month}-01T12:00:00Z`));
  $('#budget-history').innerHTML = `<div class="budget-history-copy"><div><div class="eyebrow">Comparaison</div><h3>Vos dépenses variables</h3><p>Une vue rapide des trois derniers mois.</p></div><div class="budget-history-current"><small>Dépensé ce mois-ci</small><b>${money(b.actualVariable)}</b></div></div><div class="budget-history-months">${b.history.map(row => `<div class="budget-history-month"><span>${escape(monthName(row.month))}</span><b>${money(row.spent)}</b><small>sur ${money(row.planned)} prévu</small></div>`).join('')}</div>`;
  const sorted = [...b.categories].sort((a,b) => {
    const ratioA = a.planned ? a.spent / a.planned : 0, ratioB = b.planned ? b.spent / b.planned : 0;
    return ratioB - ratioA || a.name.localeCompare(b.name, 'fr-CA');
  });
  const attention = sorted.filter(category => {
    const ratio = category.planned ? category.spent / category.planned : 0;
    return category.remaining <= 0 || ratio >= .75;
  }).slice(0, 3);
  $('#budget-priority').innerHTML = attention.length ? `<div class="budget-priority-head"><div><div class="eyebrow">À surveiller</div><h3>Les catégories qui demandent votre attention</h3><p>Le Budget est une vue mensuelle : il ne change jamais le Safe-to-Spend.</p></div><span class="tag">${attention.length} catégorie${attention.length > 1 ? 's' : ''}</span></div><div class="budget-priority-list">${attention.map(category => { const ratio = category.planned ? category.spent / category.planned : 0, stateClass = category.remaining < 0 ? 'over' : 'warn', label = category.remaining < 0 ? `Dépassement ${money(Math.abs(category.remaining))}` : `${money(category.remaining)} restant`; return `<button class="budget-priority-item ${stateClass}" type="button" data-edit-limit="${category.id}"><span><b>${escape(category.name)}</b><small>${Math.round(ratio * 100)} % utilisé · Budget ${money(category.planned)}</small></span><strong>${label}</strong></button>`; }).join('')}</div>` : `<div class="budget-priority-head calm"><div><div class="eyebrow">À surveiller</div><h3>${b.categories.length ? 'Tout est sous contrôle ce mois-ci' : 'Ajoutez une première limite'}</h3><p>${b.categories.length ? 'Aucune limite n’est près d’être atteinte.' : 'Le Budget affichera ici les catégories proches de leur limite.'}</p></div></div>`;
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
function render() { renderSetup(); renderToday(); renderTransactions(); renderPlan(); if (state.page === 'calendar') renderCalendar(); if (state.page === 'budget') renderBudget(); }

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
  const occurrences = new Map();
  return csv.rows.map((cells,index) => {
    const date = csvDate(cells[csv.map.date]);
    const description = String(cells[csv.map.description] || '').trim();
    const signedAmount = csvAmount(cells[csv.map.amount]);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !description || signedAmount === null || !signedAmount) throw Error(`Vérifie la ligne ${index + 2} du CSV.`);
    const kind = signedAmount < 0 ? 'expense' : 'income';
    const rule = kind === 'expense' ? transactionRuleFor(description, method) : null;
    const category_id = kind === 'expense' ? Number(csv.categories.get(index) || rule?.category_id || 0) || '' : '';
    const signature = `${date}|${encodeURIComponent(merchantKey(description))}|${Math.abs(signedAmount)}|${kind}|${method}`;
    const occurrence = (occurrences.get(signature) || 0) + 1;
    occurrences.set(signature, occurrence);
    return { date, description, amount: (Math.abs(signedAmount) / 100).toFixed(2), kind, method, category_id, import_key: `csv2|${signature}|${occurrence}`, legacy_import_key: `csv|${date}|${encodeURIComponent(description)}|${Math.abs(signedAmount)}|${kind}|${method}|${index}` };
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
    preview.innerHTML = `<p class="csv-summary"><b>${rows.length} ligne${rows.length>1?'s':''} prête${rows.length>1?'s':''}.</b> Les catégories proposées viennent de vos règles; vous pouvez les modifier avant l’import. Un même relevé est ignoré s’il a déjà été importé, même si ses lignes ont changé d’ordre.</p><div class="table-card csv-table"><table class="table"><thead><tr><th>Date</th><th>Description</th><th>Montant</th><th>Limite proposée</th></tr></thead><tbody>${rows.slice(0,30).map((row,index) => `<tr><td>${escape(row.date)}</td><td>${escape(row.description)}</td><td class="right ${row.kind==='income'?'positive':'negative'}">${row.kind==='income'?'+':'−'}${money(Number(row.amount)*100)}</td><td>${row.kind === 'expense' ? `<select class="filter csv-category" data-csv-category="${index}"><option value="">À classer</option>${state.data.categories.map(category=>`<option value="${category.id}" ${String(category.id)===String(row.category_id)?'selected':''}>${escape(category.name)}</option>`).join('')}</select>` : 'Revenu'}</td></tr>`).join('')}</tbody></table></div>${rows.length>30?`<p class="muted">Aperçu des 30 premières lignes sur ${rows.length}.</p>`:''}`;
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
  if (form.kind.value !== 'expense' || form.dataset.splitMode === '1' || form.id.value || form.category_id.value) return;
  const rule = transactionRuleFor(form.description.value, form.method.value);
  if (!rule) return;
  form.category_id.value = rule.category_id;
  hint.textContent = `Proposée par la règle « ${rule.merchant} » : ${rule.category_name}.`;
}

function populateCategories(selected='') { $('#tx-category').innerHTML = `<option value="">Sans limite</option>${state.data.categories.map(c=>`<option value="${c.id}" ${String(c.id)===String(selected)?'selected':''}>${escape(c.name)} · ${money(c.reserve)} restant</option>`).join('')}`; }
function splitCategoryOptions(selected = '') {
  return `<option value="">Choisir une limite</option>${state.data.categories.map(c => `<option value="${c.id}" ${String(c.id) === String(selected) ? 'selected' : ''}>${escape(c.name)} · ${money(c.reserve)} restant</option>`).join('')}`;
}
function currentSplitRows() {
  return $$('.tx-split-row', $('#tx-split-rows')).map(row => ({
    category_id: $('.tx-split-category', row)?.value || '',
    amount: $('.tx-split-amount', row)?.value || ''
  }));
}
function renderSplitRows(splits = []) {
  const holder = $('#tx-split-rows');
  holder.innerHTML = splits.map((split, index) => `<div class="tx-split-row"><select class="tx-split-category" aria-label="Limite de la part ${index + 1}">${splitCategoryOptions(split.category_id)}</select><input class="tx-split-amount" inputmode="decimal" aria-label="Montant de la part ${index + 1}" placeholder="0,00" value="${split.amount === undefined || split.amount === '' ? '' : (Number(split.amount) > 1000 ? (Number(split.amount) / 100).toFixed(2).replace('.', ',') : String(split.amount).replace('.', ','))}"><button class="mini danger" type="button" data-remove-split aria-label="Retirer cette part">×</button></div>`).join('');
  updateSplitTotal();
}
function updateSplitTotal() {
  const total = parseCents($('#tx-amount').value);
  const rows = currentSplitRows();
  const amounts = rows.map(row => parseCents(row.amount));
  const distributed = amounts.some(amount => amount === null) ? null : amounts.reduce((sum, amount) => sum + amount, 0);
  const label = $('#tx-split-total');
  if (total === null) { label.textContent = 'Inscrivez le total de l’achat'; label.className = 'negative'; return; }
  if (distributed === null) { label.textContent = `À répartir · total ${money(total)}`; label.className = ''; return; }
  const difference = total - distributed;
  label.textContent = difference === 0 ? `Réparti · ${money(distributed)}` : difference > 0 ? `Il reste ${money(difference)} à répartir` : `Trop de ${money(Math.abs(difference))}`;
  label.className = difference === 0 ? 'positive' : 'negative';
}
function setSplitMode(enabled, splits = null) {
  const form = $('#transaction-form');
  const canSplit = form.kind.value === 'expense';
  const active = Boolean(enabled && canSplit);
  if (active && form.dataset.splitMode !== '1') {
    const total = parseCents(form.amount.value);
    splits = splits || [
      { category_id: form.category_id.value || '', amount: total === null ? '' : total },
      { category_id: '', amount: '' }
    ];
  }
  form.dataset.splitMode = active ? '1' : '';
  if (active) renderSplitRows(splits || currentSplitRows());
  else if (splits?.length) form.category_id.value = splits[0].category_id || '';
  updateTransactionFields();
}
function recurringCandidates(kind, date) {
  const target = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? date : state.data.today;
  return (state.data.matchable || state.data.upcoming).filter(event => event.kind === kind && Math.abs((new Date(`${event.due}T12:00:00Z`) - new Date(`${target}T12:00:00Z`)) / 86400000) <= 14)
    .sort((a,b) => Math.abs(new Date(`${a.due}T12:00:00Z`) - new Date(`${target}T12:00:00Z`)) - Math.abs(new Date(`${b.due}T12:00:00Z`) - new Date(`${target}T12:00:00Z`)) || a.name.localeCompare(b.name,'fr-CA'));
}
function populateMatches(selected='') {
  const form = $('#transaction-form'), kind = form.kind.value, matching = ['expense','income'].includes(kind), select = $('#tx-recurring');
  if (!matching) { select.innerHTML = '<option value="">Aucune association</option>'; return []; }
  const candidates = recurringCandidates(kind, form.date.value);
  select.innerHTML = `<option value="">Aucune association</option>${candidates.map(event=>`<option value="${event.rid}|${event.nominal}" ${`${event.rid}|${event.nominal}`===selected?'selected':''}>${escape(event.name)} · ${dateFmt(event.due)} · ${money(event.amount)}</option>`).join('')}`;
  return candidates;
}
function matchWords(value) { return merchantKey(value).split(/\s+/).filter(word => word.length >= 3); }
function suggestedMatch(candidates) {
  const form = $('#transaction-form');
  if (!['expense','income'].includes(form.kind.value) || form.id.value || form.dataset.matchManual === '1') return null;
  const amount = parseCents(form.amount.value), description = matchWords(form.description.value), date = form.date.value, method = form.method.value;
  const scored = candidates.map(event => {
    const distance = Math.abs((new Date(`${event.due}T12:00:00Z`) - new Date(`${date}T12:00:00Z`)) / 86400000);
    const eventWords = matchWords(event.name);
    const nameMatch = description.length && eventWords.some(word => description.includes(word)) ? 5 : 0;
    const exactAmount = amount !== null && event.amount === amount;
    const closeAmount = amount !== null && Math.abs(event.amount - amount) <= 2500;
    const methodMatch = form.kind.value === 'income' || event.method === method;
    const score = nameMatch + (exactAmount ? 4 : closeAmount ? 1 : 0) + (methodMatch ? 2 : 0) + (distance <= 1 ? 3 : distance <= 4 ? 2 : distance <= 10 ? 1 : 0);
    return { event, distance, nameMatch, exactAmount, methodMatch, score };
  }).filter(item => item.methodMatch && (item.nameMatch || (item.exactAmount && item.distance <= 4))).sort((a,b) => b.score - a.score || a.distance - b.distance);
  if (!scored.length || (scored[1] && scored[0].score - scored[1].score < 2)) return null;
  return scored[0].event;
}
function renderMatchSuggestion(candidates) {
  const box = $('#tx-match-suggestion'), form = $('#transaction-form');
  if (!box) return;
  const event = $('#tx-recurring').value ? null : suggestedMatch(candidates);
  if (!event) { box.hidden = true; box.innerHTML = ''; return; }
  const label = form.kind.value === 'income' ? 'revenu' : 'facture';
  box.hidden = false;
  box.innerHTML = `<span><b>${escape(event.name)}</b> semble correspondre à ce ${label} prévu : ${dateFmt(event.due)} · ${money(event.amount)}.</span><button class="mini" type="button" data-use-match="${event.rid}|${event.nominal}">Associer</button>`;
}
function refreshTransactionMatches(selected) {
  const current = selected === undefined ? $('#tx-recurring').value : selected;
  const candidates = populateMatches(current);
  renderMatchSuggestion(candidates);
}
function prepareTransaction(tx=null) {
  const f=$('#transaction-form');
  f.reset();
  f.id.value=tx?.id||'';
  f.kind.value=tx?.kind||'expense';
  f.amount.value=tx ? (tx.amount/100).toFixed(2).replace('.',',') : '';
  f.date.value=tx?.date||state.data.today;
  f.method.value=tx?.method||'joint';
  f.description.value=tx?.description||'';
  f.dataset.matchManual=tx?'1':'';
  f.dataset.splitMode='';
  populateCategories(tx?.category_id || tx?.splits?.[0]?.category_id || '');
  updateTransactionFields();
  if (tx?.splits?.length) setSplitMode(true, tx.splits);
  else { renderSplitRows([]); setSplitMode(false); }
  refreshTransactionMatches(tx?.recurring_id && tx?.recurring_date ? `${tx.recurring_id}|${tx.recurring_date}` : '');
  if (!tx) applyTransactionRule();
  $('#transaction-title').textContent=tx?'Modifier la transaction':'Ajouter une transaction';
  open('transaction');
}
function updateTransactionFields() {
  const form = $('#transaction-form'), kind=$('#tx-form-kind').value, card = $('#tx-form-method'), matching=['expense','income'].includes(kind);
  if (kind !== 'expense') form.dataset.splitMode = '';
  const splitMode = kind === 'expense' && form.dataset.splitMode === '1';
  $('#tx-category-field').hidden=kind!=='expense' || splitMode;
  $('#tx-splits-field').hidden=!splitMode;
  $('#tx-split-toggle-field').hidden=kind!=='expense' || splitMode;
  $('#tx-remember-field').hidden=kind!=='expense' || splitMode;
  $('#match-field').hidden=!matching;
  $('#tx-match-suggestion').hidden=!matching;
  card.closest('.field').hidden=kind==='income';
  if(kind==='card_payment') card.value='joint';
  if(kind!=='expense') $('#tx-rule-hint').textContent='';
  if(matching){ setText('#match-label',kind==='income'?'Associer à un revenu prévu':'Associer à une facture prévue'); setText('#match-copy',kind==='income'?'Évite de compter deux fois une paie, rente ou allocation déjà prévue.':'Évite de compter deux fois une facture déjà prévue.'); }
}
function prepareLimit(c=null) { const f=$('#limit-form'); f.reset(); f.id.value=c?.id||''; f.name.value=c?.name||''; f.amount.value=c?(c.amount/100).toFixed(2).replace('.',','):''; f.frequency.value=c?.frequency||'w'; f.funding.value=c?.funding||'start'; f.start_date.value=c?.start_date||state.data.today; if(c?.frequency==='m') f.monthly_renewal.value=c.renewal; else f.renewal.value=c?.renewal||'4'; $('#limit-title').textContent=c?'Modifier la limite':'Ajouter une limite'; $('#delete-limit').hidden=!c; updateLimitFields(); open('limit'); }
function updateLimitFields() { const monthly=$('#limit-frequency').value==='m'; $('#limit-weekday').hidden=monthly; $('#limit-monthday').hidden=!monthly; $('#limit-funding').hidden=!monthly; if(!monthly) $('#limit-form').funding.value='start'; }
function prepareRule(rule=null) { const f=$('#recurring-form'); f.reset(); f.id.value=rule?.id||''; f.name.value=rule?.name||''; f.kind.value=rule?.kind||'income'; f.amount.value=rule?(rule.amount/100).toFixed(2).replace('.',','):''; f.frequency.value=rule?.frequency||'m'; f.anchor_date.value=rule?.anchor_date||state.data.today; f.adjustment.value=rule?.adjustment||'auto'; f.method.value=rule?.method||'joint'; $('#recurring-title').textContent=rule?'Modifier la règle':'Ajouter une règle'; $('#delete-recurring').hidden=!rule; open('recurring'); }
function prepareOccurrence(key) { const [rid,due]=key.split('|'); const calendarEvents = state.calendar?.days.flatMap(day => day.events) || [], checkpointEvents = state.data.checkpointActivity?.openEvents || []; const event=[...state.data.upcoming,...calendarEvents,...checkpointEvents].find(e=>String(e.rid)===rid&&e.nominal===due); if(!event)return; const f=$('#occurrence-form'); f.reset(); f.recurring_id.value=rid;f.due_date.value=due;$('#occurrence-copy').textContent=`${event.name} · ${dateFmt(event.due)} · ${money(event.amount)}`;open('occurrence'); }
function updateCheckpointDifference() {
  const value = parseCents($('#checkpoint-bank').value), expected = state.data.settings.expectedBank;
  if (value === null) { setText('#checkpoint-difference', 'Inscrivez le solde vu dans votre banque pour comparer.'); return; }
  const difference = value - expected;
  setText('#checkpoint-difference', difference === 0 ? 'Même montant que le solde prévu.' : difference > 0 ? `${signedMoney(difference)} de plus que le solde prévu. Vérifiez une entrée oubliée ou enregistrez ce nouveau solde.` : `${signedMoney(difference)} de moins que le solde prévu. Vérifiez une dépense oubliée ou enregistrez ce nouveau solde.`);
}
function renderCheckpointReview() {
  const activity = state.data.checkpointActivity || {};
  const transactions = activity.transactions || [], todayEvents = activity.todayEvents || [], openEvents = activity.openEvents || [];
  const checkpoint = state.data.settings.checkpointDate;
  const since = checkpoint ? `depuis le ${dateFmt(checkpoint)}` : 'depuis le dernier solde enregistré';
  const transactionRows = transactions.length ? transactions.map(tx => {
    const label = tx.kind === 'income' ? 'Revenu saisi' : tx.kind === 'card_payment' ? 'Paiement de carte' : 'Dépense saisie';
    return `<button class="checkpoint-review-item" data-review-tx="${tx.id}" type="button"><span><b>${escape(tx.description || label)}</b><small>${dateFmt(tx.date)} · ${label}</small></span><strong class="${tx.impact >= 0 ? 'positive' : 'negative'}">${signedMoney(tx.impact)}</strong></button>`;
  }).join('') : `<p class="checkpoint-review-empty">Aucune opération saisie ne modifie le compte conjoint ${since}. Les achats sur carte n’apparaissent qu’au paiement de la carte.</p>`;
  const todayRows = todayEvents.length ? `<div class="checkpoint-review-group"><small>Prévu aujourd’hui dans le solde</small>${todayEvents.map(event => `<button class="checkpoint-review-item planned" data-review-occurrence="${event.rid}|${event.nominal}" type="button"><span><b>${escape(event.name)}</b><small>${event.kind === 'income' ? 'Revenu prévu' : 'Facture prévue'}</small></span><strong class="${event.impact >= 0 ? 'positive' : 'negative'}">${signedMoney(event.impact)}</strong></button>`).join('')}</div>` : '';
  const openRows = openEvents.length ? `<div class="checkpoint-review-group checkpoint-open-events"><small>Échéance passée à confirmer</small>${openEvents.map(event => `<button class="checkpoint-review-item warning" data-review-occurrence="${event.rid}|${event.nominal}" type="button"><span><b>${escape(event.name)}</b><small>${dateFmt(event.due)} · touchez pour payer, déplacer ou ignorer</small></span><strong class="${event.kind === 'income' ? 'positive' : 'negative'}">${signed(event.amount,event.kind)}</strong></button>`).join('')}</div>` : '';
  const entered = Number(activity.enteredImpact || 0), planned = Number(activity.todayImpact || 0), total = entered + planned;
  const openCount = openEvents.length;
  $('#checkpoint-review').innerHTML = `<div class="checkpoint-review-head"><div><b>Ce qui explique le solde prévu</b><small>${transactions.length ? `${transactions.length} opération${transactions.length > 1 ? 's' : ''} ${since}` : `Aucune opération bancaire ${since}`}</small></div><span class="tag ${total < 0 ? 'negative' : total > 0 ? 'positive' : ''}">${signedMoney(total)}</span></div><div class="checkpoint-summary"><div><small>Entrées comptées</small><b class="positive">+${money(activity.income || 0)}</b></div><div><small>Sorties comptées</small><b class="negative">−${money(activity.outflow || 0)}</b></div><div><small>À décider</small><b class="${openCount ? 'negative' : 'positive'}">${openCount ? `${openCount} échéance${openCount > 1 ? 's' : ''}` : 'Rien'}</b></div></div><div class="checkpoint-review-group"><small>Opérations bancaires saisies</small>${transactionRows}</div>${todayRows}${openRows}`;
}
function prepareCheckpoint() {
  const settings = state.data.settings, form = $('#checkpoint-form');
  form.reset();
  setText('#checkpoint-start', money(settings.bank));
  setText('#checkpoint-date', settings.checkpointDate ? `confirmé ${dateFmt(settings.checkpointDate)}` : 'pas encore confirmé');
  setText('#checkpoint-expected', money(settings.expectedBank));
  const activity = state.data.checkpointActivity || {};
  setText('#checkpoint-flow', `${activity.income ? `+${money(activity.income)}` : '+0,00 $'} · ${activity.outflow ? `−${money(activity.outflow)}` : '−0,00 $'} depuis ce solde`);
  renderCheckpointReview();
  updateCheckpointDifference();
  open('checkpoint');
}
function prepareReview() {
  const data = state.data, settings = data.settings, activity = data.checkpointActivity || {};
  const unclassified = Number(data.review_count || 0), openEvents = activity.openEvents || [];
  const checkpointAge = settings.checkpointAge;
  const needsBalance = checkpointAge === null || checkpointAge === undefined || checkpointAge > 7;
  const week = data.upcoming.filter(event => event.due >= data.today && event.due <= isoPlus(data.today, 6)).slice(0, 5);
  const actions = Number(needsBalance) + Number(unclassified > 0) + Number(openEvents.length > 0);
  setText('#review-intro', actions ? `${actions} chose${actions > 1 ? 's' : ''} mérite${actions > 1 ? 'nt' : ''} votre attention. Faites seulement les actions indiquées; le reste est déjà à jour.` : 'Tout est à jour. Voici simplement ce qui arrive dans les sept prochains jours.');
  const balanceCopy = checkpointAge === null || checkpointAge === undefined ? 'Aucun solde n’a encore été confirmé.' : checkpointAge === 0 ? 'Solde confirmé aujourd’hui.' : `Solde confirmé il y a ${checkpointAge} jour${checkpointAge > 1 ? 's' : ''}.`;
  const classificationCopy = unclassified ? `${unclassified} dépense${unclassified > 1 ? 's' : ''} attend${unclassified > 1 ? 'ent' : ''} une limite.` : 'Toutes les dépenses sont classées.';
  const overdueCopy = openEvents.length ? `${openEvents.length} échéance${openEvents.length > 1 ? 's' : ''} passée${openEvents.length > 1 ? 's' : ''} doit être payée, déplacée ou ignorée.` : 'Aucune échéance passée à décider.';
  $('#review-checks').innerHTML = `<article class="review-check ${needsBalance ? 'needs-action' : 'done'}"><div><small>1 · Solde bancaire</small><b>${needsBalance ? 'À vérifier' : 'En ordre'}</b><span>${balanceCopy}</span></div><button class="${needsBalance ? 'primary' : 'secondary'}" type="button" data-open="checkpoint">Vérifier</button></article><article class="review-check ${unclassified ? 'needs-action' : 'done'}"><div><small>2 · Transactions</small><b>${unclassified ? 'À classer' : 'En ordre'}</b><span>${classificationCopy}</span></div>${unclassified ? `<button class="primary" type="button" data-review-classify>Classer</button>` : '<span class="review-ok">✓</span>'}</article><article class="review-check ${openEvents.length ? 'needs-action' : 'done'}"><div><small>3 · Échéances</small><b>${openEvents.length ? 'À décider' : 'En ordre'}</b><span>${overdueCopy}</span></div>${openEvents.length ? `<button class="primary" type="button" data-review-calendar>Voir</button>` : '<span class="review-ok">✓</span>'}</article>`;
  $('#review-week').innerHTML = `<div class="review-week-head"><div><div class="eyebrow">Les 7 prochains jours</div><h4>Ce qui arrive</h4></div><button class="mini" type="button" data-review-calendar>Calendrier</button></div><div class="review-week-list">${week.length ? week.map(event => `<button class="review-week-item" type="button" data-review-week-occurrence="${event.rid}|${event.nominal}"><span><b>${escape(event.name)}</b><small>${dateFmt(event.due)}</small></span><strong class="${event.kind === 'income' ? 'positive' : 'negative'}">${signed(event.amount,event.kind)}</strong></button>`).join('') : '<p class="review-week-empty">Aucun revenu ou facture dans les sept prochains jours.</p>'}</div>`;
  open('review');
}
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
    if(button.dataset.reviewClassify !== undefined) { close($('#dialog-review')); changePage('transactions'); $('#tx-status').value='unclassified'; renderTransactions(); return; }
    if(button.dataset.reviewCalendar !== undefined) { close($('#dialog-review')); return changePage('calendar'); }
    if(button.dataset.reviewWeekOccurrence) { close($('#dialog-review')); return prepareOccurrence(button.dataset.reviewWeekOccurrence); }
    if(button.dataset.open) { const parentDialog=button.closest('dialog'); if(parentDialog) close(parentDialog); if(button.dataset.open==='transaction')prepareTransaction(); else if(button.dataset.open==='limit')prepareLimit(); else if(button.dataset.open==='recurring')prepareRule(); else if(button.dataset.open==='merchant-rules')prepareMerchantRules(); else if(button.dataset.open==='csv')prepareCsv(); else if(button.dataset.open==='adjust')prepareAdjust(); else if(button.dataset.open==='checkpoint')prepareCheckpoint(); else if(button.dataset.open==='review')prepareReview(); else if(button.dataset.open==='afford'){ $('#afford-form').reset();$('#afford-form').date.value=state.data.today;$('#afford-result').hidden=true;open('afford'); } else open(button.dataset.open); return; }
    if(button.hasAttribute('data-close')) return close(button.closest('dialog'));
    if(button.dataset.useMatch) {
      $('#tx-recurring').value = button.dataset.useMatch;
      $('#transaction-form').dataset.matchManual = '1';
      $('#tx-match-suggestion').hidden = true;
      setText('#match-copy', 'Cette opération marquera cette échéance payée lorsque vous enregistrerez.');
      return;
    }
    if(button.dataset.removeSplit !== undefined) { button.closest('.tx-split-row')?.remove(); updateSplitTotal(); return; }
    if(button.dataset.calendarExpand) return prepareCalendarDay(button.dataset.calendarExpand);
    if(button.dataset.calendarDayTx) { close($('#dialog-calendar-day')); return prepareTransaction(state.data.transactions.find(t=>String(t.id)===button.dataset.calendarDayTx)); }
    if(button.dataset.calendarDayOccurrence) { close($('#dialog-calendar-day')); return prepareOccurrence(button.dataset.calendarDayOccurrence); }
    if(button.dataset.calendarDayPlan) { close($('#dialog-calendar-day')); return changePage('plan'); }
    if(button.dataset.reviewTx) { close($('#dialog-checkpoint')); return prepareTransaction(state.data.transactions.find(t=>String(t.id)===button.dataset.reviewTx)); }
    if(button.dataset.reviewOccurrence) { close($('#dialog-checkpoint')); return prepareOccurrence(button.dataset.reviewOccurrence); }
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
  $('#tx-form-kind').addEventListener('change',()=>{const form=$('#transaction-form');form.dataset.matchManual='';updateTransactionFields();refreshTransactionMatches();applyTransactionRule();});
  $('#tx-form-method').addEventListener('change',()=>{applyTransactionRule();refreshTransactionMatches();});
  $('#tx-description').addEventListener('input',()=>{applyTransactionRule();refreshTransactionMatches();});
  $('#tx-amount').addEventListener('input',()=>{refreshTransactionMatches();updateSplitTotal();});
  $('#tx-date').addEventListener('change',()=>{const form=$('#transaction-form');form.dataset.matchManual='';refreshTransactionMatches();});
  $('#tx-recurring').addEventListener('change',()=>{$('#transaction-form').dataset.matchManual='1';renderMatchSuggestion([]);});
  $('#tx-split-toggle').addEventListener('click',()=>setSplitMode(true));
  $('#tx-single-category').addEventListener('click',()=>setSplitMode(false, currentSplitRows()));
  $('#tx-add-split').addEventListener('click',()=>renderSplitRows([...currentSplitRows(), {category_id:'',amount:''}]));
  $('#tx-split-rows').addEventListener('input',updateSplitTotal);
  $('#tx-split-rows').addEventListener('change',updateSplitTotal);
  $('#limit-frequency').addEventListener('change',updateLimitFields);
  $('#budget-prev').addEventListener('click',()=>{const d=new Date(`${state.month}-01T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()-1);state.month=d.toISOString().slice(0,7);renderBudget();});
  $('#budget-next').addEventListener('click',()=>{const d=new Date(`${state.month}-01T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+1);state.month=d.toISOString().slice(0,7);renderBudget();});
  $('#calendar-prev').addEventListener('click',()=>{const current=state.calendarMonth || state.data.today.slice(0,7), candidate=shiftedMonthClient(current,-1); if(!state.calendar || candidate>=state.calendar.minMonth){state.calendarMonth=candidate;renderCalendar();}});
  $('#calendar-next').addEventListener('click',()=>{const current=state.calendarMonth || state.data.today.slice(0,7), candidate=shiftedMonthClient(current,1); if(!state.calendar || candidate<=state.calendar.maxMonth){state.calendarMonth=candidate;renderCalendar();}});
  $('#calendar-today').addEventListener('click',()=>{state.calendarMonth=state.data.today.slice(0,7);renderCalendar();});
  $('#checkpoint-bank').addEventListener('input',updateCheckpointDifference);
  $('#setup-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await act({...filled(form),action:'setup',complete:true});close(form.closest('dialog'));changePage('plan');toast('Solde enregistré. Ajoutez maintenant vos revenus, factures et limites.');}catch(error){toast(error.message);}});
  $('#checkpoint-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{await act({...filled(form),action:'checkpoint'});close(form.closest('dialog'));}catch(error){toast(error.message);}});
  $('#transaction-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{const v=filled(form), key=v.recurring_key; delete v.recurring_key;if(key){[v.recurring_id,v.recurring_date]=key.split('|');}if(form.dataset.splitMode==='1'){v.splits=currentSplitRows();delete v.category_id;delete v.remember_rule;}await act({...v,action:'transaction'});close(form.closest('dialog'));}catch(error){toast(error.message);}});
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
