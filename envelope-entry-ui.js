// Entry and presentation only. Period eligibility and all money remain server-owned.
export function initialize(runtime) {
  const $ = (id) => document.getElementById(id);
  const node = (tag, text) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const form = $('transaction'), panel = node('fieldset');
  panel.id = 'envelope-entry-period';
  panel.hidden = true;
  panel.className = 'envelope-entry-period';
  const error = node('p');
  error.setAttribute('role', 'status');
  let serial = 0, key = '', choices = [], pending = Promise.resolve(), selected = '', previewFailed = false;
  const draft = () => ({
    account_id: form.elements.account_id.value,
    envelope_id: form.elements.envelope_id.value,
    description: form.elements.description.value.trim(),
    amount: -Number(form.elements.amount.value),
    happened_on: form.elements.happened_on.value,
    category_id: form.elements.category_id.value,
    subcategory_id: form.elements.subcategory_id?.value || '',
  });
  const formatDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-CA', {day:'numeric',month:'short'});
  function paint() {
    panel.replaceChildren(node('legend', 'Compter dans quelle période ?'));
    if (!choices.length) { panel.hidden = true; return; }
    panel.hidden = false;
    for (const [value, label] of [['', 'Période actuelle'], ...choices.map(c => [c.date, 'Période du ' + formatDate(c.date)])]) {
      const row = node('label'), radio = node('input');
      radio.type = 'radio'; radio.name = 'entry_period_choice'; radio.value = value;
      radio.checked = selected === value;
      radio.onchange = () => { selected = value; error.textContent = ''; };
      row.append(radio, node('span', label)); panel.append(row);
    }
    panel.append(node('p', 'La date réelle de l’achat reste inchangée. Le budget choisi reste ouvert pour les autres achats.'), error);
  }
  function refresh() {
    const data = draft(), nextKey = JSON.stringify(data);
    if (key === nextKey) return pending;
    key = nextKey; const ticket = ++serial;
    choices = []; selected = ''; previewFailed = false; paint();
    if ($('transaction-direction').value !== 'expense' || !data.envelope_id || !data.account_id || !data.description || !(data.amount < 0) || !data.happened_on) return pending = Promise.resolve();
    pending = (async () => {
      try {
        const r = await fetch('/api/envelopes/period-preview', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:data})});
        const out = await r.json();
        if (ticket !== serial) return;
        if (!r.ok) throw Error(out.error || 'Impossible de vérifier la période.');
        choices = out.choices; paint();
      } catch (e) {
        if (ticket !== serial) return;
        panel.hidden = false; panel.replaceChildren(node('legend', 'Période à vérifier'), error);
        error.textContent = e.message; key = ''; previewFailed = true;
      }
    })();
    return pending;
  }
  form.querySelector('.entry-submit-actions')?.before(panel);
  if (!panel.isConnected) form.append(panel);
  // Merchant proposals run first; read the final visible field values on the next microtask.
  let timer;
  for (const event of ['input', 'change']) form.addEventListener(event, (e) => {
    if (e.target.name === 'entry_period_choice') return;
    clearTimeout(timer);
    // Clear the old decision immediately; only compute a forecast once typing pauses.
    serial++; key = ''; choices = []; selected = ''; paint();
    timer = setTimeout(refresh, 180);
  });
  $('transaction-dialog').addEventListener('close', () => { clearTimeout(timer); serial++; key = ''; choices = []; selected = ''; paint(); });
  const send = runtime.send;
  let saving = false;
  runtime.send = async function(url, data) {
    if (url !== '/api/transactions') return send(url, data);
    if (saving) return false;
    saving = true;
    const buttons = [...form.querySelectorAll('button[type=submit],.entry-submit-actions button')];
    buttons.forEach(b => b.disabled = true);
    try {
    clearTimeout(timer);
    await refresh(); await pending;
    if (previewFailed) return false;
    const choice = choices.find(c => c.date === selected);
    const out = await send(url, choice ? {...data, budget_period_on: choice.date, budget_period_signature: choice.signature} : data);
    if (out) { key = ''; choices = []; selected = ''; paint(); }
    else if (choice) { key = ''; choices = []; selected = ''; paint(); await refresh(); error.textContent = 'Vérifiez à nouveau la période avant de réessayer.'; }
    return out;
    } finally { saving = false; buttons.forEach(b => b.disabled = false); }
  };

  // Keep the original fields and handlers, including legacy dated envelopes.
  const envelope = $('envelope'), advanced = node('details');
  advanced.id = 'envelope-entry-advanced';
  advanced.append(node('summary', 'Options avancées'));
  for (const name of ['reserved', 'forecast_spend', 'forecast_account_id', 'active']) advanced.append(envelope.elements[name].closest('label'));
  advanced.append($('envelope-mode-help'), $('envelope-reserve-help'));
  const payment = node('button', 'Programmer une facture dans Récurrences');
  payment.type = 'button';
  payment.onclick = () => {
    envelope.closest('dialog').close();
    document.querySelector('.app-shell-nav [data-view="recurrences"]').click();
    runtime.resetRec();
    $('rec-type').value = 'expense';
    $('rec-type').dispatchEvent(new Event('change', {bubbles:true}));
    window.appOpenEditor('recurring');
  };
  advanced.append(payment);
  $('envelope-save').before(advanced);
  envelope.elements.start_on.closest('label').firstChild.textContent = 'À partir du';
  envelope.elements.rollover.closest('label').firstChild.textContent = 'Que faire du restant ?';
  envelope.elements.rollover.closest('label').classList.add('envelope-entry-rollover');
  envelope.elements.rollover.querySelector('option[value=true]').textContent = 'Reporter le restant';
  envelope.elements.rollover.querySelector('option[value=false]').textContent = 'Repartir avec le budget prévu';
  const intro = node('p', 'Nommez votre enveloppe, choisissez son montant et son rythme. Les achats réels utiliseront ce budget.');
  intro.className = 'envelope-entry-intro'; envelope.prepend(intro);
  function syncEnvelope() {
    const dated = envelope.elements.forecast_spend.value === 'true';
    // Existing dates, reserves and account choices are never reset by this presentation.
    advanced.open = dated || !!envelope.elements.id.value && advanced.open;
    envelope.elements.start_on.closest('label').firstChild.textContent = dated ? 'Date du paiement prévu' : 'À partir du';
  }
  const open = window.appOpenEditor;
  window.appOpenEditor = function(name) {
    const out = open(name);
    if (name === 'envelope') { advanced.open = false; syncEnvelope(); }
    if (name === 'transaction') { key = ''; queueMicrotask(refresh); }
    if (name === 'recurring' && runtime.state) recurringChoices(runtime.state);
    return out;
  };
  envelope.elements.forecast_spend.addEventListener('change', syncEnvelope);
  function recurringChoices(state) {
    const select = $('rec-envelope'), type = $('rec-type');
    const editing = !!$('recurring').elements.id.value;
    for (const option of select.options) {
      const e = state.envelopes.find(e => String(e.id) === option.value);
      option.hidden = !editing && !!e && e.active && e.frequency !== 'none';
      option.disabled = option.hidden;
    }
    const reserve = type.querySelector('option[value="reserve"]');
    reserve.hidden = !editing && !state.envelopes.some(e => e.active && e.frequency === 'none');
    reserve.disabled = reserve.hidden;
  }
  const render = runtime.render;
  runtime.render = function(state) { const out = render(state); recurringChoices(state); return out; };

  if (runtime.state) recurringChoices(runtime.state);
}
