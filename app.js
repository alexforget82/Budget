// Core state is private to this initializer; other domains receive explicit live accessors.
export function initialize(runtime) {
  window.addEventListener("error", (e) => {
    const el = document.getElementById("error");
    if (el) el.textContent = "Erreur interface : " + e.message;
  });
  window.addEventListener("unhandledrejection", (e) => {
    const el = document.getElementById("error");
    if (el)
      el.textContent =
        "Erreur interface : " + String(e.reason?.message || e.reason);
  });

  const $ = (id) => document.getElementById(id),
    money = (c) =>
      (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  let state;
  const today = () => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  };
  $("real-transfer").elements.happened_on.value = today();
  $("transaction").elements.happened_on.value = today();
  $("recurring").elements.start_on.value = today();
  const adjustments = {
    none: "Date inchangée",
    before: "Avant week-end/férié",
    after: "Après week-end/férié",
  };
  const types = {
      transfer: "Virement",
      income: "Revenu",
      expense: "Dépense",
      reserve: "Réserve",
    },
    freq = {
      weekly: "Hebdomadaire",
      biweekly: "Aux 2 semaines",
      monthly: "Mensuelle",
      quarterly: "Aux 3 mois",
      semiannual: "Aux 6 mois",
      yearly: "Annuelle",
      last_business_day: "Dernier jour ouvrable du mois",
      rrq: "Dernier jour ouvrable du mois",
    };
  function fill(id, items, empty = false) {
    const el = $(id),
      old = el.value;
    el.replaceChildren();
    if (empty) el.add(new Option("Aucune", ""));
    for (const a of items) el.add(new Option(a.name, a.id));
    if ([...el.options].some((o) => o.value === old)) el.value = old;
  }
  let transactionAccountInitialized = false;
  function selectDefaultTransactionAccount(accounts) {
    const selector = $("account-options");
    const conjoint = accounts.find(
      (a) => a.name.trim().toLocaleLowerCase("fr-CA") === "conjoint",
    );
    if (
      conjoint &&
      [...selector.options].some((o) => o.value === String(conjoint.id))
    ) {
      selector.value = String(conjoint.id);
    }
  }
  function list(id, items, fn) {
    const ul = $(id);
    ul.replaceChildren();
    items.forEach((a) => {
      const li = document.createElement("li");
      li.textContent = fn(a);
      ul.append(li);
    });
  }
  function cell(tr, value) {
    const td = document.createElement("td");
    td.textContent = value;
    tr.append(td);
    return td;
  }
  function renderTransactions(transactions) {
    const host = $("transactions");
    host.replaceChildren();
    const mode = $("transaction-filter").value;
    const pending = transactions.filter((t) => !t.reviewed).length;
    $("transaction-count").textContent =
      pending + " à vérifier sur " + transactions.length + " affichées";
    const visible = transactions.filter(
      (t) =>
        mode === "all" || (mode === "reviewed" ? !!t.reviewed : !t.reviewed),
    );
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "transaction-empty";
      empty.textContent = "Aucune transaction dans cette vue.";
      host.append(empty);
      return;
    }
    for (const t of visible) {
      const line = document.createElement("div");
      line.className = "transaction-item" + (t.reviewed ? " is-reviewed" : "");
      const label = document.createElement("label");
      label.className = "review-choice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!t.reviewed;
      checkbox.setAttribute(
        "aria-label",
        "Marquer " + t.description + " comme traitée",
      );
      const status = document.createElement("span");
      status.textContent = t.reviewed ? "Traitée" : "À vérifier";
      label.append(checkbox, status);
      checkbox.onchange = async () => {
        line.classList.add("optimistic-pending");
        status.textContent = checkbox.checked ? "Traitée" : "À vérifier";
        try {
          const response = await fetch("/api/transactions/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: t.id, reviewed: checkbox.checked }),
          });
          const data = await response.json();
          if (!response.ok) throw Error(data.error || "Erreur");
          render(data);
        } catch (e) {
          alert("Impossible de modifier le statut : " + e.message);
          line.classList.remove("optimistic-pending");
          checkbox.checked = !checkbox.checked;
          status.textContent = checkbox.checked ? "Traitée" : "À vérifier";
        }
      };
      const details = document.createElement("div");
      details.className = "transaction-details";
      const title = document.createElement("strong");
      title.textContent = t.description;
      const sub = document.createElement("div");
      sub.className = "transaction-meta";
      sub.textContent =
        t.happened_on +
        " · " +
        t.account_name +
        (t.envelope_name ? " · " + t.envelope_name : "");
      details.append(title, sub);
      const amount = document.createElement("strong");
      amount.className =
        "transaction-amount" + (t.amount_cents < 0 ? " negative" : "");
      amount.textContent = money(t.amount_cents);
      line.append(label, details, amount);
      host.append(line);
    }
  }
  $("transaction-filter").onchange = () => {
    if (state) renderTransactions(state.transactions);
  };
  function renderRealTransfers(items) {
    const host = $("real-transfers");
    host.replaceChildren();
    for (const t of items) {
      const tr = document.createElement("tr");
      cell(tr, t.happened_on);
      cell(tr, t.description + " · " + t.from_name + " → " + t.to_name);
      cell(tr, money(t.amount_cents));
      const actions = document.createElement("td");
      actions.className = "actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Modifier";
      edit.onclick = () => window.v2Edit?.("transfer", t.id);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "Supprimer";
      del.onclick = () => window.v2Delete?.("transfer", t.id);
      actions.append(edit, del);
      tr.append(actions);
      host.append(tr);
    }
  }
  function renderAccounts(accounts) {
    const host = $("accounts");
    host.replaceChildren();
    for (const a of [...accounts].sort((x, y) =>
      x.name.localeCompare(y.name, "fr-CA", { sensitivity: "base" }),
    )) {
      const line = document.createElement("div");
      line.className = "account-item";
      const details = document.createElement("div");
      details.className = "account-details";
      const title = document.createElement("strong");
      title.textContent = a.name;
      const info = document.createElement("span");
      info.className = "account-type";
      info.textContent =
        a.kind === "credit"
          ? "Crédit / marge"
          : a.kind === "savings"
            ? "Épargne"
            : "Chèques";
      details.append(title, info);
      const amount = document.createElement("strong");
      amount.className = "account-amount";
      amount.textContent = a.simple_credit ? "Sans suivi du solde" : money(a.balance_cents);
      const label = document.createElement("label");
      label.className = "account-choice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = a.kind !== "credit" && !!a.included;
      checkbox.disabled = a.kind === "credit";
      checkbox.setAttribute(
        "aria-label",
        "Inclure " + a.name + " dans le Disponible à dépenser",
      );
      const labelText = document.createElement("span");
      labelText.textContent = a.kind === "credit" ? "Exclu" : "Disponible";
      label.append(checkbox, labelText);
      checkbox.onchange = async () => {
        const desired = checkbox.checked;
        line.classList.add("optimistic-pending");
        try {
          const response = await fetch("/api/accounts/inclusion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: a.id, included: desired }),
          });
          const result = await response.json();
          if (!response.ok)
            throw Error(result.error || "Enregistrement impossible");
          render(result);
        } catch (err) {
          checkbox.checked = !desired;
          line.classList.remove("optimistic-pending");
          alert("Impossible de modifier ce compte : " + err.message);
        }
      };
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary account-edit";
      btn.textContent = "Modifier";
      btn.onclick = () => editAccount(a.id);
      line.append(details, amount, label, btn);
      host.append(line);
    }
  }
  function accountKind() {
    const credit = $("account-kind").value === "credit";
    $("account-included").disabled = credit;
    if (credit) $("account-included").checked = false;
    $("account-simple-label").hidden = !credit;
    const simple = credit && $("account-simple").checked;
    $("account-simple-help").hidden = !simple;
    const balance = $("account").elements.balance;
    balance.closest("label").hidden = simple;
    balance.required = !simple;
    balance.disabled = simple;
  }
  $("account-kind").onchange = accountKind;
  $("account-simple").onchange = accountKind;
  function editAccount(id) {
    const a = state.accounts.find((a) => a.id === id);
    if (!a) return;
    const f = $("account");
    f.elements.id.value = a.id;
    f.elements.name.value = a.name;
    f.elements.kind.value = a.kind;
    $("account-simple").checked = !!a.simple_credit;
    f.elements.balance.value = (a.balance_cents / 100).toFixed(2);
    $("account-included").checked = !!a.included && a.kind !== "credit";
    accountKind();
    $("account-save").textContent = "Enregistrer les modifications";
    $("account-cancel").classList.remove("hidden");
    window.appOpenEditor?.("account");
  }
  function resetAccount() {
    const f = $("account");
    f.reset();
    f.elements.id.value = "";
    $("account-included").checked = true;
    $("account-save").textContent = "Ajouter le compte";
    $("account-cancel").classList.add("hidden");
    accountKind();
  }
  $("account-cancel").onclick = resetAccount;
  function envelopeModeHelp() {
    const f = $("envelope"),
      reserved = f.elements.forecast_spend.value === "false",
      target = state?.accounts?.find(
        (a) => String(a.id) === f.elements.forecast_account_id.value,
      ),
      source =
        state?.accounts?.filter((a) => a.included && a.kind !== "credit") || [],
      funding =
        !reserved &&
        target &&
        target.kind !== "credit" &&
        !target.included &&
        source.length === 1;
    $("envelope-mode-help").textContent = funding
      ? "Un virement de " +
        source[0].name +
        " vers " +
        target.name +
        " sera prévu à chaque date, même avec une réserve actuelle de 0 $. Confirmez-le dans Prévu / Réel ou associez un virement existant. Les achats personnels ne sont pas un deuxième débit du compte commun."
      : reserved
        ? "L’argent réservé est exclu du Disponible à dépenser. Les achats réels consomment cette réserve au fil de la période. Sur carte, la somme reste protégée jusqu’au remboursement, sans deuxième déduction. Avec « Conserver le restant », chaque nouvelle période protège le budget complet en plus du restant. Ce mode ne crée aucun paiement ni virement bancaire."
        : "Le budget est simulé comme une sortie bancaire à chaque date programmée. Utilisez ce mode quand la date du paiement est connue.";
    $("envelope-reserve-help").hidden = !reserved;
    f.elements.forecast_account_id.disabled = reserved;
    f.elements.forecast_account_id.closest("label").hidden = reserved;
  }
  $("envelope").elements.forecast_spend.addEventListener(
    "change",
    envelopeModeHelp,
  );
  $("envelope-forecast-account").addEventListener("change", envelopeModeHelp);
  envelopeModeHelp();
  function resetEnvelope() {
    const f = $("envelope");
    f.reset();
    f.elements.id.value = "";
    f.elements.reserved.value = "0";
    f.elements.budget.value = "0";
    f.elements.start_on.value = today();
    $("envelope-save").textContent = "Créer";
    $("envelope-cancel").classList.add("hidden");
    envelopeModeHelp();
  }
  $("envelope-cancel").onclick = resetEnvelope;
  function editEnvelope(id) {
    const e = state.envelopes.find((x) => x.id === id);
    if (!e) return;
    const f = $("envelope");
    f.elements.id.value = e.id;
    f.elements.name.value = e.name;
    f.elements.reserved.value = (e.reserved_cents / 100).toFixed(2);
    f.elements.budget.value = (e.budget_cents / 100).toFixed(2);
    f.elements.frequency.value = e.frequency || "none";
    f.elements.start_on.value = e.start_on || today();
    f.elements.rollover.value = e.rollover ? "true" : "false";
    f.elements.active.value = e.active ? "true" : "false";
    f.elements.forecast_account_id.value = e.forecast_account_id || "";
    f.elements.forecast_spend.value = e.forecast_spend === 0 ? "false" : "true";
    $("envelope-save").textContent = "Enregistrer";
    $("envelope-cancel").classList.remove("hidden");
    envelopeModeHelp();
    window.appOpenEditor?.("envelope");
  }
  async function deleteEnvelope(id) {
    const e = state.envelopes.find((x) => x.id === id);
    if (
      !e ||
      !confirm("Supprimer définitivement l’enveloppe « " + e.name + " » ?")
    )
      return;
    await send("/api/envelopes/delete", { id });
  }
  function renderEnvelopes(items) {
    const host = $("envelopes");
    host.replaceChildren();
    if (!items.length) {
      host.textContent = "Aucune enveloppe pour le moment.";
      return;
    }
    for (const e of items) {
      const line = document.createElement("div");
      line.className = "envelope-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = e.name;
      title.classList.add("editable-value");
      title.title = "Cliquer pour modifier";
      title.tabIndex = 0;
      title.onclick = () => editEnvelope(e.id);
      title.onkeydown = (ev) => {
        if (ev.key === "Enter") editEnvelope(e.id);
      };
      const meta = document.createElement("div");
      meta.className = "sub";
      meta.textContent =
        money(e.reserved_cents) +
        " réservés · " +
        (e.frequency === "none"
          ? "Sans renouvellement"
          : money(e.budget_cents) +
            " / " +
            freq[e.frequency] +
            " · dès le " +
            e.start_on +
            (e.rollover ? " · report" : " · sans report")) +
        (e.active ? "" : " · Suspendue");
      info.append(title, meta);
      const actions = document.createElement("div");
      actions.className = "envelope-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "Modifier";
      edit.onclick = () => editEnvelope(e.id);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "Supprimer";
      del.onclick = () => deleteEnvelope(e.id);
      actions.append(edit, del);
      line.append(info, actions);
      host.append(line);
    }
  }
  $("envelope").elements.start_on.value = today();
  function renderSpendingWindows(w) {
    if (!w) return;
    for (const [id, value] of [
      ["sts-today", w.today_cents],
      ["sts-week", w.week_cents],
      ["sts-pay", w.payday_cents],
    ]) {
      const el = $(id);
      el.textContent = value === null ? "Non disponible" : money(value);
      el.classList.toggle("negative", value !== null && value < 0);
      el.classList.toggle("missing", value === null);
    }
    $("sts-week-detail").textContent =
      "Minimum prévu jusqu’au " + (w.week_end || "dimanche");
    $("sts-pay-detail").textContent = w.payday_found
      ? "Avant la paie du " +
        w.payday_date +
        (w.payday_names?.length ? " · " + w.payday_names.join(", ") : "")
      : "Aucun revenu admissible prévu sous 30 jours";
  }
  const stateRenderCache = {};
  function render(s) {
    state = s;
    const ri = $("reconcile-info");
    if (ri)
      ri.textContent =
        " · " +
        (s.reconciliation?.matched_count || 0) +
        " opération(s) réelle(s) rapprochée(s)";
    renderSpendingWindows(s.spending_windows);
    $("cash").textContent = money(s.cash_cents);
    $("reserved").textContent = money(s.reserved_cents);
    $("safe").textContent = money(s.safe_cents);
    $("safe").className = "number " + (s.safe_cents < 0 ? "red" : "green");
    const low = Math.min(s.safe_cents, ...s.forecast.map((d) => d.safe_cents));
    $("low").textContent = money(low);
    $("low").className = "number " + (low < 0 ? "red" : "green");
    if (
      !stateRenderCache.accounts ||
      JSON.stringify(s.accounts) !== stateRenderCache.accounts
    ) {
      renderAccounts(s.accounts);
      stateRenderCache.accounts = JSON.stringify(s.accounts);
    }
    if (
      !stateRenderCache.transfers ||
      JSON.stringify(s.transfers || []) !== stateRenderCache.transfers
    ) {
      renderRealTransfers(s.transfers || []);
      stateRenderCache.transfers = JSON.stringify(s.transfers || []);
    }
    if (
      !stateRenderCache.envelopes ||
      JSON.stringify(s.envelopes) !== stateRenderCache.envelopes
    ) {
      renderEnvelopes(s.envelopes);
      stateRenderCache.envelopes = JSON.stringify(s.envelopes);
    }
    if (
      !stateRenderCache.transactions ||
      JSON.stringify(s.transactions) !== stateRenderCache.transactions
    ) {
      renderTransactions(s.transactions);
      stateRenderCache.transactions = JSON.stringify(s.transactions);
    }
    for (const id of [
      "account-options",
      "rec-account",
      "rec-to",
      "transfer-from",
      "transfer-to",
    ])
      fill(id, s.accounts, id === "rec-to");
    fill("envelope-forecast-account", s.accounts, true);
    $("envelope-forecast-account").options[0].text =
      "À choisir — déduit du total inclus";
    fill(
      "override-rule",
      [...s.recurring]
        .sort((a, b) =>
          a.description.localeCompare(b.description, "fr-CA", {
            sensitivity: "base",
            numeric: true,
          }),
        )
        .map((r) => ({
          id: r.id,
          name: r.description + " — " + money(r.amount_cents),
        })),
    );
    for (const id of ["envelope-options", "rec-envelope"])
      fill(id, s.envelopes, true);
    if (!transactionAccountInitialized) {
      selectDefaultTransactionAccount(s.accounts);
      transactionAccountInitialized = true;
    }
    const groupContainer = $("rec-groups");
    const recSig = JSON.stringify([
      s.recurring,
      s.accounts.map((a) => [a.id, a.name]),
      s.envelopes.map((e) => [e.id, e.name]),
    ]);
    if (stateRenderCache.recurring !== recSig) {
      groupContainer.replaceChildren();
      stateRenderCache.recurring = recSig;
      const accountNames = new Map(
        s.accounts.map((a) => [Number(a.id), a.name]),
      );
      const envelopeNames = new Map(
        s.envelopes.map((e) => [Number(e.id), e.name]),
      );
      const categories = [
        { type: "income", name: "Revenus", icon: "↗" },
        { type: "expense", name: "Factures et dépenses", icon: "↘" },
        { type: "transfer", name: "Virements entre comptes", icon: "⇄" },
        { type: "reserve", name: "Réserves et enveloppes", icon: "◈" },
      ];
      for (const cat of categories) {
        const entries = s.recurring
          .filter((r) => r.type === cat.type)
          .sort(
            (a, b) =>
              a.description.localeCompare(b.description, "fr-CA", {
                sensitivity: "base",
                numeric: true,
              }) || a.id - b.id,
          );
        const group = document.createElement("div");
        group.className = "rec-group";
        group.dataset.type = cat.type;
        const header = document.createElement("div");
        header.className = "rec-group-head";
        const ico = document.createElement("span");
        ico.className = "rec-icon";
        ico.textContent = cat.icon;
        const title = document.createElement("span");
        title.className = "rec-group-title";
        title.textContent = cat.name;
        const count = document.createElement("span");
        count.className = "rec-group-count";
        count.textContent =
          entries.length + " règle" + (entries.length === 1 ? "" : "s");
        header.append(ico, title, count);
        group.append(header);
        if (!entries.length) {
          const empty = document.createElement("div");
          empty.className = "rec-group-empty";
          empty.textContent = "Aucune récurrence pour le moment.";
          group.append(empty);
        } else {
          const scroll = document.createElement("div");
          scroll.className = "scroll";
          const table = document.createElement("table");
          const thead = document.createElement("thead");
          const heading = document.createElement("tr");
          for (const label of [
            "Règle et calendrier",
            "Montant",
            "État",
            "Actions",
          ]) {
            const th = document.createElement("th");
            th.textContent = label;
            heading.append(th);
          }
          thead.append(heading);
          table.append(thead);
          const tbody = document.createElement("tbody");
          for (const r of entries) {
            const tr = document.createElement("tr");
            const desc = document.createElement("td");
            const name = document.createElement("div");
            name.className = "rec-name";
            name.textContent = r.description;
            name.classList.add("editable-value");
            name.title = "Cliquer pour modifier";
            name.tabIndex = 0;
            name.onclick = () => editRule(r.id);
            name.onkeydown = (ev) => {
              if (ev.key === "Enter") editRule(r.id);
            };
            const meta = document.createElement("div");
            meta.className = "rec-meta";
            meta.textContent = `${r.start_on} · ${freq[r.frequency] || r.frequency} · ${adjustments[r.day_adjust || "none"]}`;
            desc.append(name);
            const accountTag = document.createElement("div");
            accountTag.className =
              "rec-account" +
              (r.type === "transfer"
                ? " transfer"
                : r.type === "reserve"
                  ? " reserve"
                  : "");
            const source =
              accountNames.get(Number(r.account_id)) || "Compte non attribué";
            const destination =
              accountNames.get(Number(r.to_account_id)) ||
              "Compte non attribué";
            const envelope =
              envelopeNames.get(Number(r.envelope_id)) ||
              "Enveloppe non attribuée";
            accountTag.textContent =
              r.type === "transfer"
                ? "⇄ " + source + " → " + destination
                : r.type === "reserve"
                  ? "◈ " + envelope
                  : r.type === "income"
                    ? "↘ Déposé dans : " + source
                    : "↗ Prélevé de : " + source;
            desc.append(accountTag, meta);
            tr.append(desc);
            const amt = cell(tr, money(r.amount_cents));
            amt.className = "rec-amount editable-value";
            amt.title = "Cliquer pour modifier";
            amt.tabIndex = 0;
            amt.onclick = () => editRule(r.id);
            amt.onkeydown = (ev) => {
              if (ev.key === "Enter") editRule(r.id);
            };
            const statusTd = document.createElement("td");
            const status = document.createElement("span");
            status.className = "rec-status" + (r.active ? "" : " off");
            status.textContent = r.active ? "Actif" : "Suspendu";
            statusTd.append(status);
            tr.append(statusTd);
            const td = document.createElement("td"),
              actions = document.createElement("div");
            actions.className = "actions";
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "secondary";
            edit.textContent = "Modifier";
            edit.onclick = () => editRule(r.id);
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "secondary";
            toggle.textContent = r.active ? "Suspendre" : "Réactiver";
            toggle.onclick = () =>
              send("/api/recurring/update", {
                ...r,
                amount: r.amount_cents / 100,
                active: !r.active,
              });
            const del = document.createElement("button");
            del.type = "button";
            del.className = "danger";
            del.textContent = "Supprimer";
            del.onclick = () => {
              if (confirm("Supprimer cette règle ?"))
                send("/api/recurring/delete", { id: r.id });
            };
            actions.append(edit, toggle, del);
            td.append(actions);
            tr.append(td);
            tbody.append(tr);
          }
          table.append(tbody);
          scroll.append(table);
          group.append(scroll);
        }
        groupContainer.append(group);
      }
    }
    $("override-list").replaceChildren();
    for (const o of s.overrides) {
      const tr = document.createElement("tr");
      const rule = s.recurring.find((r) => r.id === o.recurring_id);
      cell(tr, rule?.description || "Règle supprimée");
      cell(tr, o.occurrence_on);
      cell(tr, money(o.amount_cents));
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "secondary";
      btn.textContent = "Retirer l’exception";
      btn.onclick = () => send("/api/overrides/delete", { id: o.id });
      td.append(btn);
      tr.append(td);
      $("override-list").append(tr);
    }
    if (stateRenderCache.forecast !== JSON.stringify(s.forecast)) {
      renderForecast(s.forecast);
      stateRenderCache.forecast = JSON.stringify(s.forecast);
    }
    toggleType();
  }
  const forecastOpenDates = new Set();
  let forecastInitialized = false;
  function renderForecast(days) {
    const host = $("forecast");
    host.replaceChildren();
    const labels = {
      income: "↗ Revenus",
      expense: "↘ Dépenses",
      transfer: "⇄ Virements",
      reserve: "◈ Réserves",
    };
    const order = ["income", "expense", "transfer", "reserve"];
    const dateLabel = (d) =>
      new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    if (!forecastInitialized) {
      forecastInitialized = true;
      const first = days.find((d) => d.events.length);
      if (first) forecastOpenDates.add(first.date);
    }
    for (const day of days) {
      const details = document.createElement("div");
      details.className =
        "forecast-day" + (day.events.length ? " has-events" : "");
      details.dataset.date = day.date;
      details.style.cssText =
        "display:block;min-height:52px;flex:none;box-sizing:border-box";
      const summary = document.createElement("button");
      summary.type = "button";
      summary.className = "forecast-day-summary";
      const initiallyOpen = forecastOpenDates.has(day.date);
      details.classList.toggle("is-open", initiallyOpen);
      summary.style.cssText =
        "display:flex!important;align-items:center;gap:12px;width:100%;min-height:50px;height:auto;box-sizing:border-box;padding:11px 13px;visibility:visible;opacity:1;";
      summary.setAttribute("aria-expanded", String(initiallyOpen));
      summary.setAttribute(
        "aria-label",
        "Afficher ou masquer les opérations du " + dateLabel(day.date),
      );
      const left = document.createElement("span");
      left.className = "forecast-day-date";
      left.textContent = dateLabel(day.date);
      left.style.cssText = "display:block;min-width:115px;flex:1 1 135px;";
      const chips = document.createElement("span");
      chips.className = "forecast-day-chips";
      chips.style.cssText =
        "display:flex;flex:2 1 200px;gap:5px;flex-wrap:wrap;";
      for (const type of order) {
        const entries = day.events.filter((e) => e.type === type);
        if (!entries.length) continue;
        const chip = document.createElement("span");
        chip.className = "forecast-chip " + type;
        chip.textContent =
          (type === "income" ? "+" : type === "expense" ? "−" : "") +
          money(entries.reduce((n, e) => n + e.amount_cents, 0));
        chip.title = labels[type] + " (" + entries.length + ")";
        chips.append(chip);
      }
      if (!day.events.length) {
        const none = document.createElement("span");
        none.className = "forecast-quiet";
        none.textContent = "Aucun mouvement";
        chips.append(none);
      }
      const available = document.createElement("span");
      available.className =
        "forecast-day-safe" + (day.safe_cents < 0 ? " negative" : "");
      available.textContent = money(day.safe_cents);
      available.style.cssText =
        "display:block;min-width:95px;flex:0 0 auto;text-align:right;";
      const arrow = document.createElement("span");
      arrow.className = "forecast-chevron";
      arrow.textContent = "⌄";
      arrow.setAttribute("aria-hidden", "true");
      arrow.style.cssText = "display:block;flex:0 0 14px;";
      summary.append(left, chips, available, arrow);
      details.append(summary);
      const body = document.createElement("div");
      body.className = "forecast-day-body";
      const stats = document.createElement("div");
      stats.className = "forecast-day-stats";
      for (const [name, value] of [
        ["Solde admissible", day.cash_cents],
        ["Réserves", day.reserved_cents],
        ["Disponible projeté", day.safe_cents],
      ]) {
        const item = document.createElement("span");
        const label = document.createElement("small");
        label.textContent = name;
        const strong = document.createElement("strong");
        strong.textContent = money(value);
        item.append(label, strong);
        stats.append(item);
      }
      body.append(stats);
      if (day.events.length) {
        const groups = document.createElement("div");
        groups.className = "forecast-day-groups";
        for (const type of order) {
          const entries = day.events.filter((e) => e.type === type);
          if (!entries.length) continue;
          const box = document.createElement("div");
          box.className = "forecast-event-group " + type;
          const head = document.createElement("div");
          head.className = "forecast-group-head";
          const label = document.createElement("span");
          label.textContent = labels[type] + " · " + entries.length;
          const total = document.createElement("span");
          total.textContent =
            (type === "expense" ? "−" : type === "income" ? "+" : "") +
            money(entries.reduce((n, e) => n + e.amount_cents, 0));
          head.append(label, total);
          box.append(head);
          for (const e of entries) {
            const line = document.createElement("div");
            line.className = "forecast-event-item";
            const name = document.createElement("span");
            name.className = "event-name";
            name.textContent = e.description;
            for (const noteText of [
              e.credit_charge ? "Achat sur crédit · aucun débit immédiat" : "",
              e.transfer_internal
                ? "Virement interne — aucun impact sur le total"
                : "",
              typeof e.sts_impact_cents === "number"
                ? e.sts_impact_cents === 0
                  ? "Sans effet sur le disponible · 0,00 $"
                  : "Effet sur le disponible : " +
                    (e.sts_impact_cents > 0 ? "+" : "−") +
                    money(Math.abs(e.sts_impact_cents))
                : "",
              e.modified ? "Montant exceptionnel" : "",
              e.estimated ? "Date estimée" : "",
            ].filter(Boolean)) {
              const note = document.createElement("small");
              note.className = "event-note";
              note.textContent = noteText;
              name.append(note);
            }
            const amount = document.createElement("span");
            amount.className = "event-money";
            amount.textContent =
              (type === "income" ? "+" : type === "expense" ? "−" : "") +
              money(e.amount_cents);
            line.append(name, amount);
            box.append(line);
          }
          groups.append(box);
        }
        body.append(groups);
      } else {
        const empty = document.createElement("p");
        empty.className = "forecast-quiet";
        empty.textContent = "Aucune transaction prévue pour cette journée.";
        body.append(empty);
      }
      body.hidden = !initiallyOpen;
      summary.addEventListener("click", () =>
        setForecastDayOpen(details, !details.classList.contains("is-open")),
      );
      details.append(body);
      host.append(details);
    }
  }
  function setForecastDayOpen(row, open) {
    row.classList.toggle("is-open", open);
    const btn = row.querySelector(".forecast-day-summary");
    const body = row.querySelector(".forecast-day-body");
    if (btn) btn.setAttribute("aria-expanded", String(open));
    if (body) body.hidden = !open;
    const date = row.dataset.date;
    if (date) {
      if (open) forecastOpenDates.add(date);
      else forecastOpenDates.delete(date);
    }
  }
  $("forecast-expand").onclick = () => {
    for (const d of document.querySelectorAll(".forecast-day"))
      setForecastDayOpen(d, true);
  };
  $("forecast-collapse").onclick = () => {
    for (const d of document.querySelectorAll(".forecast-day"))
      setForecastDayOpen(d, false);
  };
  function toggleType() {
    const type = $("rec-type").value;
    $("source-label").classList.toggle("hidden", type === "reserve");
    $("destination-label").classList.toggle("hidden", type !== "transfer");
    $("reserve-label").classList.toggle(
      "hidden",
      !["reserve", "expense", "transfer"].includes(type),
    );
    $("rec-envelope").required = type === "reserve";
  }
  $("rec-type").onchange = toggleType;
  function editRule(id) {
    const r = state.recurring.find((x) => x.id === id),
      f = $("recurring");
    for (const [k, v] of Object.entries({
      ...r,
      amount: r.amount_cents / 100,
      active: String(!!r.active),
      one_time: String(!!r.one_time),
    }))
      if (f.elements[k]) f.elements[k].value = v ?? "";
    $("save-rec").textContent = "Enregistrer les modifications";
    $("cancel-rec").classList.remove("hidden");
    toggleType();
    window.appOpenEditor?.("recurring");
  }
  function resetRec() {
    const f = $("recurring");
    f.reset();
    f.elements.id.value = "";
    f.elements.start_on.value = today();
    $("save-rec").textContent = "Ajouter la règle";
    $("cancel-rec").classList.add("hidden");
    toggleType();
  }
  $("cancel-rec").onclick = resetRec;
  async function send(url, data) {
    $("error").textContent = "";
    try {
      const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
        out = await r.json();
      if (!r.ok) throw Error(out.error || "Erreur");
      render(out);
      return true;
    } catch (e) {
      $("error").textContent = e.message;
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
  }
  for (const [form, url] of [["transaction", "transactions"]])
    $(form).onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      for (const k of ["balance", "reserved", "amount"])
        if (k in data) data[k] = Number(data[k]);
      if (await send("/api/" + url, data)) {
        if (form === "transaction") {
          e.target.elements.amount.value = "";
          e.target.elements.description.value = "";
          selectDefaultTransactionAccount(state.accounts);
        } else e.target.reset();
      }
    };
  $("envelope").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target,
      data = Object.fromEntries(new FormData(f));
    data.reserved = Number(data.reserved);
    data.budget = Number(data.budget);
    data.rollover = data.rollover === "true";
    data.active = data.active === "true";
    const editing = !!data.id;
    if (editing) data.id = Number(data.id);
    else delete data.id;
    if (await send("/api/envelopes" + (editing ? "/update" : ""), data))
      resetEnvelope();
  };
  $("real-transfer").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target,
      data = Object.fromEntries(new FormData(f));
    data.amount = Number(data.amount);
    data.from_account_id = Number(data.from_account_id);
    data.to_account_id = Number(data.to_account_id);
    if (await send("/api/transfers", data)) {
      f.elements.amount.value = "";
      f.elements.description.value = "";
    }
  };
  $("account").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target,
      data = Object.fromEntries(new FormData(f));
    data.simple_credit = data.kind === "credit" && $("account-simple").checked;
    if (data.simple_credit) delete data.balance;
    else data.balance = Number(data.balance);
    data.included = $("account-included").checked && data.kind !== "credit";
    const editing = !!data.id;
    if (editing) data.id = Number(data.id);
    else delete data.id;
    if (await send("/api/accounts" + (editing ? "/update" : ""), data))
      resetAccount();
  };
  $("override").onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.recurring_id = Number(data.recurring_id);
    data.amount = Number(data.amount);
    if (await send("/api/overrides", data)) e.target.elements.amount.value = "";
  };
  $("recurring").onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.amount = Number(data.amount);
    data.active = data.active === "true";
    data.account_id = data.account_id ? Number(data.account_id) : null;
    data.to_account_id = data.to_account_id ? Number(data.to_account_id) : null;
    data.envelope_id = data.envelope_id ? Number(data.envelope_id) : null;
    const editing = !!data.id;
    if (editing) data.id = Number(data.id);
    else delete data.id;
    if (await send("/api/recurring" + (editing ? "/update" : ""), data))
      resetRec();
  };
  fetch("/api/state")
    .then((r) => r.json())
    .then((s) => render(s))
    .catch(() => {
      $("error").textContent = "Impossible de joindre le serveur.";
    });

  // v1.1: repli des sections, mémorisé uniquement dans le navigateur.
  (() => {
    const defaultClosed = new Set(["recurrences", "exceptions", "virements"]);
    document.querySelectorAll("section[data-section]").forEach((section) => {
      const key = "mon-budget-local:section:" + section.dataset.section;
      let stored = null;
      try {
        stored = localStorage.getItem(key);
      } catch (_e) {}
      const closed =
        stored === null
          ? defaultClosed.has(section.dataset.section)
          : stored === "closed";
      const btn = section.querySelector(".section-toggle");
      if (!btn) return; // Le calendrier n'a pas de bouton de repli.
      function setClosed(value) {
        section.classList.toggle("is-collapsed", value);
        btn.textContent = value ? "Afficher" : "Réduire";
        btn.setAttribute("aria-expanded", String(!value));
        try {
          localStorage.setItem(key, value ? "closed" : "open");
        } catch (_e) {}
      }
      setClosed(closed);
      btn.addEventListener("click", () =>
        setClosed(!section.classList.contains("is-collapsed")),
      );
    });
    document.querySelectorAll(".quick-nav a").forEach((a) =>
      a.addEventListener("click", () => {
        const section = document.querySelector(a.getAttribute("href"));
        if (section?.classList.contains("is-collapsed"))
          section.querySelector(".section-toggle")?.click();
      }),
    );
    // L'édition d'une récurrence doit rendre visible le formulaire.
    const oldEdit = window.editRule;
    if (typeof oldEdit === "function")
      window.editRule = function (...args) {
        const sec = document.getElementById("section-recurrences");
        if (sec?.classList.contains("is-collapsed"))
          sec.querySelector(".section-toggle").click();
        return oldEdit(...args);
      };
  })();

  /* v1.8: navigation, éditeurs contextuels et actions optimistes */
  (() => {
    const sections = [...document.querySelectorAll("section[data-section]")];
    const dashboard = document.getElementById("app-dashboard");
    const forms = {
      transaction: document.getElementById("transaction"),
      envelope: document.getElementById("envelope"),
      recurring: document.getElementById("recurring"),
      account: document.getElementById("account"),
    };
    const names = {
      transaction: "Nouvelle transaction",
      envelope: "Enveloppe",
      recurring: "Récurrence",
      account: "Compte",
    };
    const dialogs = {};
    for (const [key, form] of Object.entries(forms)) {
      const dialog =
        key === "transaction"
          ? document.getElementById("transaction-dialog")
          : document.createElement("dialog");
      if (key !== "transaction") {
        dialog.className = "editor-dialog";
        dialog.setAttribute("aria-label", "Modifier " + names[key]);
        dialog.innerHTML =
          '<div class="dialog-inner"><div class="dialog-heading"><h2></h2><button type="button" class="secondary close-editor">Fermer</button></div><div class="editor-body"></div></div>';
        document.body.append(dialog);
      }
      const body =
        key === "transaction"
          ? document.getElementById("transaction-dialog-form")
          : dialog.querySelector(".editor-body");
      body.append(form);
      dialogs[key] = dialog;
      if (key !== "transaction")
        dialog.querySelector(".close-editor").onclick = () => dialog.close();
      form.addEventListener("submit", () => {
        /* Le résultat sera confirmé par send() */
      });
    }
    document.getElementById("open-transaction").onclick = () =>
      window.appOpenEditor("transaction");
    document.getElementById("close-transaction").onclick = () =>
      dialogs.transaction.close();
    window.appOpenEditor = (key) => {
      const d = dialogs[key];
      if (!d) return;
      if (!d.open) {
        const heading = d.querySelector(".dialog-heading h2");
        if (heading)
          heading.textContent =
            (forms[key].elements.id?.value ? "Modifier : " : "Ajouter : ") +
            names[key].toLowerCase();
        d.showModal();
      }
    };
    window.appCloseEditor = (key) => {
      if (dialogs[key]?.open) dialogs[key].close();
    };
    // Les actions de création restent hors de la page tant qu'on n'en a pas besoin.
    for (const [view, key, label] of [
      ["enveloppes", "envelope", "+ Enveloppe"],
      ["recurrences", "recurring", "+ Récurrence"],
      ["comptes", "account", "+ Compte"],
    ]) {
      const section = document.getElementById("section-" + view);
      const bar = document.createElement("div");
      bar.className = "view-toolbar";
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.onclick = () => {
        if (key === "envelope") resetEnvelope();
        if (key === "recurring") resetRec();
        if (key === "account") resetAccount();
        window.appOpenEditor(key);
      };
      bar.append(b);
      section.querySelector(".section-head").after(bar);
    }
    function navigate(view) {
      dashboard.classList.toggle("view-active", view === "dashboard");
      document.body.classList.toggle(
        "app-dashboard-mode",
        view === "dashboard",
      );
      for (const section of sections) {
        const active = section.dataset.section === view;
        section.classList.toggle("view-active", active);
        if (active && section.classList.contains("is-collapsed"))
          section.querySelector(".section-toggle")?.click();
      }
      document.querySelectorAll(".app-shell-nav [data-view]").forEach((b) => {
        b.classList.toggle("active", b.dataset.view === view);
        b.setAttribute(
          "aria-current",
          b.dataset.view === view ? "page" : "false",
        );
      });
      try {
        history.replaceState(null, "", "#" + view);
      } catch (_e) {}
      window.scrollTo(0, 0);
      if (view === "dashboard")
        document.querySelector(".app-shell-nav").scrollLeft = 0;
    }
    document
      .querySelectorAll(".app-shell-nav [data-view]")
      .forEach((b) => (b.onclick = () => navigate(b.dataset.view)));
    function refreshUpcoming(s) {
      const host = document.getElementById("dashboard-upcoming");
      host.replaceChildren();
      let count = 0;
      for (const day of s.forecast || []) {
        for (const ev of day.events || []) {
          if (count >= 5) break;
          const row = document.createElement("div");
          row.className = "upcoming-row";
          const tile = document.createElement("div");
          tile.className = "movement-date";
          const d = new Date(day.date + "T12:00:00");
          const dayNumber = document.createElement("strong");
          dayNumber.textContent = d.getDate();
          const month = document.createElement("span");
          month.textContent = d.toLocaleDateString("fr-CA", { month: "short" });
          tile.append(dayNumber, month);
          const left = document.createElement("div");
          left.className = "movement-description";
          const label = document.createElement("strong");
          label.textContent = ev.description || types[ev.type] || "Mouvement";
          const category = document.createElement("small");
          category.textContent = types[ev.type] || "Mouvement prévu";
          left.append(label, category);
          const right = document.createElement("strong");
          right.textContent =
            (ev.type === "expense" ? "−" : ev.type === "income" ? "+" : "") +
            money(ev.amount_cents);
          right.className =
            "movement-amount " + (ev.type === "income" ? "positive" : "");
          row.append(tile, left, right);
          host.append(row);
          count++;
        }
        if (count >= 5) break;
      }
      if (!count)
        budgetEmpty(
          host,
          "Rien de prévu pour le moment",
          "Ajoutez vos revenus et factures récurrents pour construire votre prévision.",
          "Ajouter une récurrence",
          () => window.appOpenEditor("recurring"),
        );
    }
    const oldRender = render;
    render = function (s) {
      oldRender(s);
      refreshUpcoming(s);
    };
    // Refermer une fenêtre seulement après succès serveur.
    const oldSend = send;
    send = async function (url, data) {
      const ok = await oldSend(url, data);
      if (ok) {
        const key = url.includes("envelopes")
          ? "envelope"
          : url.includes("recurring")
            ? "recurring"
            : url.includes("accounts")
              ? "account"
              : url.includes("transactions")
                ? "transaction"
                : null;
        if (key) window.appCloseEditor(key);
      }
      return ok;
    };
    // Un clic sur le statut d'une transaction ou d'un compte est immédiat;
    // en cas d'erreur la valeur revient à l'état précédent.
    navigate(
      ["dashboard", ...sections.map((s) => s.dataset.section)].includes(
        location.hash.slice(1),
      )
        ? location.hash.slice(1)
        : "dashboard",
    );
  })();

  /* v2.0 : calendrier, registre paginé, édition et suppression atomiques. */
  (() => {
    const by = (id) => document.getElementById(id),
      dialog = by("v2-edit");
    let editKind = "transaction",
      editId = null,
      page = 1,
      records = [],
      allCount = 0;
    let month = new Date();
    month.setDate(1);
    const esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    const dateLabel = (s) =>
      new Date(s + "T12:00:00").toLocaleDateString("fr-CA", {
        weekday: "short",
        day: "numeric",
        month: "long",
      });
    const centsFmt = (c) => money(c);
    function options(select, items, none = false) {
      select.replaceChildren();
      if (none) select.add(new Option("Aucune", ""));
      for (const item of items) select.add(new Option(item.name, item.id));
    }
    function edit(kind, id) {
      editKind = kind;
      editId = id;
      const row =
        kind === "transfer"
          ? (state.transfers || []).find((x) => x.id === id)
          : records.find((x) => x.id === id);
      if (!row) {
        alert("Actualise la liste avant de modifier cette opération.");
        return;
      }
      const form = by("v2-edit-form");
      by("v2-edit-title").textContent =
        kind === "transfer"
          ? "Modifier le virement"
          : "Modifier la transaction";
      options(by("v2-edit-account"), state.accounts);
      options(by("v2-edit-to"), state.accounts);
      options(by("v2-edit-envelope"), state.envelopes, true);
      by("v2-to-label").style.display = kind === "transfer" ? "" : "none";
      form.elements.description.value = row.description;
      form.elements.amount.value = (Math.abs(row.amount_cents) / 100).toFixed(
        2,
      );
      by("v2-edit-direction").value =
        row.amount_cents < 0 ? "expense" : "income";
      by("v2-edit-category").value = String(row.category_id || "");
      by("v2-direction-label").hidden = kind === "transfer";
      by("v2-category-label").hidden = kind === "transfer";
      window.budgetSetSubcategory?.(
        "v2-edit-category",
        row.subcategory_id,
        row.category_id,
      );
      const historyOnly = kind !== "transfer" && row.affects_balance === 0,
        legacyReserve =
          kind !== "transfer" &&
          row.envelope_id &&
          row.envelope_effect_cents === null;
      by("v2-history-note").hidden = !historyOnly && !legacyReserve;
      by("v2-history-note").textContent = historyOnly
        ? "Opération importée en historique : sa modification ne change pas les soldes actuels ni les réserves."
        : "Ancienne opération : vérifiez la réserve de l’enveloppe après un changement de montant ou d’enveloppe.";
      form.elements.happened_on.value = row.happened_on;
      form.elements.account_id.value = String(
        kind === "transfer" ? row.from_account_id : row.account_id,
      );
      form.elements.to_account_id.value = String(row.to_account_id || "");
      form.elements.envelope_id.value = String(row.envelope_id || "");
      dialog.showModal();
    }
    window.v2Edit = edit;
    window.budgetEditRecord = (kind, row) => {
      if (kind === "transfer") {
        state.transfers = state.transfers.filter((t) => t.id !== row.id);
        state.transfers.push(row);
      } else {
        records = records.filter((t) => t.id !== row.id);
        records.push(row);
      }
      edit(kind, row.id);
    };
    by("v2-edit-close").onclick = () => dialog.close();
    by("v2-edit-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = {
        id: editId,
        description: f.elements.description.value,
        amount: Number(f.elements.amount.value),
        happened_on: f.elements.happened_on.value,
      };
      if (editKind === "transfer") {
        payload.from_account_id = Number(f.elements.account_id.value);
        payload.to_account_id = Number(f.elements.to_account_id.value);
        payload.envelope_id = f.elements.envelope_id.value || null;
      } else {
        payload.account_id = Number(f.elements.account_id.value);
        payload.envelope_id = f.elements.envelope_id.value || null;
        payload.category_id = f.elements.category_id.value || null;
        payload.subcategory_id = f.elements.subcategory_id?.value || null;
        payload.amount =
          Math.abs(payload.amount) *
          (f.elements.direction.value === "expense" ? -1 : 1);
      }
      const ok = await send(
        "/api/" +
          (editKind === "transfer" ? "transfers" : "transactions") +
          "/update",
        payload,
      );
      if (ok) {
        dialog.close();
        await loadRecords();
        refreshCalendar();
      }
    };
    window.v2Delete = async (kind, id) => {
      if (
        !confirm(
          "Supprimer définitivement cette opération et corriger les soldes correspondants ?",
        )
      )
        return;
      if (
        await send(
          "/api/" +
            (kind === "transfer" ? "transfers" : "transactions") +
            "/delete",
          { id },
        )
      ) {
        await loadRecords();
        refreshCalendar();
      }
    };
    const filterIds = [
      "v2-search",
      "v2-account",
      "v2-review",
      "v2-kind",
      "v3-category-filter",
      "v3-date-from",
      "v3-date-to",
    ];
    const query = () => {
      const p = new URLSearchParams({ page });
      if (by("sillage-sort")) {
        const [sort, direction] = by("sillage-sort").value.split(":");
        p.set("sort", sort);
        p.set("direction", direction);
      }
      if (by("v2-search").value) p.set("search", by("v2-search").value);
      if (by("v46-subcategory-filter")?.value)
        p.set("subcategory", by("v46-subcategory-filter").value);
      if (by("v2-account").value) p.set("account", by("v2-account").value);
      if (by("v2-review").value) p.set("reviewed", by("v2-review").value);
      if (by("v2-kind").value) p.set("kind", by("v2-kind").value);
      if(by('v132-without-envelope')?.checked)p.set('without_envelope','1');
      if(by('register-envelope-filter')?.value)p.set('envelope',by('register-envelope-filter').value);
      for (const [id, key] of [
        ["v3-category-filter", "category"],
        ["v3-date-from", "from"],
        ["v3-date-to", "to"],
      ])
        if (by(id).value) p.set(key, by(id).value);
      return p;
    };
    let recordsTicket = 0,
      recordsController;
    async function loadRecords() {
      const ticket = ++recordsTicket;
      recordsController?.abort();
      recordsController = new AbortController();
      const host = by("v2-transaction-list");
      host.setAttribute("aria-busy", "true");
      document.dispatchEvent(new CustomEvent("budget:transactions-loading"));
      try {
        const r = await fetch("/api/transactions/list?" + query(), {
          cache: "no-store",
          signal: recordsController.signal,
        });
        if (!r.ok) throw Error("Liste indisponible");
        const data = await r.json();
        if (ticket !== recordsTicket) return;
        if (data.count && data.page > data.pages) {
          page = data.pages;
          return loadRecords();
        }
        page = data.page;
        records = data.rows;
        allCount = data.count;
        host.replaceChildren();
        const node = (tag, text, cls) => {
          const n = document.createElement(tag);
          if (text !== undefined) n.textContent = text;
          if (cls) n.className = cls;
          return n;
        };
        let last = "";
        for (const t of records) {
          if (last !== t.happened_on) {
            last = t.happened_on;
            const heading = node(
              "h3",
              last === today()
                ? "Aujourd’hui"
                : new Date(last + "T12:00:00").toLocaleDateString("fr-CA", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year:
                      last.slice(0, 4) !== today().slice(0, 4)
                        ? "numeric"
                        : undefined,
                  }),
              "ledger-date",
            );
            host.append(heading);
          }
          const row = node(
            "article",
            undefined,
            "ledger-row" + (t.amount_cents > 0 ? " income" : " expense"),
          );
          row.dataset.transactionId = t.id;
          const avatar = node(
            "span",
            t.description
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => Array.from(w)[0])
              .join("")
              .toLocaleUpperCase("fr-CA"),
            "merchant-mark",
          );
          avatar.setAttribute("aria-hidden", "true");
          const info = node("div", undefined, "ledger-description"),
            name = node("button", t.description, "ledger-name");
          name.type = "button";
          name.setAttribute("aria-label", "Modifier " + t.description);
          name.onclick = () => edit("transaction", t.id);
          const meta = node("div", undefined, "ledger-meta");
          meta.append(node("span", t.account_name));
          if (t.affects_balance === 0)
            meta.append(node("span", "Historique importé", "history-badge"));
          info.append(name, meta);
          const category = node("div", undefined, "ledger-category");
          category.append(
            node(
              "span",
              (t.category_name || "Non-catégorisé") +
                (t.subcategory_name ? " › " + t.subcategory_name : ""),
              "category-tag" + (t.category_id ? "" : " unclassified"),
            ),
          );
          if (t.envelope_name) category.append(node("small", t.envelope_name));
          const amount = node(
            "strong",
            (t.amount_cents > 0 ? "+" : "") + centsFmt(t.amount_cents),
            "ledger-amount",
          );
          const review = node(
            "button",
            t.reviewed ? "Révisée" : "À vérifier",
            "review-pill" + (t.reviewed ? " reviewed" : ""),
          );
          review.type = "button";
          review.setAttribute("aria-pressed", String(!!t.reviewed));
          review.setAttribute(
            "aria-label",
            (t.reviewed
              ? "Marquer à vérifier : "
              : "Marquer comme révisée : ") + t.description,
          );
          review.onclick = async () => {
            review.disabled = true;
            const ok = await send("/api/transactions/review", {
              id: t.id,
              reviewed: !t.reviewed,
            });
            if (!ok) review.disabled = false;
          };
          const actions = node("div", undefined, "ledger-actions"),
            editButton = node("button", "Modifier", "ledger-edit");
          editButton.type = "button";
          editButton.onclick = () => edit("transaction", t.id);
          const more = node("details", undefined, "ledger-menu"),
            label = node("summary", "•••");
          label.setAttribute(
            "aria-label",
            "Autres actions pour " + t.description,
          );
          const menu = node("div", undefined, "ledger-menu-items");
          const repeat = node("button", "Refaire cette opération");
          repeat.type = "button";
          repeat.onclick = () => {
            more.open = false;
            window.dispatchEvent(
              new CustomEvent("budget:repeat-transaction", { detail: t }),
            );
          };
          const remove = node("button", "Supprimer", "danger");
          remove.type = "button";
          remove.onclick = () => window.v2Delete("transaction", t.id);
          menu.append(repeat, remove);
          more.append(label, menu);
          actions.append(editButton, more);
          row.append(avatar, info, category, amount, review, actions);
          host.append(row);
        }
        if (!records.length)
          budgetEmpty(
            host,
            "Aucune opération dans cette vue",
            "Ajoutez une transaction ou élargissez vos filtres pour retrouver votre historique.",
            "Ajouter une transaction",
            () => window.appOpenEditor("transaction"),
          );
        by("v2-pages").textContent =
          "Page " +
          data.page +
          " / " +
          data.pages +
          " · " +
          data.count +
          " opération" +
          (data.count === 1 ? "" : "s");
        by("v2-prev").disabled = page <= 1;
        by("v2-next").disabled = page >= data.pages;
        document.dispatchEvent(
          new CustomEvent("budget:transactions-loaded", { detail: data }),
        );
      } catch (e) {
        if (ticket !== recordsTicket || e.name === "AbortError") return;
        host.textContent =
          "Impossible de charger les opérations. Réessayez dans un instant.";
        document.dispatchEvent(new CustomEvent("budget:transactions-error"));
      } finally {
        if (ticket === recordsTicket) host.setAttribute("aria-busy", "false");
      }
    }
    window.budgetRefreshTransactions = ({keepPage=false}={}) => {
      if(!keepPage) page = 1;
      loadRecords();
    };

    let searchTimer;
    for (const id of filterIds)
      by(id).addEventListener(id === "v2-search" ? "input" : "change", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          page = 1;
          loadRecords();
        }, 220);
      });
    by("v2-prev").onclick = () => {
      page = Math.max(1, page - 1);
      loadRecords();
    };
    by("v2-next").onclick = () => {
      page++;
      loadRecords();
    };
    by("v2-export").onclick = () => {
      window.location.href = "/api/transactions/export?" + query();
    };

    function refreshCalendar() {
      if (!state) return;
      const y = month.getFullYear(),
        m = month.getMonth(),
        first = new Date(y, m, 1),
        last = new Date(y, m + 1, 0);
      by("cal-month").textContent = first.toLocaleDateString("fr-CA", {
        month: "long",
        year: "numeric",
      });
      const host = by("cal-grid");
      host.replaceChildren();
      for (const label of ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]) {
        const el = document.createElement("div");
        el.className = "cal-head";
        el.textContent = label;
        host.append(el);
      }
      const offset = (first.getDay() + 6) % 7,
        days = last.getDate();
      for (let i = 0; i < offset; i++) {
        const blank = document.createElement("div");
        host.append(blank);
      }
      const allReal = state.calendar_actuals || state.transactions || [],
        forecast = new Map((state.forecast || []).map((d) => [d.date, d]));
      for (let day = 1; day <= days; day++) {
        const key =
          y +
          "-" +
          String(m + 1).padStart(2, "0") +
          "-" +
          String(day).padStart(2, "0");
        const f = forecast.get(key),
          real = allReal.filter((t) => t.happened_on === key),
          sum = real.reduce((v, t) => v + t.amount_cents, 0),
          planned = (state.planning?.rows || []).filter((r) => r.date === key),
          realTransfers = (state.calendar_transfers || []).filter(
            (t) => t.happened_on === key,
          );
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "cal-cell" +
          (f?.safe_cents < 0 ? " negative" : "") +
          (real.length || realTransfers.length || (f?.events || []).length
            ? " has-movements"
            : "");
        button.dataset.date = key;
        button.setAttribute(
          "aria-label",
          dateLabel(key) +
            " · " +
            (real.length + realTransfers.length + (f?.events || []).length) +
            " mouvement(s)" +
            (f ? " · disponible prévu " + money(f.safe_cents) : ""),
        );
        const d = document.createElement("strong");
        d.textContent = day;
        button.append(d);
        if (real.length) {
          const t = document.createElement("small");
          t.textContent = "Réel " + money(sum);
          button.append(t);
        }
        if (f) {
          const t = document.createElement("small");
          t.textContent = "Solde prévu " + money(f.cash_cents);
          button.append(t);
        }
        if (
          planned.some((r) => r.status === "planned" || r.status === "pending")
        ) {
          const t = document.createElement("small");
          t.className = "calendar-planned-label";
          t.textContent = planned
            .filter((r) => r.status === "planned" || r.status === "pending")
            .map((r) => r.description + " " + money(r.remaining_cents))
            .join(" · ");
          button.append(t);
        }
        button.onclick = () => {
          host
            .querySelectorAll(".selected")
            .forEach((n) => n.classList.remove("selected"));
          button.classList.add("selected");
          const detail = by("cal-detail");
          detail.replaceChildren();
          const heading = document.createElement("h3");
          heading.textContent = dateLabel(key);
          detail.append(heading);
          for (const t of real) {
            const row = document.createElement("div");
            row.className = "v2-row";
            row.textContent = t.description + " · " + money(t.amount_cents);
            detail.append(row);
          }
          for (const t of realTransfers) {
            const row = document.createElement("div");
            row.className = "v2-row";
            row.textContent =
              "Virement réel · " +
              t.description +
              " · " +
              money(t.amount_cents);
            detail.append(row);
          }
          for (const ev of planned) {
            const row = document.createElement("div");
            row.className = "v2-row";
            row.textContent =
              (ev.status === "actual"
                ? "Prévu remplacé par le réel"
                : ev.status === "skipped"
                  ? "Annulé"
                  : "Prévu") +
              " · " +
              ev.description +
              (ev.type === "expense" &&
              state.accounts.find((a) => a.id === ev.account_id)?.kind ===
                "credit"
                ? " · sur " +
                  state.accounts.find((a) => a.id === ev.account_id).name
                : "") +
              " · " +
              money(ev.planned_cents) +
              (ev.actual_cents === null
                ? ""
                : " → Réel " + money(ev.actual_cents));
            detail.append(row);
          }
          for (const ev of (f?.events || []).filter(
            (ev) => ev.envelope_renewal,
          )) {
            const row = document.createElement("div");
            row.className = "v2-row";
            row.textContent =
              ev.description + " · " + money(ev.amount_cents) + " (réserve)";
            detail.append(row);
          }
          if (
            !real.length &&
            !realTransfers.length &&
            !planned.length &&
            !f?.events?.length
          ) {
            const empty = document.createElement("p");
            empty.textContent = "Aucun mouvement connu.";
            detail.append(empty);
          }
          const add = document.createElement("button");
          add.type = "button";
          add.textContent = "+ Transaction à cette date";
          add.onclick = () => {
            document.getElementById("transaction").elements.happened_on.value =
              key;
            window.appOpenEditor("transaction");
          };
          detail.append(add);
        };
        host.append(button);
      }
    }
    by("cal-prev").onclick = () => {
      month.setMonth(month.getMonth() - 1);
      refreshCalendar();
    };
    by("cal-next").onclick = () => {
      month.setMonth(month.getMonth() + 1);
      refreshCalendar();
    };
    by("cal-today").onclick = () => {
      month = new Date();
      month.setDate(1);
      refreshCalendar();
    };
    const oldRender = render;
    render = function (s) {
      oldRender(s);
      const selectedAccount = by("v2-account").value;
      options(by("v2-account"), s.accounts, true);
      by("v2-account").options[0].text = "Tous";
      by("v2-account").value = selectedAccount;
      refreshCalendar();
      loadRecords();
    };
    // Refresh the new register when the original application completes a save.
    const oldSend = send;
    send = async function (url, data) {
      const ok = await oldSend(url, data);
      if (ok) loadRecords();
      return ok;
    };
    // La requête initiale est déjà effectuée par le moteur principal.
  })();
  /* v2.1 : couche additionnelle isolée, n'altère pas les écritures de la v2.0.2. */
  (() => {
    const el = (id) => document.getElementById(id);
    const fmt = (amount) =>
      (amount / 100).toLocaleString("fr-CA", {
        style: "currency",
        currency: "CAD",
      });
    const safeText = (parent, tag, value, cls) => {
      const node = document.createElement(tag);
      node.textContent = value;
      if (cls) node.className = cls;
      parent.append(node);
      return node;
    };
    let latest = null,
      actuals = [];
    function fillOptions(select, items, placeholder) {
      const old = select.value;
      select.replaceChildren();
      select.add(new Option(placeholder, ""));
      for (const item of items) select.add(new Option(item.label, item.value));
      if ([...select.options].some((o) => o.value === old)) select.value = old;
    }
    async function reloadActuals() {
      try {
        const response = await fetch("/api/reconcile/options", {
          cache: "no-store",
        });
        if (!response.ok) throw Error("Opérations indisponibles");
        const data = await response.json();
        actuals = data.actuals || [];
        fillOptions(
          el("v21-link-actual"),
          actuals.map((a) => ({
            value: a.actual_type + ":" + a.id,
            label:
              a.happened_on +
              " · " +
              a.description +
              " · " +
              fmt(a.amount_cents) +
              " (" +
              (a.actual_type === "transfer" ? "virement" : "transaction") +
              ")",
          })),
          "Choisir une opération réelle",
        );
      } catch (e) {
        el("v21-links").textContent =
          "Impossible de charger les opérations : " + e.message;
      }
    }
    function linkRows(s) {
      const host = el("v21-links");
      host.replaceChildren();
      for (const link of s.reconciliation_links || []) {
        const rule = s.recurring.find((r) => r.id === link.recurring_id);
        const row = document.createElement("div");
        row.className = "v21-link-item";
        safeText(
          row,
          "span",
          (rule?.description || "Règle") +
            " · " +
            link.occurrence_on +
            " ↔ " +
            link.actual_type +
            " #" +
            link.actual_id,
        );
        const button = safeText(row, "button", "Délier");
        button.type = "button";
        button.onclick = async () => {
          if (await send("/api/reconcile/unlink", { id: link.id }))
            await reloadActuals();
        };
        host.append(row);
      }
      if (!s.reconciliation_links?.length)
        safeText(
          host,
          "p",
          "Aucun rapprochement manuel. Le rapprochement automatique reste actif.",
        );
    }
    function envelopeOverrides(s) {
      const host = el("v21-env-overrides");
      host.replaceChildren();
      for (const item of s.envelope_budget_overrides || []) {
        const env = s.envelopes.find((e) => e.id === item.envelope_id);
        const row = document.createElement("div");
        row.className = "v21-link-item";
        safeText(
          row,
          "span",
          (env?.name || "Enveloppe") +
            " · " +
            item.occurrence_on +
            " · " +
            fmt(item.budget_cents),
        );
        const button = safeText(row, "button", "Supprimer");
        button.type = "button";
        button.onclick = () =>
          send("/api/envelope/period/delete", {
            envelope_id: item.envelope_id,
            occurrence_on: item.occurrence_on,
          });
        host.append(row);
      }
    }
    function moveRows(s) {
      const host = el("v21-moves");
      host.replaceChildren();
      for (const move of s.recurring_moves || []) {
        const rule = s.recurring.find((r) => r.id === move.recurring_id);
        const row = document.createElement("div");
        row.className = "v21-link-item";
        safeText(
          row,
          "span",
          (rule?.description || "Règle") +
            " · " +
            move.occurrence_on +
            " → " +
            move.new_on,
        );
        const button = safeText(row, "button", "Annuler le déplacement");
        button.type = "button";
        button.onclick = () =>
          send("/api/occurrence/unmove", {
            recurring_id: move.recurring_id,
            occurrence_on: move.occurrence_on,
          });
        host.append(row);
      }
    }
    function envelopeMetrics(s) {
      const host = el("envelopes");
      const details = new Map((s.envelope_details || []).map((e) => [e.id, e]));
      const rows = host.querySelectorAll(".envelope-item");
      (s.envelopes || []).forEach((env, index) => {
        const row = rows[index];
        if (!row) return;
        row.querySelector(".v21-envelope-metrics")?.remove();
        const d = details.get(env.id);
        if (!d) return;
        const info = document.createElement("div");
        info.className = "v21-envelope-metrics";
        info.textContent =
          "Disponible : " +
          fmt(d.available_cents) +
          " · Dépensé cette période : " +
          fmt(d.spent_cents) +
          " · Prochain renouvellement : " +
          (d.next_renewal || "Aucun");
        row.firstElementChild?.append(info);
      });
    }
    function detail(s) {
      const host = el("v21-sts-content");
      host.replaceChildren();
      const w = s.spending_windows || {};
      const values = [
        ["Aujourd’hui", w.today_cents],
        ["Cette semaine", w.week_cents],
        ["Jusqu’à la paie", w.payday_cents],
      ];
      for (const [name, value] of values) {
        const row = document.createElement("div");
        row.className = "v21-sts-line";
        safeText(row, "strong", name);
        safeText(
          row,
          "strong",
          value === null || value === undefined ? "Non disponible" : fmt(value),
        );
        host.append(row);
      }
      safeText(host, "h3", "Comptes inclus");
      for (const a of s.sts_breakdown?.accounts || []) {
        const row = document.createElement("div");
        row.className = "v21-sts-line";
        safeText(row, "span", a.name);
        safeText(row, "span", fmt(a.balance_cents));
        host.append(row);
      }
      safeText(host, "h3", "Enveloppes déjà réservées");
      for (const e of s.sts_breakdown?.envelopes || []) {
        const row = document.createElement("div");
        row.className = "v21-sts-line";
        safeText(row, "span", e.name);
        safeText(row, "span", "−" + fmt(e.reserved_cents));
        host.append(row);
      }
      safeText(host, "h3", "Mouvements à venir (effet sur le disponible)");
      for (const event of s.sts_breakdown?.events || []) {
        const row = document.createElement("div");
        row.className = "v21-sts-line";
        safeText(row, "span", event.date + " · " + event.description);
        safeText(
          row,
          "span",
          (event.impact_cents > 0 ? "+" : "") + fmt(event.impact_cents),
        );
        host.append(row);
      }
      safeText(
        host,
        "p",
        "Cette semaine et jusqu’à la paie utilisent le minimum projeté sur leur période, et non la somme de toutes les lignes. Les virements internes entre comptes inclus ont un effet nul.",
      );
    }
    function drawDashboard(s) {
      drawBudgetChart(s);
      const host = el("v2-envelope-progress");
      if (host) {
        host.replaceChildren();
        for (const e of (s.envelopes || []).slice(0, 8)) {
          const row = document.createElement("div");
          row.className = "v2-progress-item";
          const head = document.createElement("div");
          head.className = "v2-progress-head";
          safeText(head, "span", e.name);
          safeText(head, "span", fmt(e.reserved_cents));
          row.append(head);
          const track = document.createElement("div");
          track.className = "v2-progress-track";
          const fill = document.createElement("div");
          fill.className = "v2-progress-fill";
          fill.style.width =
            Math.min(
              100,
              Math.max(
                0,
                (e.reserved_cents / Math.max(1, e.budget_cents)) * 100,
              ),
            ) + "%";
          track.append(fill);
          row.append(track);
          const note = safeText(
            row,
            "small",
            e.budget_cents > 0
              ? "Réservé · budget par période " + fmt(e.budget_cents)
              : "Réservé · sans budget par période",
          );
          note.className = "envelope-budget-note";
          host.append(row);
        }
        if (!s.envelopes?.length)
          budgetEmpty(
            host,
            "Une place pour chaque projet",
            "Réservez une partie de votre disponible pour l’épicerie, les sorties ou vos projets.",
            "Créer une enveloppe",
            () => window.appOpenEditor("envelope"),
          );
      }
    }
    function update(s) {
      latest = s;
      drawDashboard(s);
      const rules = (s.recurring || [])
        .filter((r) => r.active && r.type !== "reserve")
        .map((r) => ({
          value: r.id,
          label: r.description + " · " + fmt(r.amount_cents),
        }));
      fillOptions(el("v21-link-rule"), rules, "Choisir une récurrence");
      fillOptions(el("v21-move-rule"), rules, "Choisir une récurrence");
      fillOptions(
        el("v21-env-choice"),
        (s.envelopes || [])
          .filter((e) => e.frequency !== "none")
          .map((e) => ({ value: e.id, label: e.name })),
        "Choisir une enveloppe",
      );
      linkRows(s);
      moveRows(s);
      envelopeOverrides(s);
      envelopeMetrics(s);
      el("v21-last-update").textContent =
        "Calculs mis à jour : " +
        new Date().toLocaleTimeString("fr-CA", {
          hour: "2-digit",
          minute: "2-digit",
        });
      if (el("v21-sts-dialog").open) detail(s);
    }
    el("v21-sts-detail").onclick = () => {
      if (latest) detail(latest);
      el("v21-sts-dialog").showModal();
    };
    el("v21-sts-close").onclick = () => el("v21-sts-dialog").close();
    el("v21-refresh").onclick = async () => {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) throw Error("Serveur indisponible");
        render(await r.json());
        await reloadActuals();
      } catch (e) {
        el("error").textContent = "Actualisation impossible : " + e.message;
      }
    };
    el("v21-link-form").onsubmit = async (e) => {
      e.preventDefault();
      const selected = el("v21-link-actual").value.split(":");
      if (selected.length !== 2) return;
      const ok = await send("/api/reconcile/link", {
        recurring_id: Number(el("v21-link-rule").value),
        occurrence_on: el("v21-link-date").value,
        actual_type: selected[0],
        actual_id: Number(selected[1]),
      });
      if (ok) await reloadActuals();
    };
    el("v21-env-form").onsubmit = async (e) => {
      e.preventDefault();
      await send("/api/envelope/period", {
        envelope_id: Number(el("v21-env-choice").value),
        occurrence_on: el("v21-env-date").value,
        budget: Number(el("v21-env-budget").value),
      });
    };
    el("v21-move-form").onsubmit = async (e) => {
      e.preventDefault();
      await send("/api/occurrence/move", {
        recurring_id: Number(el("v21-move-rule").value),
        occurrence_on: el("v21-move-original").value,
        new_on: el("v21-move-new").value,
      });
    };
    // Une seule extension de rendu; chaque composant est isolé des autres.
    const originalRender = render;
    render = function (s) {
      originalRender(s);
      try {
        update(s);
      } catch (err) {
        console.error("Composants v2.1 :", err);
      }
    };
    reloadActuals();
  })();

  // Workspace presentation; budget calculations remain in the existing renderers.
  (() => {
    const icons = {
      categories: "◇",
      bilan: "▥",
      importer: "↓",
      objectifs: "◎",
      sauvegardes: "▣",
      dashboard: "◫",
      comptes: "▤",
      transactions: "↗",
      enveloppes: "◈",
      recurrences: "↻",
      prevision: "⌁",
      calendrier: "▦",
      virements: "⇄",
      exceptions: "≡",
    };
    const title = document.getElementById("workspace-title");
    document
      .querySelectorAll(".app-shell-nav [data-view]")
      .forEach((button) => {
        button.dataset.icon = icons[button.dataset.view] || "·";
        button.addEventListener("click", () => {
          title.textContent = button.textContent;
        });
        if (button.classList.contains("active"))
          title.textContent = button.textContent;
      });
  })();

  function budgetEmpty(host, title, description, label, action) {
    const box = document.createElement("div");
    box.className = "empty-state";
    const mark = document.createElement("span");
    mark.className = "empty-state-mark";
    mark.textContent = "+";
    mark.setAttribute("aria-hidden", "true");
    const heading = document.createElement("h3");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = description;
    box.append(mark, heading, copy);
    if (label) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = label;
      button.onclick = action;
      box.append(button);
    }
    host.append(box);
  }

  // The chart presents the server forecast without changing its financial rules.
  function drawBudgetChart(s) {
    const svg = document.getElementById("v2-chart");
    if (!svg) return;
    const days = (s.forecast || []).slice(0, 30);
    const panel = svg.closest(".v2-dashboard-chart");
    let stats = panel.querySelector(".forecast-metrics");
    if (!stats) {
      stats = document.createElement("div");
      stats.className = "forecast-metrics";
      svg.before(stats);
      const viewport = document.createElement("div");
      viewport.className = "chart-viewport";
      svg.before(viewport);
      viewport.append(svg);
      let measuredWidth = 0;
      const observer = new ResizeObserver((entries) => {
        const width = Math.round(entries[0].contentRect.width);
        if (width > 0 && width !== measuredWidth) {
          measuredWidth = width;
          requestAnimationFrame(() => {
            if (state) drawBudgetChart(state);
          });
        }
      });
      observer.observe(viewport);
      const detail = document.createElement("div");
      detail.className = "chart-selection";
      detail.id = "chart-selection";
      detail.setAttribute("aria-live", "polite");
      viewport.after(detail);
      const legend = document.createElement("p");
      legend.className = "chart-legend";
      legend.innerHTML =
        "<span>Disponible projeté</span><span>Seuil de 0 $</span><small>Survolez, touchez ou utilisez les flèches sur un point.</small>";
      detail.after(legend);
      const table = document.createElement("details");
      table.className = "chart-table";
      table.innerHTML =
        '<summary>Consulter les montants jour par jour</summary><div class="scroll"><table><caption>Disponible prévu pour les 30 prochains jours</caption><thead><tr><th scope="col">Date</th><th scope="col">Mouvements prévus</th><th scope="col">Disponible</th></tr></thead><tbody></tbody></table></div>';
      legend.after(table);
    }
    svg.replaceChildren();
    stats.replaceChildren();
    const tbody = panel.querySelector(".chart-table tbody");
    tbody.replaceChildren();
    if (!days.length) {
      panel.querySelector(".chart-selection").textContent =
        "Aucune prévision disponible.";
      return;
    }
    const date = (d) =>
      new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
        day: "numeric",
        month: "short",
      });
    const values = days.map((d) => d.safe_cents),
      minValue = Math.min(...values),
      lowIndex = values.indexOf(minValue),
      last = days.at(-1);
    for (const [label, value, caption, negative] of [
      ["Au début", money(values[0]), date(days[0].date), values[0] < 0],
      [
        "Point le plus bas",
        money(minValue),
        date(days[lowIndex].date),
        minValue < 0,
      ],
      [
        "À la fin",
        money(last.safe_cents),
        date(last.date),
        last.safe_cents < 0,
      ],
    ]) {
      const metric = document.createElement("div");
      const name = document.createElement("span");
      name.textContent = label;
      const amount = document.createElement("strong");
      amount.textContent = value;
      amount.classList.toggle("negative", negative);
      const note = document.createElement("small");
      note.textContent = caption;
      metric.append(name, amount, note);
      stats.append(metric);
    }
    let alert = panel.querySelector(".forecast-alert");
    if (!alert) {
      alert = document.createElement("p");
      alert.className = "forecast-alert";
      stats.after(alert);
    }
    alert.hidden = minValue >= 0;
    alert.textContent =
      "Disponible négatif prévu le " +
      date(days[lowIndex].date) +
      " : " +
      money(minValue) +
      ". Vérifiez les mouvements de cette période.";
    const ns = "http://www.w3.org/2000/svg";
    const add = (tag, attributes, text) => {
      const node = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attributes))
        node.setAttribute(key, value);
      if (text !== undefined) node.textContent = text;
      svg.append(node);
      return node;
    };
    const W = Math.max(320, Math.round(svg.parentElement.clientWidth) || 800),
      H = 260,
      L = 68,
      R = W - 16,
      T = 20,
      B = 210;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "group");
    svg.setAttribute(
      "aria-label",
      "Disponible projeté : " +
        money(minValue) +
        " au minimum, " +
        money(last.safe_cents) +
        " en fin de période.",
    );
    const rawRange = Math.max(
      10000,
      Math.max(0, ...values) - Math.min(0, ...values),
    );
    const rough = rawRange / 4,
      unit = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 5, 10].map((n) => n * unit).find((n) => n >= rough);
    const bottom = Math.floor(Math.min(0, ...values) / step) * step,
      top = Math.max(
        bottom + step,
        Math.ceil(Math.max(0, ...values) / step) * step,
      );
    const x = (i) => L + (i * (R - L)) / Math.max(1, days.length - 1),
      y = (v) => B - ((v - bottom) * (B - T)) / (top - bottom);
    const axisMoney = (v) =>
      (v / 100).toLocaleString("fr-CA", { maximumFractionDigits: 0 }) + " $";
    for (let v = bottom; v <= top; v += step) {
      const zero = v === 0;
      add("line", {
        x1: L,
        y1: y(v),
        x2: R,
        y2: y(v),
        class: zero ? "chart-zero" : "chart-grid",
      });
      add(
        "text",
        { x: L - 12, y: y(v) + 4, "text-anchor": "end", class: "chart-tick" },
        axisMoney(v),
      );
    }
    const points = days.map((d, i) => [x(i), y(d.safe_cents)]);
    const defs = add("defs", {});
    const gradient = document.createElementNS(ns, "linearGradient");
    gradient.id = "budget-chart-fill";
    gradient.setAttribute("x2", "0");
    gradient.setAttribute("y2", "1");
    for (const [offset, opacity] of [
      ["0%", ".18"],
      ["100%", ".015"],
    ]) {
      const stop = document.createElementNS(ns, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", "#43856b");
      stop.setAttribute("stop-opacity", opacity);
      gradient.append(stop);
    }
    defs.append(gradient);
    add("path", {
      d:
        "M " +
        points.map((p) => p.join(",")).join(" L ") +
        ` L ${x(days.length - 1)},${B} L ${L},${B} Z`,
      fill: "url(#budget-chart-fill)",
      class: "chart-area",
    });
    add("polyline", {
      points: points.map((p) => p.join(",")).join(" "),
      fill: "none",
      stroke: "#43856b",
      "stroke-width": 2.5,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      "vector-effect": "non-scaling-stroke",
      class: "forecast-line",
    });
    for (const i of [
      ...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]),
    ])
      add(
        "text",
        {
          x: x(i),
          y: 244,
          "text-anchor":
            i === 0 ? "start" : i === days.length - 1 ? "end" : "middle",
          class: "chart-tick",
        },
        date(days[i].date),
      );
    const guide = add("line", {
      x1: L,
      x2: L,
      y1: T,
      y2: B,
      class: "chart-guide",
    });
    const selection = panel.querySelector(".chart-selection");
    let selected = lowIndex;
    const dots = [];
    const choose = (index, focus = false) => {
      selected = index;
      const d = days[index];
      guide.setAttribute("x1", x(index));
      guide.setAttribute("x2", x(index));
      dots.forEach((dot, i) => {
        dot.setAttribute("tabindex", i === index ? "0" : "-1");
        dot.setAttribute("r", i === index ? 5.5 : 3);
        dot.classList.toggle("selected", i === index);
      });
      selection.replaceChildren();
      const label = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = new Date(d.date + "T12:00:00").toLocaleDateString(
        "fr-CA",
        { weekday: "long", day: "numeric", month: "long" },
      );
      const note = document.createElement("span");
      note.textContent =
        (d.events || [])
          .map((e) => e.description || types[e.type] || "Mouvement")
          .join(" · ") || "Aucun mouvement prévu";
      label.append(title, note);
      const value = document.createElement("strong");
      value.textContent = money(d.safe_cents);
      value.className = d.safe_cents < 0 ? "negative" : "";
      selection.append(label, value);
      if (focus) dots[index].focus();
    };
    days.forEach((d, i) => {
      const dot = add("circle", {
        cx: x(i),
        cy: y(d.safe_cents),
        r: 3,
        class: "chart-dot" + (d.safe_cents < 0 ? " below-zero" : ""),
        role: "button",
        tabindex: "-1",
        "aria-label": date(d.date) + " : " + money(d.safe_cents),
        "aria-describedby": "chart-selection",
      });
      dot.addEventListener("focus", () => choose(i));
      dot.addEventListener("click", () => choose(i));
      dot.addEventListener("keydown", (e) => {
        let next;
        if (e.key === "ArrowRight") next = Math.min(days.length - 1, i + 1);
        if (e.key === "ArrowLeft") next = Math.max(0, i - 1);
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = days.length - 1;
        if (next !== undefined) {
          e.preventDefault();
          choose(next, true);
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose(i);
        }
      });
      dots.push(dot);
      const row = document.createElement("tr");
      for (const text of [
        date(d.date),
        (d.events || [])
          .map((e) => e.description || types[e.type] || "Mouvement")
          .join(", ") || "—",
        money(d.safe_cents),
      ]) {
        const td = document.createElement("td");
        td.textContent = text;
        row.append(td);
      }
      tbody.append(row);
    });
    svg.onpointermove = (e) => {
      if (e.pointerType === "touch") return;
      const bounds = svg.getBoundingClientRect();
      const position = ((e.clientX - bounds.left) * W) / bounds.width;
      choose(
        Math.max(
          0,
          Math.min(
            days.length - 1,
            Math.round(((position - L) / (R - L)) * (days.length - 1)),
          ),
        ),
      );
    };
    svg.onclick = (e) => {
      const bounds = svg.getBoundingClientRect();
      choose(
        Math.max(
          0,
          Math.min(
            days.length - 1,
            Math.round(
              ((((e.clientX - bounds.left) * W) / bounds.width - L) / (R - L)) *
                (days.length - 1),
            ),
          ),
        ),
      );
    };
    svg.onpointerleave = () => {
      if (!svg.contains(document.activeElement)) choose(lowIndex);
    };
    choose(selected);
  }

  (() => {
    const descriptions = {
      demarrage:
        "Configurez Conjoint, vos cartes, vos budgets et vos virements personnels.",
      budget: "Vos revenus et dépenses, prévus et réels.",
      paie: "Préparez votre prochaine paie et suivez vos priorités.",
      categories: "Créez et personnalisez les catégories de vos achats.",
      "budgets-libres":
        "Réservez pour vos achats à votre rythme, sans budget fixe.",
      suivi: "Comparez les mouvements prévus aux opérations réelles.",
      bilan: "Comprenez vos revenus et vos dépenses, mois après mois.",
      importer:
        "Ajoutez votre historique bancaire avec un aperçu avant import.",
      objectifs: "Donnez une destination à votre épargne.",
      sauvegardes: "Conservez et restaurez une copie complète de votre budget.",
      dashboard: "Une vision claire pour décider en toute confiance.",
      comptes: "Vos soldes réels et les comptes inclus dans votre disponible.",
      transactions: "Retrouvez vos opérations et gardez votre budget à jour.",
      enveloppes: "Organisez votre argent selon vos priorités.",
      recurrences: "Anticipez vos revenus, factures et virements réguliers.",
      prevision: "Explorez votre disponible et vos mouvements jour par jour.",
      calendrier: "Visualisez vos opérations au fil du mois.",
      virements: "Déplacez de l’argent entre vos comptes.",
      exceptions: "Ajustez une occurrence sans changer votre règle habituelle.",
    };
    const paths = {
      verification: "M9 11l3 3 7-7 M5 3h12l4 4v14H3V3z",
      demarrage: "M4 4h16v16H4z M8 9l2 2 5-5 M8 15h8",
      budget: "M3 4h18v16H3z M3 10h18 M10 10v10",
      paie: "M3 6h18v15H3z M3 10h18 M7 3v6 M17 3v6 M8 15h8",
      categories: "M3 4h8l10 10-7 7L3 10z M7 8h.01",
      "budgets-libres": "M4 5h16v16H4z M8 11h8 M12 7v8",
      suivi: "M4 6h16 M4 12h8 M4 18h8 M15 15l3 3 4-6",
      bilan: "M4 21V11h4v10 M10 21V3h4v18 M16 21V7h4v14",
      importer: "M12 3v12 M7 10l5 5 5-5 M3 16v5h18v-5",
      objectifs: "M21 12a9 9 0 1 1-9-9 M12 7a5 5 0 1 0 5 5 M12 12l9-9",
      sauvegardes: "M3 3h15l3 3v15H3z M7 3v6h10V3 M7 21v-8h10v8",
      dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
      comptes: "M3 7h18v13H3z M3 7l13-4v4 M16 12h5v4h-5z",
      transactions: "M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4",
      enveloppes: "M3 5h18v14H3z M3 5l9 7 9-7",
      recurrences:
        "M20 8a8 8 0 0 0-14-2L3 9 M3 3v6h6 M4 16a8 8 0 0 0 14 2l3-3 M15 15h6v6",
      prevision: "M3 3v18h18 M6 15l5-5 4 3 6-8",
      calendrier: "M3 5h18v16H3z M3 10h18 M7 2v6 M17 2v6",
      virements: "M3 8h18 M17 4l4 4-4 4 M21 16H3 M7 12l-4 4 4 4",
      exceptions: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
    };
    const subtitle = document.querySelector(".workspace-header .sub");
    document
      .querySelectorAll(".app-shell-nav [data-view]")
      .forEach((button) => {
        const icon = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("aria-hidden", "true");
        icon.classList.add("nav-icon");
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("d", paths[button.dataset.view]);
        icon.append(path);
        button.prepend(icon);
        const update = () =>
          (subtitle.textContent = descriptions[button.dataset.view]);
        button.addEventListener("click", update);
        if (button.classList.contains("active")) update();
      });
    document.getElementById("dashboard-envelopes").onclick = () =>
      document.querySelector('[data-view="enveloppes"]').click();
    document.getElementById("dashboard-recurring").onclick = () =>
      document.querySelector('[data-view="recurrences"]').click();
    // The compact explanations remain accessible without dominating every visit.
    const explanation = document.querySelector(".sts-explain");
    const note = document.querySelector(".budget-note");
    if (explanation && note) note.append(explanation);
    document.querySelector(".app-dashboard .dashboard-intro")?.remove();
    const refresh = document.getElementById("v21-refresh");
    const original = refresh.onclick;
    refresh.onclick = async function () {
      this.disabled = true;
      this.textContent = "Actualisation…";
      try {
        await original();
      } finally {
        this.disabled = false;
        this.textContent = "Actualiser les calculs";
      }
    };
  })();

  // Keep feedback next to the action, including errors inside modal editors.
  (() => {
    const feedback = document.createElement("div");
    feedback.className = "save-notification";
    feedback.setAttribute("role", "status");
    feedback.hidden = true;
    document.body.append(feedback);
    let dismissTimer;
    const originalSend = send;
    send = async function (url, data) {
      clearTimeout(dismissTimer);
      feedback.hidden = true;
      const dialog = document.querySelector("dialog[open]");
      dialog?.querySelector(".form-feedback")?.remove();
      const buttons = dialog
        ? [
            ...dialog.querySelectorAll(
              'form button:not([type]),form button[type="submit"]',
            ),
          ]
        : [];
      buttons.forEach((button) => (button.disabled = true));
      let ok;
      try {
        ok = await originalSend(url, data);
      } finally {
        buttons.forEach((button) => (button.disabled = false));
      }
      if (ok) {
        clearTimeout(dismissTimer);
        feedback.textContent = "✓ Modification enregistrée";
        feedback.hidden = false;
        dismissTimer = setTimeout(() => (feedback.hidden = true), 3500);
      } else if (dialog?.open) {
        const error = document.createElement("p");
        error.className = "form-feedback";
        error.setAttribute("role", "alert");
        error.textContent =
          document.getElementById("error").textContent ||
          "Enregistrement impossible. Vérifiez les informations saisies.";
        dialog.querySelector(".dialog-heading").after(error);
      }
      return ok;
    };
    const originalRender = render;
    render = function (s) {
      originalRender(s);
      let welcome = document.getElementById("budget-welcome");
      if (!welcome) {
        welcome = document.createElement("aside");
        welcome.id = "budget-welcome";
        welcome.className = "welcome-banner";
        const copy = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = "Votre budget commence ici";
        const text = document.createElement("p");
        text.textContent =
          "Ajoutez un premier compte et son solde actuel. Vous pourrez ensuite organiser vos enveloppes et vos prévisions.";
        copy.append(heading, text);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Ajouter mon premier compte";
        button.onclick = () => window.appOpenEditor("account");
        welcome.append(copy, button);
        document.querySelector(".cards").before(welcome);
      }
      welcome.hidden = !!s.accounts?.length;
    };
  })();

  Object.defineProperties(runtime, {
    $: { enumerable: true, get: () => $ },
    money: { enumerable: true, get: () => money },
    state: {
      enumerable: true,
      get: () => state,
      set: (value) => {
        state = value;
      },
    },
    today: { enumerable: true, get: () => today },
    adjustments: { enumerable: true, get: () => adjustments },
    types: { enumerable: true, get: () => types },
    freq: { enumerable: true, get: () => freq },
    fill: {
      enumerable: true,
      get: () => fill,
      set: (value) => {
        fill = value;
      },
    },
    transactionAccountInitialized: {
      enumerable: true,
      get: () => transactionAccountInitialized,
      set: (value) => {
        transactionAccountInitialized = value;
      },
    },
    selectDefaultTransactionAccount: {
      enumerable: true,
      get: () => selectDefaultTransactionAccount,
      set: (value) => {
        selectDefaultTransactionAccount = value;
      },
    },
    list: {
      enumerable: true,
      get: () => list,
      set: (value) => {
        list = value;
      },
    },
    cell: {
      enumerable: true,
      get: () => cell,
      set: (value) => {
        cell = value;
      },
    },
    renderTransactions: {
      enumerable: true,
      get: () => renderTransactions,
      set: (value) => {
        renderTransactions = value;
      },
    },
    renderRealTransfers: {
      enumerable: true,
      get: () => renderRealTransfers,
      set: (value) => {
        renderRealTransfers = value;
      },
    },
    renderAccounts: {
      enumerable: true,
      get: () => renderAccounts,
      set: (value) => {
        renderAccounts = value;
      },
    },
    accountKind: {
      enumerable: true,
      get: () => accountKind,
      set: (value) => {
        accountKind = value;
      },
    },
    editAccount: {
      enumerable: true,
      get: () => editAccount,
      set: (value) => {
        editAccount = value;
      },
    },
    resetAccount: {
      enumerable: true,
      get: () => resetAccount,
      set: (value) => {
        resetAccount = value;
      },
    },
    envelopeModeHelp: {
      enumerable: true,
      get: () => envelopeModeHelp,
      set: (value) => {
        envelopeModeHelp = value;
      },
    },
    resetEnvelope: {
      enumerable: true,
      get: () => resetEnvelope,
      set: (value) => {
        resetEnvelope = value;
      },
    },
    editEnvelope: {
      enumerable: true,
      get: () => editEnvelope,
      set: (value) => {
        editEnvelope = value;
      },
    },
    deleteEnvelope: {
      enumerable: true,
      get: () => deleteEnvelope,
      set: (value) => {
        deleteEnvelope = value;
      },
    },
    renderEnvelopes: {
      enumerable: true,
      get: () => renderEnvelopes,
      set: (value) => {
        renderEnvelopes = value;
      },
    },
    renderSpendingWindows: {
      enumerable: true,
      get: () => renderSpendingWindows,
      set: (value) => {
        renderSpendingWindows = value;
      },
    },
    stateRenderCache: { enumerable: true, get: () => stateRenderCache },
    render: {
      enumerable: true,
      get: () => render,
      set: (value) => {
        render = value;
      },
    },
    forecastOpenDates: { enumerable: true, get: () => forecastOpenDates },
    forecastInitialized: {
      enumerable: true,
      get: () => forecastInitialized,
      set: (value) => {
        forecastInitialized = value;
      },
    },
    renderForecast: {
      enumerable: true,
      get: () => renderForecast,
      set: (value) => {
        renderForecast = value;
      },
    },
    setForecastDayOpen: {
      enumerable: true,
      get: () => setForecastDayOpen,
      set: (value) => {
        setForecastDayOpen = value;
      },
    },
    toggleType: {
      enumerable: true,
      get: () => toggleType,
      set: (value) => {
        toggleType = value;
      },
    },
    editRule: {
      enumerable: true,
      get: () => editRule,
      set: (value) => {
        editRule = value;
      },
    },
    resetRec: {
      enumerable: true,
      get: () => resetRec,
      set: (value) => {
        resetRec = value;
      },
    },
    send: {
      enumerable: true,
      get: () => send,
      set: (value) => {
        send = value;
      },
    },
    budgetEmpty: {
      enumerable: true,
      get: () => budgetEmpty,
      set: (value) => {
        budgetEmpty = value;
      },
    },
    drawBudgetChart: {
      enumerable: true,
      get: () => drawBudgetChart,
      set: (value) => {
        drawBudgetChart = value;
      },
    },
  });
}
