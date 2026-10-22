// Compact register; edits reuse the existing token-protected bulk mutation path.
export function initialize(runtime) {
  const $ = (id) => document.getElementById(id),
    node = (tag, text, cls) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = text;
      if (cls) e.className = cls;
      return e;
    };
  const button = (text, fn, cls = "secondary") => {
    const e = node("button", text, cls);
    e.type = "button";
    e.onclick = fn;
    return e;
  };
  const money = (n) =>
      new Intl.NumberFormat("fr-CA", {
        style: "currency",
        currency: "CAD",
      }).format(n / 100),
    compact = matchMedia("(max-width:1099px)"),
    section = $("section-transactions"),
    host = $("v2-transaction-list"),
    head = document.querySelector(".sillage-ledger-head");
  section.classList.add("register-table-view");
  const table = node("div", undefined, "register-table");
  table.setAttribute("role", "table");
  host.setAttribute("role", "rowgroup");
  table.setAttribute("aria-label", "Transactions enregistrées");
  head.before(table);
  table.append(head, host);
  head.setAttribute("role", "row");
  const savedStatus = node("p", undefined, "register-saved-status");
  savedStatus.id = "register-saved-status";
  savedStatus.setAttribute("role", "status");
  table.before(savedStatus);
  const columns = [
    ["Sélection", "select"],
    ["Date", "date"],
    ["Description", "description"],
    ["Compte", "account"],
    ["Catégorie", "category"],
    ["Enveloppe", "envelope"],
    ["Montant", "amount"],
    ["Statut", "status"],
    ["Actions", "actions"],
  ];
  head.replaceChildren();
  const sort = $("sillage-sort");
  function sortBy(key) {
    let direction = sort.value === key + ":asc" ? "desc" : "asc";
    const value = key + ":" + direction;
    if (![...sort.options].some((o) => o.value === value))
      sort.add(
        new Option(
          columns.find((c) => c[1] === key)[0] + " · " + direction,
          value,
        ),
      );
    sort.value = value;
    sort.dispatchEvent(new Event("change", { bubbles: true }));
    syncSort();
  }
  const all = node("input");
  all.type = "checkbox";
  all.setAttribute(
    "aria-label",
    "Sélectionner toutes les opérations affichées",
  );
  for (const [label, key] of columns) {
    const cell = node("div", undefined, "register-column");
    cell.dataset.column = key;
    cell.setAttribute("role", "columnheader");
    if (key === "select") cell.append(all);
    else if (
      [
        "date",
        "description",
        "account",
        "category",
        "envelope",
        "amount",
      ].includes(key)
    )
      cell.append(button(label, () => sortBy(key), "register-sort"));
    else cell.textContent = key === "actions" ? "" : label;
    head.append(cell);
  }
  function syncSort() {
    const [key, direction] = sort.value.split(":");
    for (const cell of head.children) {
      if (cell.dataset.column === key)
        cell.setAttribute(
          "aria-sort",
          direction === "asc" ? "ascending" : "descending",
        );
      else cell.removeAttribute("aria-sort");
    }
  }
  sort.addEventListener("change", syncSort);
  syncSort();
  all.onchange = () => {
    const wanted = all.checked;
    for (const check of host.querySelectorAll(".v80-row-check")) {
      if (check.checked !== wanted) {
        check.checked = wanted;
        check.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    syncChecks();
  };
  function syncChecks() {
    const checks = [...host.querySelectorAll(".v80-row-check")],
      count = checks.filter((c) => c.checked).length;
    all.checked = checks.length > 0 && count === checks.length;
    all.indeterminate = count > 0 && count < checks.length;
    all.disabled = !checks.length;
  }
  host.addEventListener("change", syncChecks);
  const envelopeFilter = node("select");
  envelopeFilter.id = "register-envelope-filter";
  envelopeFilter.setAttribute("aria-label", "Filtrer par enveloppe");
  const filterLabel = node("label", "Enveloppe");
  filterLabel.append(envelopeFilter);
  document
    .querySelector(".register-search-row")
    .append($("v3-category-filter").parentElement, filterLabel);
  envelopeFilter.onchange = () => {
    $("v2-account").dispatchEvent(new Event("change", { bubbles: true }));
  };
  // Extend the existing reset action while retaining every other filter and its event.
  const reset = [
    ...document.querySelectorAll(".register-filter-footer button"),
  ].find((b) => b.textContent === "Réinitialiser les filtres");
  reset?.addEventListener("click", () => {
    envelopeFilter.value = "";
    envelopeFilter.onchange();
  });
  let state,
    rows = [];
  function fillFilters() {
    const value = envelopeFilter.value;
    envelopeFilter.replaceChildren(
      new Option("Toutes les enveloppes", ""),
      ...state.envelopes.map((e) => new Option(e.name, e.id)),
    );
    envelopeFilter.value = [...envelopeFilter.options].some(
      (o) => o.value === value,
    )
      ? value
      : "";
    if (value && envelopeFilter.value !== value)
      queueMicrotask(() => window.budgetRefreshTransactions());
  }
  function matchedIds() {
    return new Set([
      ...(state?.planning?.rows || [])
        .flatMap((r) => r.actual_ids || [])
        .filter((id) => id.startsWith("transaction:"))
        .map((id) => Number(id.split(":")[1])),
      ...(state?.reconciliation_links || [])
        .filter((l) => l.actual_type === "transaction")
        .map((l) => l.actual_id),
      ...(state?.planning?.envelope_actual_links || []).map(
        (l) => l.transaction_id,
      ),
    ]);
  }
  function decorate() {
    const matched = matchedIds();
    for (const t of rows) {
      const row = host.querySelector(`[data-transaction-id="${t.id}"]`);
      if (!row || row.dataset.registerDecorated) continue;
      row.dataset.registerDecorated = "true";
      row.setAttribute("role", "row");
      const selection = node("label", undefined, "register-select-cell");
      selection.setAttribute("role", "cell");
      const checkbox = row.querySelector(".v80-row-check");
      checkbox.before(selection);
      selection.append(checkbox);
      const when = row.querySelector("time.sillage-row-date");
      when.classList.add("register-date-cell");
      const account = node("span", t.account_name, "register-account-cell");
      row.append(account);
      const category = row.querySelector(".ledger-category");
      category.replaceChildren(
        button(
          (t.category_name || "Non-catégorisé") +
            (t.subcategory_name ? " › " + t.subcategory_name : ""),
          () => edit(t, "category"),
          "register-cell-edit category-tag",
        ),
      );
      category.firstChild.setAttribute(
        "aria-label",
        "Changer la catégorie de " + t.description,
      );
      const envelope = button(
        t.envelope_name || "—",
        () => edit(t, "envelope"),
        "register-cell-edit register-envelope-cell",
      );
      envelope.setAttribute(
        "aria-label",
        "Changer l’enveloppe de " + t.description,
      );
      if (t.amount_cents >= 0) {
        envelope.disabled = true;
        envelope.title = "Les revenus n’utilisent pas d’enveloppe.";
      }
      row.append(envelope);
      const status = node("div", undefined, "register-status-cell"),
        review = row.querySelector(".review-pill");
      status.append(review);
      row.append(status);
      const match = node("span", "Prévu associé", "register-match");
      match.hidden = !matched.has(t.id);
      match.title =
        "Associée à une récurrence ou à une période d’enveloppe dans le moteur de prévision.";
      status.append(match);
      const meta = row.querySelector(".ledger-meta");
      const cat = node(
        "span",
        (t.category_name || "Non-catégorisé") +
          (t.subcategory_name ? " › " + t.subcategory_name : ""),
        "register-mobile-category",
      );
      meta.append(cat);
      meta.title = [
        t.happened_on,
        t.account_name,
        cat.textContent,
        t.envelope_name,
      ]
        .filter(Boolean)
        .join(" · ");
      const menu = row.querySelector(".ledger-menu-items");
      const fullEdit = row.querySelector(".ledger-edit");
      fullEdit.addEventListener("click", () => {
        row.querySelector(".ledger-menu").open = false;
      });
      menu.prepend(fullEdit);
      menu.prepend(
        button("Changer le classement", () => {
          row.querySelector(".ledger-menu").open = false;
          edit(t, "category");
        }),
      );
      row._register = { when, status, review, match, meta };
      for (const element of [
        when,
        account,
        category,
        envelope,
        status,
        row.querySelector(".ledger-description"),
        row.querySelector(".ledger-amount"),
        row.querySelector(".ledger-actions"),
      ])
        element.setAttribute("role", "cell");
    }
    place();
    syncChecks();
    syncSort();
  }
  function place() {
    const target = compact.matches
      ? document.querySelector(".register-advanced-fields")
      : document.querySelector(".register-search-row");
    for (const label of [$("v3-category-filter").parentElement, filterLabel])
      if (label.parentElement !== target) target.append(label);
    for (const row of host.querySelectorAll(".ledger-row")) {
      const parts = row._register;
      if (!parts) continue;
      const { when, status, review, match, meta } = parts;
      when.textContent = new Date(
        when.dateTime + "T12:00:00",
      ).toLocaleDateString("fr-CA", {
        day: "numeric",
        month: "short",
        year:
          !compact.matches ||
          when.dateTime.slice(0, 4) !== runtime.today().slice(0, 4)
            ? "numeric"
            : undefined,
      });
      match.textContent = compact.matches ? "Prévu" : "Prévu associé";
      match.setAttribute("aria-label", "Associée au prévu");
      if (compact.matches) {
        if (when.parentElement !== meta) meta.prepend(when);
        if (review.parentElement !== row.querySelector(".ledger-menu-items"))
          row.querySelector(".ledger-menu-items").append(review);
        if (match.parentElement !== meta) meta.append(match);
      } else {
        if (when.parentElement !== row) row.prepend(when);
        if (review.parentElement !== status) status.prepend(review);
        if (match.parentElement !== status) status.append(match);
      }
    }
  }
  compact.addEventListener("change", place);
  document.addEventListener("budget:transactions-loaded", (e) => {
    rows = e.detail.rows || [];
    decorate();
    if (envelopeFilter.value) reset.hidden = false;
  });
  document.addEventListener("budget:transactions-loading", () => {
    all.disabled = true;
    all.checked = false;
    all.indeterminate = false;
  });
  const dialog = node(
    "dialog",
    undefined,
    "editor-dialog register-edit-dialog",
  );
  dialog.id = "register-classification-dialog";
  dialog.setAttribute("aria-label", "Classer la transaction");
  const inner = node("div", undefined, "dialog-inner"),
    heading = node("div", undefined, "dialog-heading"),
    close = button("Fermer", () => dialog.close());
  heading.append(node("h2", "Classer la transaction"), close);
  inner.append(heading);
  dialog.append(inner);
  document.body.append(dialog);
  let generation = 0;
  dialog.addEventListener("close", () => {
    generation++;
  });
  async function request(path, data) {
    const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
      out = await r.json();
    if (!r.ok) throw Error(out.error || "Enregistrement impossible.");
    return out;
  }
  function edit(t, focus) {
    savedStatus.textContent = "";
    generation++;
    const form = node("form"),
      category = node("select"),
      child = node("select"),
      envelope = node("select"),
      feedback = node("p"),
      preview = node("div");
    feedback.setAttribute("role", "status");
    const field = (label, input) => {
      const row = node("label", label);
      row.append(input);
      form.append(row);
      return input;
    };
    category.setAttribute("aria-label", "Catégorie de la transaction");
    child.setAttribute("aria-label", "Sous-catégorie de la transaction");
    envelope.setAttribute("aria-label", "Enveloppe de la transaction");
    category.append(
      new Option("Non-catégorisé", ""),
      ...state.categories
        .filter((c) => !c.archived || c.id === t.category_id)
        .map((c) => new Option(c.name, c.id)),
    );
    category.value = t.category_id || "";
    const children = () => {
      child.replaceChildren(
        new Option("Aucune", ""),
        ...(state.subcategories || [])
          .filter(
            (s) =>
              s.category_id === Number(category.value) &&
              (!s.archived || s.id === t.subcategory_id),
          )
          .map((s) => new Option(s.name, s.id)),
      );
    };
    children();
    child.value = t.subcategory_id || "";
    category.onchange = children;
    envelope.append(
      new Option("Aucune", ""),
      ...state.envelopes
        .filter((e) => e.active || e.id === t.envelope_id)
        .map((e) => new Option(e.name, e.id)),
    );
    envelope.value = t.envelope_id || "";
    envelope.disabled = t.amount_cents >= 0;
    field("Catégorie", category);
    field("Sous-catégorie", child);
    field("Enveloppe", envelope);
    const save = button("Enregistrer le classement", () => {});
    save.type = "submit";
    form.append(feedback, preview, save);
    inner.replaceChildren(
      heading,
      node(
        "p",
        t.happened_on + " · " + t.description + " · " + money(t.amount_cents),
      ),
      form,
    );
    dialog.showModal();
    (focus === "envelope" ? envelope : category).focus();
    const changes = () => {
      const c = {};
      if (
        Number(category.value || 0) !== Number(t.category_id || 0) ||
        Number(child.value || 0) !== Number(t.subcategory_id || 0)
      ) {
        c.category_id = category.value ? Number(category.value) : null;
        c.subcategory_id = child.value ? Number(child.value) : null;
      }
      if (
        !envelope.disabled &&
        Number(envelope.value || 0) !== Number(t.envelope_id || 0)
      )
        c.envelope_id = envelope.value ? Number(envelope.value) : null;
      return c;
    };
    const lock = (value) => {
      category.disabled = child.disabled = value;
      envelope.disabled = value || t.amount_cents >= 0;
      save.disabled = value;
    };
    let busy = false;
    form.addEventListener("change", () => {
      generation++;
      preview.replaceChildren();
      feedback.textContent = "";
    });
    async function apply(payload, token, mine) {
      if (mine !== generation || !dialog.open) return;
      const out = await request("/api/workspace/bulk-apply", {
        ...payload,
        token,
      });
      savedStatus.textContent =
        "Classement enregistré. Les soldes bancaires sont conservés.";
      if (mine !== generation || !dialog.open) {
        runtime.render(out);
        window.budgetRefreshTransactions({ keepPage: true });
        return;
      }
      runtime.render(out);
      dialog.close();
      window.budgetRefreshTransactions({ keepPage: true });
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      const change = changes();
      if (!Object.keys(change).length) {
        feedback.textContent = "Aucun changement à enregistrer.";
        return;
      }
      busy = true;
      lock(true);
      preview.replaceChildren();
      feedback.textContent = "Vérification…";
      const mine = ++generation,
        payload = { ids: [t.id], changes: change };
      try {
        const p = await request("/api/workspace/bulk-preview", payload);
        if (mine !== generation || !dialog.open) return;
        if (!Object.hasOwn(change, "envelope_id")) {
          await apply(payload, p.token, mine);
          return;
        }
        feedback.textContent =
          "Vérifiez l’effet du changement d’enveloppe avant de confirmer.";
        preview.append(
          node(
            "p",
            "Disponible : " +
              money(p.before.safe_cents) +
              " → " +
              money(p.after.safe_cents) +
              ". Réserves : " +
              money(p.before.reserved_cents) +
              " → " +
              money(p.after.reserved_cents) +
              ". Minimum sur 90 jours : " +
              money(p.before.minimum_cents) +
              " → " +
              money(p.after.minimum_cents) +
              ". Soldes bancaires conservés.",
          ),
        );
        if (p.items.some((i) => i.detaches_period))
          preview.append(
            node(
              "p",
              "L’association à la période prévue sera retirée. Vérifiez la période après le changement.",
              "warning",
            ),
          );
        if (!p.items.some((i) => i.detaches_period) && matchedIds().has(t.id)) {
          preview.append(
            node(
              "p",
              "Cette opération est associée au prévu. Le changement d’enveloppe peut modifier cette association; l’aperçu inclut son effet.",
              "warning",
            ),
          );
        }
        const confirm = button(
          "Confirmer le changement d’enveloppe",
          async () => {
            if (busy) return;
            busy = true;
            lock(true);
            confirm.disabled = true;
            try {
              await apply(payload, p.token, mine);
            } catch (err) {
              feedback.textContent = err.message;
              preview.replaceChildren();
            } finally {
              busy = false;
              lock(false);
              confirm.disabled = false;
            }
          },
        );
        preview.append(confirm);
      } catch (err) {
        if (mine === generation) feedback.textContent = err.message;
      } finally {
        busy = false;
        lock(false);
      }
    };
  }
  const render = runtime.render;
  runtime.render = function (s) {
    const out = render(s);
    state = s;
    fillFilters();
    const matched = matchedIds();
    for (const row of host.querySelectorAll(".ledger-row"))
      if (row._register)
        row._register.match.hidden = !matched.has(
          Number(row.dataset.transactionId),
        );
    return out;
  };
  if (runtime.state) {
    state = runtime.state;
    fillFilters();
  }
}
