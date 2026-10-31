import {
  $,
  node,
  money,
  shortDate,
  longDate,
  field,
  input,
  select,
  button,
  panel,
  todayView,
} from "./view.js";
const shared = location.pathname.match(/^\/s\/[^/]+/),
  editor = $("#editor"),
  editorForm = $("#editor-form");
let state,
  page = location.hash.slice(1) || "today",
  saveEditor,
  step = 0,
  wizard = {
    account_name: "Conjoint",
    balance: "",
    paychecks: [],
    bills: [],
    categories: [],
  };
const dateNow = () =>
  state?.simulation.reference ||
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const addDays = (d, n) =>
  new Date(Date.parse(d + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const toast = (text) => {
  const el = $("#notice");
  el.textContent = text;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 5500);
};
async function request(url, data) {
  const r = await fetch(
    url,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  const result = await r.json();
  if (!r.ok) throw Error(result.error || "Opération impossible.");
  return result;
}
async function send(url, data, message = "Enregistré") {
  state = await request(url, data);
  render();
  if (message) toast(message);
  return state;
}
function modal(title, content, save, saveText = "Enregistrer") {
  $("#editor-title").textContent = title;
  $("#editor-body").replaceChildren(
    ...(Array.isArray(content) ? content : [content]),
  );
  $("#editor-error").textContent = "";
  $("#editor-save").textContent = saveText;
  $("#editor-save").hidden = !save;
  saveEditor = save;
  editor.showModal();
  const focus = editor.querySelector(
    "#editor-body [autofocus],#editor-body input:not([type=file])",
  );
  focus?.focus({ preventScroll: true });
}
editorForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!saveEditor) return;
  $("#editor-save").disabled = true;
  try {
    const close = await saveEditor();
    if (close !== false) editor.close();
  } catch (err) {
    $("#editor-error").textContent = err.message;
  } finally {
    $("#editor-save").disabled = false;
  }
};
for (const b of editor.querySelectorAll(".close"))
  b.onclick = () => editor.close();
const required = (el) => ((el.required = true), el);
const amountField = (name, value = "") => {
  const el = input(name, "number", value);
  el.step = ".01";
  el.inputMode = "decimal";
  return required(el);
};
const accounts = (value, bankOnly = false) =>
  select(
    "account_id",
    (state.accounts || [])
      .filter((a) => !bankOnly || a.kind === "bank")
      .map((a) => [a.id, a.name]),
    value || state.accounts?.find((a) => a.is_main)?.id,
  );
const categories = (value) =>
  select(
    "category_id",
    [
      ["", "Sans catégorie"],
      ...(state.categories || [])
        .filter((c) => c.active)
        .map((c) => [c.id, c.name]),
    ],
    value || "",
  );
const frequencies = (value) =>
  select(
    "frequency",
    [
      ["weekly", "Chaque semaine"],
      ["biweekly", "Aux deux semaines"],
      ["monthly", "Chaque mois"],
      ["quarterly", "Aux trois mois"],
      ["semiannual", "Aux six mois"],
      ["yearly", "Chaque année"],
      ["last_day", "Dernier jour du mois"],
      ["last_business_day", "Dernier jour ouvrable du mois"],
      ["rrq", "RRQ (dates à confirmer)"],
    ],
    value || "monthly",
  );
function calendarFields(
  frequency,
  start,
  startLabel,
  initial = {},
  compact = false,
) {
  const container = node("div", null, "calendar-fields"),
    options = node("details", null, "details-options"),
    summary = node("summary", "Week-ends et jours fériés");
  const adjustment = select(
    "day_adjust",
    [
      ["none", "Conserver la date"],
      ["before", "Jour ouvrable précédent"],
      ["after", "Jour ouvrable suivant"],
    ],
    initial.day_adjust ?? (initial.kind === "income" ? "before" : "after"),
  );
  const preview = node("div", null, "calendar-preview");
  preview.setAttribute("aria-live", "polite");
  options.append(
    summary,
    field("Si la date tombe un week-end ou un férié", adjustment),
  );
  options.open = adjustment.value !== "none";
  container.append(options, preview);
  const originalLabel = startLabel.firstChild.textContent;
  let serial = 0,
    timer;
  const format = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  async function refresh() {
    const ticket = ++serial,
      monthEnd = ["last_day", "last_business_day", "rrq"].includes(
        frequency.value,
      ),
      label = monthEnd ? "Date dans le premier mois" : originalLabel;
    startLabel.firstChild.textContent = label;
    start.setAttribute("aria-label", label);
    preview.replaceChildren(
      node("p", "Vérification des prochaines dates…", "muted"),
    );
    if (!start.value) {
      preview.replaceChildren();
      return;
    }
    try {
      const out = await request("/api/recurrence/preview", {
        id: initial.id,
        start_on: start.value,
        frequency: frequency.value,
        day_adjust: adjustment.value,
        one_time: !!initial.one_time,
      });
      if (ticket !== serial) return;
      preview.replaceChildren(
        node(
          "strong",
          compact ? "Prochaine date prévue" : "Prochaines dates prévues",
        ),
      );
      for (const d of compact ? out.dates.slice(0, 1) : out.dates)
        preview.append(
          node(
            "div",
            d.shifted
              ? format(d.nominal) + " → " + format(d.date)
              : format(d.date),
            "calendar-preview-date",
          ),
        );
      if (!out.dates.length)
        preview.append(node("p", "Échéance déjà réglée.", "muted"));
      preview.append(node("p", out.calendar, "muted"));
      if (out.estimated)
        preview.append(
          node(
            "p",
            "RRQ : estimation selon le dernier jour ouvrable. Confirmez les dates auprès de Retraite Québec.",
            "warning",
          ),
        );
    } catch (e) {
      if (ticket === serial)
        preview.replaceChildren(node("p", e.message, "error"));
    }
  }
  frequency.addEventListener("change", refresh);
  adjustment.addEventListener("change", refresh);
  start.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  });
  refresh();
  return { container, adjustment };
}
function theme() {
  document.documentElement.dataset.theme = matchMedia(
    "(prefers-color-scheme:dark)",
  ).matches
    ? "dark"
    : "light";
}

function navigate(next) {
  page = ["today", "transactions", "plan"].includes(next) ? next : "today";
  history.replaceState(null, "", "#" + page);
  render();
  window.scrollTo(0, 0);
}
for (const b of document.querySelectorAll("[data-page]"))
  b.onclick = () => navigate(b.dataset.page);
function render() {
  theme();
  $("#top-date").textContent = longDate(dateNow());
  document.body.classList.toggle("shared", !!shared);
  for (const b of document.querySelectorAll("[data-page]")) {
    if (b.dataset.page === page) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  $("#new-transaction").hidden = !!shared || !state.configured;
  if (shared) {
    $("#main").replaceChildren(todayView(state.simulation, { shared: true }));
    return;
  }
  if (!state.configured) {
    setupView();
    return;
  }
  $("#main").replaceChildren(
    page === "today"
      ? todayView(state.simulation, {
          openBalance: checkpoint,
          openCategory: () => navigate("plan"),
          act: occurrenceAction,
          openPurchase: purchaseEditor,
        })
      : page === "transactions"
        ? transactionsView()
        : planView(),
  );
}
async function refresh() {
  try {
    state = await request(shared ? shared[0] + "/data" : "/api/state");
    render();
  } catch (e) {
    $("#main").replaceChildren(
      node("p", e.message, "warning"),
      button("Réessayer", refresh),
    );
  }
}
$("#refresh").onclick = refresh;
$("#new-transaction").onclick = () => transactionEditor();
function transactionEditor(old) {
  const direction = select(
      "direction",
      [
        ["expense", "Dépense"],
        ["income", "Revenu"],
        ["transfer", "Paiement de carte / virement"],
      ],
      old?.amount_cents > 0 ? "income" : "expense",
    ),
    amount = amountField("amount", old ? Math.abs(old.amount_cents) / 100 : "");
  amount.className = "amount-input";
  amount.autofocus = true;
  amount.placeholder = "0,00";
  amount.min = ".01";
  const description = required(
      input("description", "text", old?.description || ""),
    ),
    account = accounts(old?.account_id),
    category = categories(old?.category_id),
    date = required(input("date", "date", old?.date || dateNow()));
  date.max = dateNow();
  const destination = select(
      "to_account_id",
      state.accounts.map((a) => [a.id, a.name]),
      state.accounts.find((a) => a.kind === "card")?.id,
    ),
    period = select("period_on", []),
    match = select("occurrence", [["", "Nouvelle opération"]]);
  const group = node("div", null, "two-fields"),
    details = node("details", null, "details-options"),
    opts = node("div"),
    matchBox = node("div", null, "suggestion");
  group.append(field("Catégorie", category), field("Compte utilisé", account));
  details.append(node("summary", "Date et autres options"), opts);
  opts.append(field("Date réelle", date));
  const periodLabel = field("Compter dans", period),
    destinationLabel = field("Vers", destination);
  matchBox.append(field("Une facture correspond-elle ?", match));
  matchBox.hidden = true;
  periodLabel.hidden = true;
  destinationLabel.hidden = true;
  let suggestions = [],
    timer,
    ticket = 0;
  async function update() {
    const t = ++ticket,
      isTransfer = direction.value === "transfer";
    group.firstChild.hidden = isTransfer;
    destinationLabel.hidden = !isTransfer;
    periodLabel.hidden = true;
    matchBox.hidden = true;
    if (isTransfer) return;
    const c = state.simulation.categories.find(
      (c) => String(c.id) === category.value,
    );
    if (c) {
      const currentDate = new Date(date.value + "T12:00:00Z");
      let start;
      if (c.period === "weekly")
        start = addDays(
          date.value,
          -((currentDate.getUTCDay() - c.renewal_day + 7) % 7),
        );
      else {
        start =
          date.value.slice(0, 8) +
          String(
            Math.min(
              c.renewal_day,
              new Date(
                Date.UTC(
                  currentDate.getUTCFullYear(),
                  currentDate.getUTCMonth() + 1,
                  0,
                ),
              ).getUTCDate(),
            ),
          ).padStart(2, "0");
        if (start > date.value) {
          currentDate.setUTCDate(1);
          currentDate.setUTCMonth(currentDate.getUTCMonth() - 1);
          start =
            currentDate.toISOString().slice(0, 8) +
            String(
              Math.min(
                c.renewal_day,
                new Date(
                  Date.UTC(
                    currentDate.getUTCFullYear(),
                    currentDate.getUTCMonth() + 1,
                    0,
                  ),
                ).getUTCDate(),
              ),
            ).padStart(2, "0");
        }
      }
      let next;
      if (c.period === "weekly") next = addDays(start, 7);
      else {
        const d = new Date(start.slice(0, 8) + "01T12:00:00Z");
        d.setUTCMonth(d.getUTCMonth() + 1);
        next =
          d.toISOString().slice(0, 8) +
          String(
            Math.min(
              c.renewal_day,
              new Date(
                Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
              ).getUTCDate(),
            ),
          ).padStart(2, "0");
      }
      period.replaceChildren(
        new Option("Cette période · " + shortDate(start), start),
        new Option("La prochaine · " + shortDate(next), next),
      );
      period.value = old?.period_on || start;
      periodLabel.hidden = false;
    }
    if (old || !amount.value || !date.value) return;
    try {
      const params = new URLSearchParams({
        account_id: account.value,
        amount: (direction.value === "expense" ? -1 : 1) * Number(amount.value),
        date: date.value,
        description: description.value,
      });
      const result = await request("/api/matches?" + params);
      if (t !== ticket) return;
      suggestions = result;
      match.replaceChildren(
        new Option("Nouvelle opération", ""),
        ...result.map(
          (s, i) => new Option(s.name + " · " + shortDate(s.date), i),
        ),
      );
      matchBox.hidden = !result.length;
    } catch {}
  }
  for (const el of [direction, account, category, date, amount, description])
    el.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(update, 180);
    });
  direction.onchange = update;
  account.onchange = update;
  category.onchange = update;
  date.onchange = update;
  const content = [
    field("Type", direction),
    field("Montant", amount),
    field("Description", description),
    group,
    destinationLabel,
    periodLabel,
    matchBox,
    details,
  ];
  modal(
    old ? "Modifier l’achat" : "Une nouvelle opération",
    content,
    async () => {
      if (direction.value === "transfer") {
        if (old)
          throw Error(
            "Créez un paiement séparé au lieu de convertir un achat.",
          );
        await send("/api/transfer", {
          from_account_id: account.value,
          to_account_id: destination.value,
          amount: amount.value,
          date: date.value,
          description: description.value || "Paiement de carte",
        });
      } else
        await send("/api/transaction", {
          id: old?.id,
          account_id: account.value,
          category_id: category.value,
          amount: (direction.value === "expense" ? "-" : "") + amount.value,
          description: description.value,
          date: date.value,
          period_on: periodLabel.hidden ? null : period.value,
          included: old?.included || false,
          occurrence:
            match.value !== "" ? suggestions[+match.value] : undefined,
        });
    },
  );
  update();
}
function checkpoint() {
  const amount = amountField("amount", state.simulation.bank_cents / 100),
    copy = node(
      "p",
      "Ce solde inclut les opérations déjà saisies. Les achats sur carte à payer restent protégés.",
      "muted",
    ),
    difference = node("p", null, "import-summary");
  const update = () =>
    (difference.textContent =
      "Écart avec le solde calculé : " +
      money(
        Math.round(Number(amount.value) * 100) - state.simulation.bank_cents,
      ));
  amount.oninput = update;
  update();
  modal(
    "Vérifier mon solde",
    [field("Solde réel du Conjoint", amount), difference, copy],
    () =>
      send(
        "/api/checkpoint",
        {
          account_id: state.accounts.find((a) => a.is_main).id,
          amount: amount.value,
        },
        "Solde mis à jour. Les cartes restent protégées.",
      ),
  );
}
async function occurrenceAction(o, action) {
  try {
    if (action === "pay") {
      await send(
        "/api/occurrence",
        { ...o, action: "pay" },
        o.kind === "income" ? "Paie enregistrée" : "Paiement enregistré",
      );
      return;
    }
    const date = input(
        "date",
        "date",
        action === "postpone" ? addDays(dateNow(), 1) : dateNow(),
      ),
      amount = amountField("amount", o.amount_cents / 100);
    if (action === "postpone") {
      date.min = dateNow();
      modal("Reporter " + o.name, [field("Nouvelle date", date)], () =>
        send("/api/occurrence", { ...o, action: "postpone", date: date.value }),
      );
    } else
      modal(
        "Payer " + o.name,
        [
          field("Montant réel", amount),
          field("Date réelle", date),
          node("p", "Seule cette échéance sera modifiée.", "muted"),
        ],
        () =>
          send("/api/occurrence", {
            ...o,
            action: "pay",
            amount: amount.value,
            date: date.value,
          }),
      );
  } catch (e) {
    toast(e.message);
  }
}
function transactionsView() {
  const root = node("div"),
    heading = node("div", null, "page-heading");
  heading.append(node("h1", "Transactions"));
  root.append(heading);
  const filters = node("div", null, "filters"),
    search = input("search", "search"),
    month = input("month", "month", dateNow().slice(0, 7)),
    account = select("filter-account", [
      ["", "Tous les comptes"],
      ...state.accounts.map((a) => [a.id, a.name]),
    ]);
  search.placeholder = "Rechercher";
  search.setAttribute("aria-label", "Rechercher une transaction");
  month.setAttribute("aria-label", "Mois");
  account.setAttribute("aria-label", "Filtrer par compte");
  const actions = node("div", null, "actions");
  actions.append(button("Importer un CSV", csvEditor));
  filters.append(search, month, account, actions);
  root.append(filters);
  const wrapper = node("div", null, "table-wrap ledger"),
    table = node("table"),
    thead = node("thead"),
    header = node("tr");
  for (const t of ["Date", "Description", "Catégorie · compte", "Montant", ""])
    header.append(node("th", t, t === "Montant" ? "amount" : ""));
  thead.append(header);
  const tbody = node("tbody");
  table.append(thead, tbody);
  const foot = node("div", null, "table-foot");
  wrapper.append(table, foot);
  root.append(wrapper);
  const draw = () => {
    tbody.replaceChildren();
    const list = [
      ...state.transactions.map((t) => ({ ...t, kind: "transaction" })),
      ...state.transfers.map((t) => ({
        id: t.id,
        kind: "transfer",
        seq: t.seq,
        date: t.date,
        description: t.description,
        amount_cents: -t.amount_cents,
        account_id: t.from_account_id,
        to_account_id: t.to_account_id,
      })),
    ]
      .filter(
        (t) =>
          (!month.value || t.date.startsWith(month.value)) &&
          (!account.value ||
            String(t.account_id) === account.value ||
            String(t.to_account_id) === account.value) &&
          t.description
            .toLocaleLowerCase("fr-CA")
            .includes(search.value.toLocaleLowerCase("fr-CA")),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq);
    for (const t of list) {
      const row = node("tr"),
        desc = node("td", t.description, "description"),
        classification = node("td", null, "classification");
      classification.append(
        node(
          "span",
          t.kind === "transfer"
            ? "Virement"
            : state.categories.find((c) => c.id === t.category_id)?.name ||
                "Sans catégorie",
        ),
        node(
          "small",
          (state.accounts.find((a) => a.id === t.account_id)?.name || "") +
            (t.kind === "transfer"
              ? " → " +
                state.accounts.find((a) => a.id === t.to_account_id)?.name
              : ""),
        ),
      );
      const edit = node("td", null, "edit");
      if (t.kind === "transaction")
        edit.append(
          button("Modifier", () => transactionEditor(t), "text-button"),
        );
      row.append(
        node("td", shortDate(t.date), "date"),
        desc,
        classification,
        node("td", money(t.amount_cents), "amount money"),
        edit,
      );
      tbody.append(row);
    }
    const real = list.filter((t) => t.kind === "transaction"),
      income = real
        .filter((t) => t.amount_cents > 0)
        .reduce((s, t) => s + t.amount_cents, 0),
      expense = -real
        .filter((t) => t.amount_cents < 0)
        .reduce((s, t) => s + t.amount_cents, 0);
    foot.replaceChildren(
      node("span", list.length + " opérations"),
      node(
        "span",
        "Entrées " +
          money(income) +
          " · Sorties " +
          money(expense) +
          " · Net " +
          money(income - expense),
      ),
    );
    if (!list.length) {
      const row = node("tr"),
        td = node("td", "Aucune opération pour ces filtres.", "empty");
      td.colSpan = 5;
      row.append(td);
      tbody.append(row);
    }
  };
  search.oninput = draw;
  month.onchange = draw;
  account.onchange = draw;
  draw();
  return root;
}
function categoryEditor(c) {
  const name = required(input("name", "text", c?.name || "")),
    amount = amountField(
      "limit",
      c?.limit_cents !== null && c?.limit_cents !== undefined
        ? c.limit_cents / 100
        : "",
    ),
    period = select(
      "period",
      [
        ["weekly", "Par semaine"],
        ["monthly", "Par mois"],
      ],
      c?.period || "weekly",
    ),
    day = select("renewal_day", []),
    start = input("starts_on", "date", c?.starts_on || dateNow());
  amount.min = "0";
  const update = () => {
    day.replaceChildren(
      ...(period.value === "weekly"
        ? [
            "Dimanche",
            "Lundi",
            "Mardi",
            "Mercredi",
            "Jeudi",
            "Vendredi",
            "Samedi",
          ].map((s, i) => new Option(s, i))
        : Array.from(
            { length: 31 },
            (_, i) =>
              new Option(
                i === 30 ? "Dernier jour du mois" : "Le " + (i + 1),
                i + 1,
              ),
          )),
    );
    day.value = c?.renewal_day ?? (period.value === "weekly" ? 4 : 1);
  };
  period.onchange = update;
  update();
  modal(
    c ? "Modifier " + c.name : "Une limite de dépense",
    [
      field("Catégorie", name),
      field("Montant par période", amount),
      field("Période", period),
      field("Renouvellement", day),
      field("À partir du", start),
      node(
        "p",
        "Le restant et les prochaines périodes sont protégés automatiquement, sans transfert d’argent.",
        "muted",
      ),
    ],
    () =>
      send("/api/category", {
        id: c?.id,
        name: name.value,
        limit: amount.value,
        period: period.value,
        renewal_day: day.value,
        starts_on: start.value,
      }),
  );
}
function ruleEditor(r, kind = "expense") {
  const name = required(input("name", "text", r?.name || "")),
    amount = amountField("amount", r ? r.amount_cents / 100 : ""),
    frequency = frequencies(r?.frequency),
    start = required(
      input("start_on", "date", r?.start_on || addDays(dateNow(), 1)),
    ),
    account = accounts(r?.account_id),
    type = select(
      "kind",
      [
        ["income", "Paie / revenu"],
        ["expense", "Facture fixe"],
        ["transfer", "Paiement / virement"],
      ],
      r?.kind || kind,
    ),
    destination = select(
      "to_account_id",
      state.accounts.map((a) => [a.id, a.name]),
      r?.to_account_id || state.accounts.find((a) => a.kind === "card")?.id,
    ),
    destLabel = field("Vers", destination);
  const startLabel = field("Prochaine date / début", start),
    calendar = calendarFields(
      frequency,
      start,
      startLabel,
      r || { kind: type.value },
    );
  type.onchange = () => {
    destLabel.hidden = type.value !== "transfer";
    if (!r) {
      calendar.adjustment.value = type.value === "income" ? "before" : "after";
      calendar.adjustment.dispatchEvent(new Event("change"));
    }
  };
  type.onchange();
  modal(
    r ? "Modifier " + r.name : "Une nouvelle récurrence",
    [
      field("Type", type),
      field("Nom", name),
      field("Montant", amount),
      field("Compte", account),
      destLabel,
      field("Fréquence", frequency),
      startLabel,
      calendar.container,
    ],
    () =>
      send("/api/recurrence", {
        ...r,
        id: r?.id,
        name: name.value,
        kind: type.value,
        amount: amount.value,
        account_id: account.value,
        to_account_id: destination.value,
        frequency: frequency.value,
        day_adjust: calendar.adjustment.value,
        start_on: start.value,
        active: r?.active !== 0,
      }),
  );
}
function planView() {
  const root = node("div"),
    heading = node("div", null, "page-heading");
  heading.append(node("h1", "Votre plan"));
  root.append(heading);
  const grid = node("div", null, "plan-grid");
  root.append(grid);
  grid.append(categoryReport(), scheduleView());
  for (const [label, kind] of [
    ["Paies et revenus", "income"],
    ["Factures et paiements", "expense"],
  ]) {
    const host = panel(
      label,
      button("+ Ajouter", () => ruleEditor(null, kind), "text-button"),
    );
    for (const r of state.recurrences.filter((r) =>
      kind === "income" ? r.kind === "income" : r.kind !== "income",
    )) {
      const row = node("div", null, "rule"),
        left = node("div"),
        right = node("div");
      left.append(
        node("h3", r.name),
        node(
          "small",
          (r.active ? "" : "En pause · ") +
            ({
              weekly: "Chaque semaine",
              biweekly: "Aux deux semaines",
              monthly: "Chaque mois",
              quarterly: "Aux trois mois",
              semiannual: "Aux six mois",
              yearly: "Chaque année",
              last_day: "Dernier jour du mois",
              last_business_day: "Dernier jour ouvrable du mois",
              rrq: "RRQ (dates à confirmer)",
            }[r.frequency] || r.frequency) +
            (r.day_adjust === "before"
              ? " · jour ouvrable précédent"
              : r.day_adjust === "after"
                ? " · jour ouvrable suivant"
                : ""),
        ),
      );
      const next = state.simulation.daily
        .flatMap((d) => d.events)
        .find((e) => e.rule_id === r.id);
      if (next)
        left.append(node("small", scheduleDate(next), "calendar-preview-date"));
      right.append(
        node("strong", money(r.amount_cents), "money"),
        button("Modifier", () => ruleEditor(r), "text-button"),
        button(
          r.active ? "Pause" : "Activer",
          () =>
            send("/api/recurrence", {
              ...r,
              amount: r.amount_cents / 100,
              active: !r.active,
            }),
          "text-button",
        ),
      );
      row.append(left, right);
      host.append(row);
    }
    if (host.children.length === 1)
      host.append(node("p", "Aucune récurrence.", "empty"));
    grid.append(host);
  }
  const limits = panel(
    "Limites variables",
    button("+ Ajouter", () => categoryEditor(), "text-button"),
  );
  for (const c of state.categories.filter((c) => c.limit_cents !== null)) {
    const row = node("div", null, "rule"),
      text = node("div");
    text.append(
      node("h3", c.name),
      node(
        "small",
        money(c.limit_cents) +
          (c.period === "weekly" ? " / semaine" : " / mois"),
      ),
    );
    row.append(
      text,
      button(
        c.active ? "Modifier" : "En pause",
        () => categoryEditor(c),
        "text-button",
      ),
      button(
        c.active ? "Pause" : "Activer",
        () =>
          send("/api/category", {
            ...c,
            limit: c.limit_cents / 100,
            active: !c.active,
          }),
        "text-button",
      ),
    );
    limits.append(row);
  }
  grid.append(limits);
  const means = panel(
    "Moyens de paiement",
    button(
      "+ Compte / carte",
      () => {
        const name = required(input("name")),
          kind = select("account_kind", [
            ["card", "Carte ou marge"],
            ["bank", "Compte bancaire / épargne"],
          ]);
        modal(
          "Ajouter un compte ou une carte",
          [
            field("Nom", name),
            field("Type de compte", kind),
            node(
              "p",
              "Aucun solde de dette à gérer. Les nouveaux achats restent protégés jusqu’au paiement.",
              "muted",
            ),
          ],
          () => send("/api/account", { name: name.value, kind: kind.value }),
        );
      },
      "text-button",
    ),
  );
  for (const a of state.accounts) {
    const row = node("div", null, "rule");
    row.append(
      node("h3", a.name),
      node(
        "small",
        a.kind === "bank"
          ? a.is_main
            ? "Compte principal"
            : "Compte bancaire"
          : "Sans suivi du solde",
      ),
    );
    if (a.kind === "bank") {
      row.append(
        node(
          "strong",
          money(
            state.account_balances?.find((b) => b.id === a.id)?.balance_cents,
          ),
        ),
        button("Saisir le solde", () => secondaryBalance(a), "text-button"),
      );
    }
    means.append(row);
  }
  grid.append(means);
  const settings = node("details", null, "panel settings");
  settings.append(node("summary", "Réglages et sauvegardes"));
  const content = node("div");
  settings.append(content);
  const appearance = node("div", null, "settings-card");
  appearance.append(
    node("h3", "Laine et sapin"),
    node(
      "p",
      "Fond crème en mode clair. Le mode sombre suit automatiquement le réglage de votre appareil.",
    ),
  );
  content.append(appearance);
  const backups = node("div", null, "settings-card");
  backups.append(
    node("h3", "Vos données"),
    node(
      "p",
      "Une copie SQLite quotidienne est conservée sur cet appareil. Gardez aussi un export hors du Chromebook.",
    ),
  );
  const actions = node("div", null, "actions"),
    download = node("a", "Exporter une sauvegarde", "button-link");
  download.href = "/api/export";
  download.download = "";
  actions.append(
    download,
    button("Restaurer", restoreEditor),
    button("Reprendre Sillage", sillageEditor),
    button("Vérifier mon solde", checkpoint),
  );
  actions.append(
    button("Réinitialiser l’essai", () => {
      const confirm = required(input("confirm"));
      confirm.placeholder = "EFFACER";
      modal(
        "Réinitialiser Le bas de laine",
        [
          node(
            "p",
            "Les données de cette application seront effacées après sauvegarde. Sillage et ses données restent intacts.",
            "warning",
          ),
          field("Écrivez EFFACER", confirm),
        ],
        async () => {
          step = 0;
          await send(
            "/api/reset",
            { confirm: confirm.value },
            "L’essai a été réinitialisé. Sillage n’a pas changé.",
          );
        },
      );
    }),
  );
  backups.append(actions);
  content.append(backups);
  const access = node("div", null, "settings-card");
  access.append(
    node("h3", "Accès iPhone"),
    node(
      "p",
      "Le lien de lecture permet de consulter le disponible et les limites. L’accès privé se configure avec le script Tailscale du dossier.",
    ),
  );
  const link = node("div", null, "stack");
  access.append(
    button(
      state.shared_enabled
        ? "Voir le lien de lecture"
        : "Créer un lien de lecture",
      async () => {
        try {
          let data = await request("/api/share");
          if (!data.path) {
            const s = await send(
              "/api/share",
              { action: "create" },
              "Lien créé",
            );
            data = s.result;
          }
          const url = (data.origin || location.origin) + data.path;
          link.replaceChildren(
            node("p", url),
            button("Copier le lien", () =>
              navigator.clipboard
                .writeText(url)
                .then(() => toast("Lien copié")),
            ),
            button("Révoquer ce lien", async () => {
              await send("/api/share", { action: "revoke" }, "Lien révoqué");
            }),
          );
        } catch (e) {
          toast(e.message);
        }
      },
    ),
    link,
  );
  content.append(access);
  const preview = node("a", "Voir les maquettes initiales", "text-button");
  preview.href = "/maquettes";
  preview.target = "_blank";
  preview.rel = "noopener";
  content.append(preview);
  grid.append(settings);
  return root;
}
function sillageEditor() {
  const file = required(input("file", "file"));
  file.accept = ".json,application/json";
  const reference = input("reference", "date", dateNow()),
    summary = node("div"),
    intro = node(
      "p",
      "Importez une sauvegarde JSON complète de Sillage. Vos données Sillage restent intactes. Commencez dans cette nouvelle application vide.",
      "muted",
    );
  let backup, preview;
  file.onchange = () => {
    backup = null;
    preview = null;
    summary.replaceChildren();
    $("#editor-save").textContent = "Vérifier l’import";
  };
  reference.onchange = () => (preview = null);
  modal(
    "Reprendre votre budget Sillage",
    [
      intro,
      field("Sauvegarde JSON", file),
      field("Date de référence", reference),
      summary,
    ],
    async () => {
      if (!backup) {
        if (!file.files[0]) throw Error("Choisissez le fichier.");
        if (file.files[0].size > 8e6) throw Error("Sauvegarde limitée à 8 Mo.");
        backup = JSON.parse(await file.files[0].text());
      }
      if (!preview) {
        preview = await request("/api/import/preview", {
          backup,
          reference: reference.value,
        });
        summary.replaceChildren();
        const counts = node("div", null, "import-summary");
        for (const [table, c] of Object.entries(preview.counts))
          counts.append(
            node(
              "p",
              {
                accounts: "Comptes",
                categories: "Catégories",
                transactions: "Transactions",
                transfers: "Virements",
                recurrences: "Récurrences",
              }[table] +
                ": " +
                c.new +
                " nouveaux · " +
                c.updated +
                " modifiés",
            ),
          );
        summary.append(counts);
        for (const w of preview.warnings)
          summary.append(node("p", w.message, "warning"));
        for (const c of preview.conflicts)
          summary.append(node("p", c.message, "error"));
        $("#editor-save").textContent = preview.conflicts.length
          ? "Import bloqué"
          : "Importer dans Le bas de laine";
        return false;
      }
      if (preview.conflicts.length)
        throw Error("Les conflits doivent être résolus avant l’import.");
      await send(
        "/api/import/apply",
        { backup, reference: reference.value, token: preview.token },
        "Import terminé. Comparez les chiffres avant toute bascule.",
      );
    },
    "Vérifier l’import",
  );
}
function restoreEditor() {
  const file = required(input("file", "file"));
  file.accept = ".json";
  const confirmation = required(input("confirmation"));
  confirmation.placeholder = "REMPLACER";
  modal(
    "Restaurer une sauvegarde",
    [
      field("Sauvegarde du Bas de laine", file),
      field("Écrivez REMPLACER pour continuer", confirmation),
      node(
        "p",
        "Une copie du budget actuel sera conservée avant son remplacement.",
        "muted",
      ),
    ],
    async () => {
      const backup = JSON.parse(await file.files[0].text());
      await send("/api/restore", { backup, confirm: confirmation.value });
    },
  );
}
function csvEditor() {
  const file = required(input("csv", "file"));
  file.accept = ".csv,text/csv";
  const account = accounts(),
    category = categories(),
    mode = select("included", [
      ["true", "Déjà dans le solde bancaire"],
      ["false", "Opérations à appliquer au solde"],
    ]),
    format = select("date_format", [
      ["ISO", "AAAA-MM-JJ"],
      ["DMY", "JJ/MM/AAAA"],
    ]),
    cardStatus = select("card_settled", [
      ["false", "Achats encore à payer"],
      ["true", "Historique déjà payé"],
    ]),
    cardLabel = field("Pour cette carte", cardStatus),
    previewHost = node("div", null, "csv-preview"),
    mappingHost = node("div");
  let text,
    preview,
    mapping,
    choices = [];
  const invalidate = () => {
    preview = null;
    previewHost.replaceChildren();
    $("#editor-save").textContent = "Voir l’aperçu";
  };
  file.onchange = () => {
    text = null;
    mapping = null;
    mappingHost.replaceChildren();
    invalidate();
  };
  account.onchange = () => {
    cardLabel.hidden =
      state.accounts.find((a) => String(a.id) === account.value)?.kind !==
      "card";
    invalidate();
  };
  account.onchange();
  for (const el of [category, mode, format, cardStatus])
    el.onchange = invalidate;
  modal(
    "Importer des transactions",
    [
      field("Fichier CSV", file),
      field("Compte", account),
      field("Effet bancaire", mode),
      cardLabel,
      field("Catégorie", category),
      field("Format des dates", format),
      mappingHost,
      previewHost,
    ],
    async () => {
      const options = {
        account_id: Number(account.value),
        category_id: category.value,
        included: mode.value === "true",
        card_settled: cardStatus.value === "true",
        date_format: format.value,
        ...(mapping ? { mapping } : {}),
      };
      if (!text) {
        if (!file.files[0]) throw Error("Choisissez le CSV.");
        text = await file.files[0].text();
      }
      if (!preview) {
        preview = await request("/api/csv/preview", { csv: text, options });
        previewHost.replaceChildren();
        mapping = preview.mapping;
        if (preview.needs_mapping) {
          mappingHost.replaceChildren();
          for (const [key, label] of [
            ["date", "Colonne Date"],
            ["description", "Colonne Description"],
            ["amount", "Colonne Montant"],
          ]) {
            const col = select(
              key,
              preview.headers.map((h, i) => [i, h]),
              Math.max(0, mapping[key]),
            );
            mapping[key] = +col.value;
            col.onchange = () => {
              mapping[key] = +col.value;
              invalidate();
            };
            mappingHost.append(field(label, col));
          }
          preview = null;
          throw Error("Choisissez les trois colonnes, puis relancez l’aperçu.");
        }
        choices = [];
        for (const row of preview.rows) {
          const line = node("div", null, "csv-row");
          if (row.error) {
            line.append(
              node("p", "Ligne " + (row.row + 2) + " : " + row.error, "error"),
            );
            previewHost.append(line);
            continue;
          }
          const check = input("selected", "checkbox");
          check.checked = !row.duplicate;
          check.disabled = !!row.duplicate;
          const label = node("label", null, "check");
          label.append(
            check,
            node("span", shortDate(row.date) + " · " + row.description),
            node("strong", money(row.amount_cents), "money"),
          );
          line.append(label);
          const match = select("match", [
            ["", "Choisir…"],
            ["new", "Nouvelle opération"],
            ...row.matches.map((m, i) => [
              String(i),
              m.name + " · marquer payée",
            ]),
          ]);
          if (row.matches.length) {
            line.append(field("Échéance possible", match));
          } else match.value = "new";
          if (row.duplicate)
            line.append(node("small", "Déjà présent : ligne ignorée."));
          choices.push({ row, check, match });
          previewHost.append(line);
        }
        $("#editor-save").textContent = "Importer les lignes choisies";
        return false;
      }
      const selected = choices
        .filter((c) => c.check.checked)
        .map((c) => {
          if (c.row.matches.length && c.match.value === "")
            throw Error(
              "Choisissez la facture ou « Nouvelle opération » pour les suggestions.",
            );
          return {
            row: c.row.row,
            ...(c.match.value !== "new"
              ? { occurrence: c.row.matches[+c.match.value] }
              : {}),
          };
        });
      if (!selected.length)
        throw Error("Aucune nouvelle ligne sélectionnée à importer.");
      await send(
        "/api/csv/apply",
        { csv: text, options, selected, token: preview.token },
        "Transactions importées",
      );
    },
    "Voir l’aperçu",
  );
}
function setupView() {
  const root = node("div", null, "setup");
  root.append(
    node("p", "Le bas de laine", "eyebrow"),
    node("h1", "Un budget plus léger."),
    node("p", "Quatre étapes. Vos montants, vos prochaines dates.", "muted"),
  );
  const steps = node("div", null, "setup-steps");
  for (let i = 0; i < 4; i++)
    steps.append(node("span", null, i <= step ? "done" : ""));
  root.append(steps);
  const box = panel(
      [
        "Votre point de départ",
        "Vos prochaines paies",
        "Vos factures fixes",
        "Vos limites variables",
      ][step],
    ),
    form = node("form"),
    body = node("div", null, "form-stack");
  form.append(body);
  box.append(form);
  root.append(box);
  const error = node("p", null, "error");
  error.setAttribute("role", "alert");
  let capture = () => {};
  if (step === 0) {
    const name = required(input("account_name", "text", wizard.account_name)),
      balance = amountField("balance", wizard.balance);
    body.append(
      field("Nom du compte principal", name),
      field("Son solde réel aujourd’hui", balance),
      node(
        "p",
        "Les transactions déjà comprises dans ce solde ne seront pas débitées à nouveau.",
        "muted",
      ),
    );
    capture = () => {
      wizard.account_name = name.value;
      wizard.balance = balance.value;
    };
  }
  if (step === 1 || step === 2) {
    const isPay = step === 1,
      list = isPay ? wizard.paychecks : wizard.bills;
    if (isPay && !list.length)
      list.push({
        name: "Paie",
        amount: "",
        frequency: "biweekly",
        start_on: addDays(dateNow(), 7),
      });
    const holder = node("div", null, "setup-list"),
      fields = [];
    const add = (
      item = {
        name: "",
        amount: "",
        frequency: "monthly",
        start_on: addDays(dateNow(), 1),
      },
    ) => {
      const card = node("div", null, "setup-item"),
        name = required(input("name", "text", item.name)),
        amount = amountField("amount", item.amount),
        freq = frequencies(item.frequency),
        start = required(input("start_on", "date", item.start_on));
      start.min = dateNow();
      const group = node("div", null, "two-fields");
      group.append(field("Montant", amount), field("Fréquence", freq));
      card.append(
        field(isPay ? "Nom de la paie" : "Nom de la facture", name),
        group,
        field(
          isPay ? "Prochaine paie à recevoir" : "Prochaine échéance",
          start,
        ),
      );
      const startLabel = card.lastElementChild,
        calendar = calendarFields(
          freq,
          start,
          startLabel,
          { ...item, kind: isPay ? "income" : "expense" },
          true,
        );
      card.append(calendar.container);
      const rec = { card, name, amount, freq, start, calendar };
      fields.push(rec);
      card.append(
        button(
          "Retirer",
          () => {
            fields.splice(fields.indexOf(rec), 1);
            card.remove();
          },
          "text-button",
        ),
      );
      holder.append(card);
    };
    for (const item of list) add(item);
    body.append(
      node(
        "p",
        isPay
          ? "Ajoutez chaque source de revenu, même si les fréquences diffèrent."
          : "Seulement les dépenses fixes. L’épicerie et l’essence iront dans les limites.",
        "muted",
      ),
      holder,
      button(isPay ? "+ Une autre paie" : "+ Une facture", () => add()),
    );
    capture = () => {
      const data = fields.map((f) => ({
        name: f.name.value,
        amount: f.amount.value,
        frequency: f.freq.value,
        day_adjust: f.calendar.adjustment.value,
        start_on: f.start.value,
      }));
      if (isPay && !data.length) throw Error("Ajoutez une prochaine paie.");
      wizard[isPay ? "paychecks" : "bills"] = data;
    };
  }
  if (step === 3) {
    const presets = wizard.categories.length
        ? wizard.categories
        : [
            {
              name: "Épicerie",
              limit: "230",
              period: "weekly",
              renewal_day: 4,
            },
            { name: "Essence", limit: "60", period: "weekly", renewal_day: 2 },
            { name: "Autres", limit: "50", period: "monthly", renewal_day: 1 },
            {
              name: "Restaurant",
              limit: "125",
              period: "monthly",
              renewal_day: 1,
            },
          ],
      fields = [];
    body.append(
      node(
        "p",
        "Exemples à ajuster. « Autres », 50 $ par mois, protège les achats sans limite propre; les factures associées sont exclues. Décochez une catégorie pour ne pas lui fixer de limite.",
        "muted",
      ),
    );
    for (const c of presets) {
      const item = node("div", null, "setup-item"),
        check = input("enabled", "checkbox");
      check.checked = true;
      const label = node("label", null, "check");
      label.append(check, node("span", c.name));
      const amount = amountField("limit", c.limit),
        period = select(
          "period",
          [
            ["weekly", "Par semaine"],
            ["monthly", "Par mois"],
          ],
          c.period,
        ),
        day = select("renewal_day", []),
        update = () => {
          day.replaceChildren(
            ...(period.value === "weekly"
              ? [
                  "Dimanche",
                  "Lundi",
                  "Mardi",
                  "Mercredi",
                  "Jeudi",
                  "Vendredi",
                  "Samedi",
                ].map((s, i) => new Option(s, i))
              : Array.from(
                  { length: 31 },
                  (_, i) =>
                    new Option(
                      i === 30 ? "Dernier jour du mois" : "Le " + (i + 1),
                      i + 1,
                    ),
                )),
          );
          day.value =
            period.value === c.period
              ? c.renewal_day
              : period.value === "weekly"
                ? 4
                : 1;
        };
      period.onchange = update;
      update();
      const group = node("div", null, "two-fields");
      group.append(field("Montant", amount), field("Période", period));
      item.append(label, group, field("Renouvellement", day));
      check.onchange = () => {
        amount.disabled = period.disabled = day.disabled = !check.checked;
      };
      body.append(item);
      fields.push({ c, check, amount, period, day });
    }
    capture = () => {
      wizard.categories = fields
        .filter((f) => f.check.checked)
        .map((f) => ({
          name: f.c.name,
          limit: f.amount.value,
          period: f.period.value,
          renewal_day: +f.day.value,
          starts_on: dateNow(),
        }));
    };
  }
  const nav = node("div", null, "setup-nav");
  nav.append(
    button(step ? "Retour" : "Reprendre Sillage", () => {
      if (!step) {
        sillageEditor();
        return;
      }
      try {
        capture();
        step--;
        setupView();
      } catch (e) {
        error.textContent = e.message;
      }
    }),
  );
  const next = node(
    "button",
    step === 3 ? "Voir mon disponible" : "Continuer",
    "primary",
  );
  next.type = "submit";
  nav.append(next);
  form.append(error, nav);
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      capture();
      if (step < 3) {
        step++;
        setupView();
      } else {
        next.disabled = true;
        const chosen = new Set(wizard.categories.map((c) => c.name));
        await send(
          "/api/setup",
          {
            ...wizard,
            categories: [
              ...wizard.categories,
              ...["Maison", "Santé", "Autres", "Revenus", "Factures"]
                .filter((name) => !chosen.has(name))
                .map((name) => ({ name })),
            ],
          },
          "Votre budget est prêt",
        );
      }
    } catch (e) {
      error.textContent = e.message;
      next.disabled = false;
    }
  };
  const mock = node("p", null, "setup-import"),
    link = node("a", "Comparer les trois maquettes");
  link.href = "/maquettes";
  link.target = "_blank";
  link.rel = "noopener";
  mock.append(
    link,
    document.createElement("br"),
    button(
      "Restaurer une sauvegarde du Bas de laine",
      restoreEditor,
      "text-button",
    ),
  );
  root.append(mock);
  $("#main").replaceChildren(root);
}
window.addEventListener("focus", () => {
  if (!editor.open) refresh();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !editor.open) refresh();
});
matchMedia("(prefers-color-scheme:dark)").addEventListener("change", theme);
setInterval(() => {
  if (!document.hidden && !editor.open && (state?.configured || shared))
    refresh();
}, 60000);
window.addEventListener("hashchange", () => {
  if (state) navigate(location.hash.slice(1));
});
await refresh();

function scheduleDate(e) {
  const fmt = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  return e.nominal_on && e.nominal_on !== e.date
    ? fmt(e.nominal_on) + " → " + fmt(e.date)
    : fmt(e.date);
}
function secondaryBalance(a) {
  const amount = amountField(
    "balance",
    (state.account_balances?.find((b) => b.id === a.id)?.balance_cents || 0) /
      100,
  );
  modal(
    "Solde · " + a.name,
    [
      field("Solde réel", amount),
      node(
        "p",
        "Seul le compte principal alimente le disponible à dépenser. L’épargne reste à part.",
      ),
    ],
    () => send("/api/checkpoint", { account_id: a.id, amount: amount.value }),
  );
}
function purchaseEditor() {
  const amount = amountField("amount"),
    date = required(input("date", "date", dateNow())),
    account = select(
      "account_id",
      state.accounts
        .filter((a) => a.is_main || a.kind === "card")
        .map((a) => [a.id, a.name]),
    ),
    category = select("category_id", [
      ["", "Sans catégorie"],
      ...state.categories.filter((c) => c.active).map((c) => [c.id, c.name]),
    ]),
    result = node("div", null, "purchase-result");
  date.min = dateNow();
  date.max = addDays(dateNow(), 60);
  for (const el of [amount, date, account, category]) {
    el.addEventListener("input", () => result.replaceChildren());
    el.addEventListener("change", () => result.replaceChildren());
  }
  modal(
    "Puis-je faire cet achat ?",
    [
      field("Montant", amount),
      field("Date de l’achat", date),
      field("Moyen de paiement", account),
      field("Catégorie (si prévue dans une limite)", category),
      result,
    ],
    async () => {
      const r = await request("/api/purchase/preview", {
        amount: amount.value,
        date: date.value,
        account_id: account.value,
        category_id: category.value,
      });
      result.replaceChildren(
        node(
          "h2",
          r.provisional ? "À vérifier" : r.allowed ? "Oui" : "Non",
          r.allowed ? "positive" : "negative",
        ),
        node(
          "p",
          "Minimum après achat : " +
            money(r.minimum_cents) +
            " · " +
            shortDate(r.minimum_on),
        ),
        node(
          "p",
          "Maximum : " +
            money(r.maximum_cents) +
            " · " +
            r.days +
            " jours vérifiés",
        ),
        node("small", "Simulation seulement. Aucune transaction enregistrée."),
      );
      return false;
    },
    "Vérifier",
  );
}
function categoryReport() {
  const host = node("details", null, "panel category-report");
  host.append(node("summary", "Bilan par catégorie"));
  const month = input("report_month", "month", dateNow().slice(0, 7)),
    table = node("div", null, "report-table");
  host.append(field("Mois", month), table);
  const render = () => {
    table.replaceChildren();
    let total = 0;
    for (const c of [
      ...state.categories,
      { id: null, name: "Sans catégorie" },
    ]) {
      const rows = state.transactions.filter(
        (t) =>
          t.date.startsWith(month.value) &&
          t.category_id === c.id &&
          t.amount_cents < 0,
      );
      const spent = -rows.reduce((n, t) => n + t.amount_cents, 0);
      if (!spent) continue;
      total += spent;
      const row = node("div", null, "daily-row");
      row.append(node("span", c.name), node("strong", money(spent)));
      table.append(row);
    }
    const sum = node("div", null, "daily-row");
    sum.append(
      node("strong", "Total des achats"),
      node("strong", money(total)),
    );
    table.append(sum);
  };
  month.onchange = render;
  render();
  return host;
}
function scheduleView() {
  const host = node("details", null, "panel schedule");
  host.append(node("summary", "Calendrier des échéances"));
  const month = input("schedule_month", "month", dateNow().slice(0, 7)),
    list = node("div");
  host.append(
    field("Mois", month),
    node(
      "small",
      "Échéances ouvertes dans les 90 jours de prévision. Les reports utilisent leur date choisie.",
    ),
    list,
  );
  const render = () => {
    list.replaceChildren();
    const events = state.simulation.daily
      .flatMap((d) => d.events)
      .filter((e) => e.date.startsWith(month.value));
    for (const e of events) {
      const row = node("div", null, "schedule-row");
      row.append(
        node("strong", scheduleDate(e)),
        node("span", e.name),
        node("span", money(e.amount_cents)),
      );
      row.append(
        button(
          e.kind === "income" ? "Reçue" : "Payée",
          () => occurrenceAction(e, "pay"),
          "text-button",
        ),
        button(
          "Reporter",
          () => occurrenceAction(e, "postpone"),
          "text-button",
        ),
      );
      list.append(row);
    }
    if (!events.length)
      list.append(
        node("p", "Aucune échéance ouverte dans ce mois de la prévision."),
      );
  };
  month.onchange = render;
  render();
  return host;
}
