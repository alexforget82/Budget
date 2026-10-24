// Record an actual bank repayment only after reviewing canonical server amounts.
export function initialize(runtime) {
  const n = (tag, text, cls) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = text;
      if (cls) e.className = cls;
      return e;
    },
    money = (c) =>
      new Intl.NumberFormat("fr-CA", {
        style: "currency",
        currency: "CAD",
      }).format(c / 100);
  const button = (text, fn) => {
    const b = n("button", text, "secondary");
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  const dialog = n("dialog", undefined, "editor-dialog v131-payment-dialog");
  dialog.id = "actual-card-payment-dialog";
  dialog.setAttribute("aria-labelledby", "actual-payment-title");
  document.body.append(dialog);
  const status = n("p");
  status.id = "actual-payment-status";
  status.setAttribute("role", "status");
  document.getElementById("accounts").after(status);
  let current,
    requestId = 0,
    token = null,
    busy = false;
  function open(card) {
    status.textContent = "";
    const inner = n("div", undefined, "dialog-inner"),
      head = n("div", undefined, "dialog-heading"),
      title = n("h2", "Payer " + card.name);
    title.id = "actual-payment-title";
    head.append(
      title,
      button("Fermer", () => dialog.close()),
    );
    const note = n(
      "p",
      "Enregistrez un paiement déjà effectué auprès de votre banque. Sillage ne fait aucun virement bancaire.",
      "quiet-copy",
    );
    const form = n("form");
    form.id = "actual-card-payment-form";
    const select = n("select");
    select.name = "from_account_id";
    select.required = true;
    const accounts = current.accounts.filter((a) => a.kind !== "credit");
    for (const a of accounts) select.add(new Option(a.name, String(a.id)));
    const preferred =
      current.setup70?.scope?.account_id ||
      accounts.find((a) => a.included)?.id;
    if (preferred) select.value = String(preferred);
    const amount = n("input");
    amount.name = "amount";
    amount.type = "number";
    amount.inputMode = "decimal";
    amount.step = ".01";
    amount.min = ".01";
    amount.required = true;
    const protectedAmount = (current.sts_breakdown?.card_envelopes || [])
      .filter((f) => f.card_account_id === card.id)
      .reduce((v, f) => v + f.amount_cents, 0);
    const suggested =
      protectedAmount > 0 ? protectedAmount : Math.max(0, card.balance_cents);
    if (suggested > 0) amount.value = (suggested / 100).toFixed(2);
    const date = n("input");
    date.type = "date";
    date.name = "happened_on";
    date.required = true;
    date.max = runtime.today();
    date.value = runtime.today();
    for (const [name, input] of [
      ["Compte à débiter", select],
      ["Montant réellement payé ($)", amount],
      ["Date du paiement", date],
    ]) {
      const label = n("label", name);
      label.append(input);
      form.append(label);
    }
    const preview = n("button", "Vérifier le paiement");
    preview.type = "submit";
    form.append(preview);
    const error = n("p");
    error.id = "actual-payment-error";
    error.setAttribute("role", "alert");
    const result = n("section", undefined, "v131-payment-result");
    result.id = "actual-payment-result";
    result.hidden = true;
    result.tabIndex = -1;
    const confirm = button("Confirmer le paiement", async () => {
      if (!token || busy) return;
      busy = true;
      confirm.disabled = true;
      preview.disabled = true;
      error.textContent = "";
      try {
        const s = await post("/api/card-payments/actual-confirm", {
          token,
          acknowledged: ack.checked,
        });
        token = null;
        runtime.render(s);
        dialog.close();
        status.textContent =
          "Paiement enregistré. Le compte bancaire et la carte sont mis à jour.";
      } catch (e) {
        error.textContent = e.message;
        token = null;
        result.hidden = true;
      } finally {
        busy = false;
        preview.disabled = false;
      }
    });
    confirm.id = "actual-payment-confirm";
    const ack = n("input");
    ack.type = "checkbox";
    const duplicate = n(
      "label",
      "Il s’agit d’un autre paiement, déjà effectué.",
    );
    duplicate.className = "v131-duplicate";
    duplicate.append(ack);
    function invalidate() {
      if (!busy) preview.disabled = false;
      requestId++;
      token = null;
      result.hidden = true;
      confirm.disabled = true;
      error.textContent = "";
    }
    form.addEventListener("input", invalidate);
    form.addEventListener("change", invalidate);
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      invalidate();
      const ticket = requestId;
      preview.disabled = true;
      try {
        const r = await post("/api/card-payments/actual-preview", {
          from_account_id: Number(select.value),
          to_account_id: card.id,
          amount: Number(amount.value),
          happened_on: date.value,
          description: "Paiement " + card.name,
        });
        if (ticket !== requestId || !dialog.open) return;
        token = r.token;
        result.replaceChildren(
          n("h3", "Effet du paiement"),
          n(
            "p",
            "Rien n’est enregistré avant votre confirmation.",
            "quiet-copy",
          ),
        );
        const table = n("table"),
          thead = n("thead"),
          header = n("tr");
        for (const title of ["", "Avant", "Après"])
          header.append(n("th", title));
        thead.append(header);
        table.append(thead);
        const body = n("tbody");
        for (const [label, key] of [
          [r.source_name, "source_cents"],
          ["Montant dû · " + r.card_name, "card_cents"],
          ["Disponible à dépenser actuel", "safe_cents"],
          ["Minimum prévu · 30 jours", "minimum_30_cents"],
        ]) {
          const row = n("tr");
          row.append(
            n("th", label),
            n("td", money(r.before[key])),
            n("td", money(r.after[key])),
          );
          body.append(row);
        }
        table.append(body);
        result.append(table);
        const released = r.before.protected_cents - r.after.protected_cents;
        result.append(
          n(
            "p",
            released > 0
              ? money(released) +
                  " de protection sur carte est libérée. Cette somme ne réduit pas votre disponible une deuxième fois."
              : "Ce paiement utilise votre solde bancaire. Une dette ancienne non protégée peut réduire votre disponible.",
            "quiet-copy",
          ),
        );
        if (!r.source_included)
          result.append(
            n("p", "Ce compte bancaire est exclu du Disponible à dépenser.", "warning"),
          );
        if (r.matched_plan)
          result.append(
            n(
              "p",
              "Paiement prévu reconnu : " + r.matched_plan + ".",
              "quiet-copy",
            ),
          );
        for (const warning of r.warnings || [])
          result.append(n("p", warning, "warning"));
        if (r.after.source_cents < 0)
          result.append(
            n(
              "p",
              "Le solde de ce compte bancaire devient négatif.",
              "warning",
            ),
          );
        if (r.after.safe_cents < 0)
          result.append(
            n("p", "Votre Disponible à dépenser devient négatif.", "warning"),
          );
        ack.checked = false;
        duplicate.hidden = !r.duplicates.length;
        if (r.duplicates.length)
          result.append(
            n(
              "p",
              "Un paiement du même montant existe déjà pour cette carte à cette date.",
              "warning",
            ),
          );
        result.append(duplicate, confirm);
        confirm.disabled = !!r.duplicates.length;
        ack.onchange = () =>
          (confirm.disabled = r.duplicates.length > 0 && !ack.checked);
        result.hidden = false;
        result.focus({ preventScroll: true });
        result.scrollIntoView({ block: "nearest", behavior: "auto" });
      } catch (e) {
        if (ticket === requestId) error.textContent = e.message;
      } finally {
        if (ticket === requestId) preview.disabled = false;
      }
    };
    inner.append(head, note, form, error, result);
    dialog.replaceChildren(inner);
    token = null;
    busy = false;
    dialog.showModal();
  }
  async function post(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || "Paiement indisponible. Réessayez.");
    return data;
  }
  dialog.addEventListener("cancel", (e) => {
    if (busy) e.preventDefault();
  });
  dialog.addEventListener("close", () => {
    requestId++;
    token = null;
  });
  function draw(s) {
    current = s;
    for (const card of s.accounts.filter((a) => a.kind === "credit")) {
      const host = document.querySelector(
        `#accounts [data-account-id="${card.id}"] .card-payment-shortcut`,
      );
      if (!host) continue;
      host.querySelector("[data-actual-card-payment]")?.remove();
      const pay = button("Payer cette carte", () => open(card));
      pay.dataset.actualCardPayment = String(card.id);
      host.prepend(pay);
    }
  }
  const prior = runtime.render;
  runtime.render = function (s) {
    const out = prior(s);
    draw(s);
    return out;
  };
  if (runtime.state) draw(runtime.state);
}
