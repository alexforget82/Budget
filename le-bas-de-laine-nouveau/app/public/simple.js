'use strict';
const $ = selector => document.querySelector(selector);
const money = cents => new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format((Number(cents)||0)/100);
const date = value => new Intl.DateTimeFormat('fr-CA',{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${value}T12:00:00Z`));
const esc = value => String(value||'').replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
const normalized = value => String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('fr-CA');
let current = null;
async function api(url, body) {
  const response = await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);
  const json = await response.json();
  if (!response.ok || json.error) throw Error(json.error || 'Erreur');
  return json;
}
function amountLine(name, amount, kind, note='') {
  const income = kind === 'income';
  return `<div class="simple-event"><div><b>${esc(name)}</b><small>${esc(note)}</small></div><span class="${income?'positive':'negative'}">${income?'+':'−'}${money(amount)}</span></div>`;
}
async function render() {
  current = await api('/api/state');
  const day = current.daily[0], grocery = current.categories.find(category => normalized(category.name).includes('epicerie')) || null;
  $('#safe').textContent = money(current.current.safe);
  $('#safe-note').textContent = `Prévu pour ${date(current.today)}.`;
  $('#safe30').textContent = money(current.safe30.safe);
  $('#safe30-note').textContent = `Point le plus bas : ${date(current.safe30.date)}.`;
  $('#today-date').textContent = date(current.today);
  $('#grocery').textContent = grocery ? money(grocery.reserve) : '—';
  $('#grocery-note').textContent = grocery ? `Restant · ${grocery.starts.find(start => start > current.today) ? `renouvelle ${date(grocery.starts.find(start => start > current.today))}` : 'prochain renouvellement à venir'}` : 'Ajoutez une limite nommée Épicerie dans Plan.';
  const actual = current.transactions.filter(transaction => transaction.date === current.today).map(transaction => amountLine(transaction.description || (transaction.kind === 'income' ? 'Revenu' : 'Dépense'), transaction.amount, transaction.kind, 'Saisi'));
  const planned = day.events.map(event => amountLine(event.name, event.amount, event.kind, 'Prévu'));
  const limits = day.limitEvents.map(event => amountLine(event.name, event.amount, 'expense', event.funded ? 'Limite mise de côté' : 'Limite renouvelée'));
  const rows = [...actual, ...planned, ...limits];
  $('#events').innerHTML = rows.length ? rows.join('') : '<p class="empty">Aucune opération prévue aujourd’hui.</p>';
}
$('#refresh').addEventListener('click',()=>render().catch(showError));
$('#afford').addEventListener('submit',async event => {
  event.preventDefault();
  try {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api('/api/action',{action:'afford',amount:values.amount,date:current.today});
    const answer = $('#answer'); answer.hidden = false;
    answer.innerHTML = `<b class="${result.afford?'positive':'negative'}">${result.afford?'Oui, cet achat semble possible.':'Non, cet achat ferait passer le disponible sous zéro.'}</b><br>Minimum après l’achat : ${money(result.low)}.`;
  } catch (error) { showError(error); }
});
function showError(error) { document.body.innerHTML=`<main class="simple"><p>${esc(error.message)}</p></main>`; }
document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
let lastRefresh = Date.now();
function refreshWhenBack() {
  if (document.hidden || Date.now() - lastRefresh < 3000) return;
  lastRefresh = Date.now();
  render().catch(showError);
}
document.addEventListener('visibilitychange', refreshWhenBack);
window.addEventListener('focus', refreshWhenBack);
render().catch(showError);
