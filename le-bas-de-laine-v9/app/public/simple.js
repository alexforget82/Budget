'use strict';
const money = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
const fmt = value => money.format((Number(value) || 0) / 100);
const date = value => new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
const parse = value => {
  const text = String(value || '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Error('Montant invalide.');
  return Math.round(Number(text) * 100);
};
async function call(path, options = {}) {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Erreur.');
  return data;
}
async function refresh() {
  const state = await call('/simple');
  document.documentElement.dataset.theme = 'system';
  const stamp = String(state.today || '').slice(5);
  document.querySelectorAll('[data-logo]').forEach(image => { image.src = stamp >= '11-15' || stamp <= '01-07' ? '/logo-noel.svg' : '/logo.svg'; });
  document.querySelector('#simpleAvailable').textContent = fmt(state.forecast.available_cents);
  document.querySelector('#simpleMinimum').textContent = `Point le plus bas sur 30 jours : ${fmt(state.forecast.minimum_cents)} · ${date(state.forecast.minimum_date)}`;
  document.querySelector('#simpleUpdated').textContent = `Mis à jour · ${date(state.today)}`;
  document.querySelector('#simpleCheck [name=date]').value = state.today;
}
document.querySelector('#simpleCheck').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#simpleResult');
  try {
    const fields = new FormData(event.currentTarget);
    const data = await call('/check-purchase', { method: 'POST', body: JSON.stringify({ amount_cents: parse(fields.get('amount')), date: fields.get('date') }) });
    result.hidden = false; result.classList.toggle('no', !data.can_afford);
    result.textContent = data.can_afford ? `Oui. Le plus bas resterait à ${fmt(data.minimum_cents)}.` : `Non. Le plus bas tomberait à ${fmt(data.minimum_cents)}.`;
  } catch (error) { result.hidden = false; result.classList.add('no'); result.textContent = error.message; }
});
refresh().catch(error => { document.body.innerHTML = `<main class="simple-app"><p>Impossible d’ouvrir : ${error.message}</p></main>`; });
