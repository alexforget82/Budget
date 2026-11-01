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
  setupHelpVisible = true,
  transactionFilters = { search: "", month: null, account: "", category: "" },
  calendarChoice = { mode: "month", month: null, selected: null, open: false },
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
      ["rrq", "RRQ (calendrier de versement)"],
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
            (d.shifted
              ? format(d.nominal) + " → " + format(d.date)
              : format(d.date)) +
              (frequency.value === "rrq"
                ? d.estimated
                  ? " · estimation"
                  : " · date fournie"
                : ""),
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
    $("#main").replaceChildren(
      todayView(state.simulation, {
        shared: true,
        openPurchase: purchaseEditor,
        balanceVerifiedOn: state.balance_verified_on,
      }),
    );
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
          openTutorial: tutorialEditor,
          balanceVerifiedOn: state.balance_verified_on,
          backupInfo: state.backup_status,
          openOverdue: overdueEditor,
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
        { ...o, action: "pay", date: dateNow() },
        o.kind === "income" ? "Paie enregistrée" : "Paiement enregistré",
      );
      return;
    }
    if (action === "edit_amount") {
      const amount = amountField("amount", o.amount_cents / 100),
        base = state.recurrences.find((r) => r.id === o.rule_id)?.amount_cents;
      amount.min = ".01";
      const fields = [
        node("p", scheduleDate(o)),
        field("Montant prévu cette fois", amount),
        node(
          "p",
          "Prévision seulement : le montant habituel de la récurrence est conservé.",
          "muted",
        ),
      ];
      if (base !== undefined)
        fields.push(node("p", "Montant habituel : " + money(base), "muted"));
      if (
        state.occurrence_states.some(
          (s) =>
            s.rule_id === o.rule_id &&
            s.original_on === o.original_on &&
            s.amount_cents !== null,
        )
      )
        fields.push(
          button(
            "Revenir au montant habituel",
            () => {
              send(
                "/api/occurrence",
                { ...o, action: "reset_amount" },
                "Montant habituel rétabli",
              )
                .then(() => editor.close())
                .catch((e) => toast(e.message));
            },
            "text-button",
          ),
        );
      fields.push(
        button(
          o.kind === "income"
            ? "Saisir le revenu réel…"
            : "Saisir le paiement réel…",
          () => {
            editor.close();
            occurrenceAction(o, "amount");
          },
          "text-button",
        ),
      );
      modal("Modifier cette fois · " + o.name, fields, () =>
        send(
          "/api/occurrence",
          { ...o, action: "set_amount", amount: amount.value },
          "Montant modifié pour cette échéance",
        ),
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
        (o.kind === "income" ? "Encaisser " : "Payer ") + o.name,
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
function transferEditor(t) {
  const amount = amountField("amount", t.amount_cents / 100),
    description = required(input("description", "text", t.description)),
    date = required(input("date", "date", t.date)),
    from = accounts(t.from_account_id, true),
    to = accounts(t.to_account_id),
    included = input("included", "checkbox");
  date.max = dateNow();
  included.checked = !!t.included;
  const check = node("label", null, "check");
  check.append(included, node("span", "Déjà compris dans le solde bancaire"));
  const linked = state.occurrence_states.some((o) => o.transfer_id === t.id);
  from.disabled = to.disabled = linked;
  const content = [
    field("Description", description),
    field("Montant", amount),
    field("Date réelle", date),
    field("De", from),
    field("Vers", to),
    check,
  ];
  if (linked)
    content.push(
      node(
        "p",
        "Ce virement règle une échéance. Son montant et sa date restent modifiables; ses comptes sont conservés.",
        "muted",
      ),
    );
  const checkpoint = state.checkpoints.some(
    (c) =>
      c.seq >= t.seq &&
      [t.from_account_id, t.to_account_id].includes(c.account_id),
  );
  if (checkpoint)
    content.push(
      node(
        "p",
        "Un solde vérifié inclut déjà ce virement. Sa correction ne réécrit pas ce solde.",
        "muted",
      ),
    );
  content.push(
    button(
      "Supprimer ce virement",
      () => {
        modal(
          "Supprimer ce virement ?",
          [
            node(
              "p",
              t.description +
                " · " +
                money(t.amount_cents) +
                " · " +
                shortDate(t.date),
            ),
            node(
              "p",
              linked
                ? "L’échéance associée redeviendra à traiter. La prévision sera recalculée."
                : "Le virement sera retiré et la prévision recalculée. Les soldes déjà vérifiés restent inchangés.",
              "muted",
            ),
          ],
          () =>
            send(
              "/api/transfer",
              { id: t.id, action: "delete" },
              "Virement supprimé",
            ),
          "Supprimer",
        );
      },
      "text-button negative",
    ),
  );
  modal("Modifier le virement", content, () =>
    send("/api/transfer", {
      id: t.id,
      amount: amount.value,
      description: description.value,
      date: date.value,
      from_account_id: from.value,
      to_account_id: to.value,
      included: included.checked,
    }),
  );
}
function transactionsView() {
  const root = node("div"),
    heading = node("div", null, "page-heading");
  heading.append(node("h1", "Transactions"));
  root.append(heading);
  const filters = node("div", null, "filters"),
    search = input("search", "search", transactionFilters.search),
    month = input(
      "month",
      "month",
      transactionFilters.month ?? dateNow().slice(0, 7),
    ),
    account = select(
      "filter-account",
      [["", "Tous les comptes"], ...state.accounts.map((a) => [a.id, a.name])],
      transactionFilters.account,
    ),
    category = select(
      "filter-category",
      [
        ["", "Toutes les catégories"],
        ["none", "Sans catégorie"],
        ["transfers", "Virements seulement"],
        ...state.categories.map((c) => [c.id, c.name]),
      ],
      transactionFilters.category,
    );
  search.placeholder = "Description, catégorie ou compte";
  search.setAttribute("aria-label", "Rechercher une transaction");
  month.setAttribute("aria-label", "Mois");
  account.setAttribute("aria-label", "Filtrer par compte");
  category.setAttribute("aria-label", "Filtrer par catégorie");
  const actions = node("div", null, "actions");
  actions.append(button("Importer un CSV", csvEditor));
  filters.append(search, month, account, category, actions);
  root.append(filters);
  const wrapper = node("div", null, "table-wrap ledger"),
    table = node("table"),
    thead = node("thead"),
    header = node("tr");
  for (const title of [
    "Date",
    "Description",
    "Catégorie · compte",
    "Montant",
    "",
  ])
    header.append(node("th", title, title === "Montant" ? "amount" : ""));
  thead.append(header);
  const tbody = node("tbody");
  table.append(thead, tbody);
  const foot = node("div", null, "table-foot");
  foot.setAttribute("aria-live", "polite");
  wrapper.append(table, foot);
  root.append(wrapper);
  const norm = (text) =>
    String(text || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("fr-CA")
      .trim();
  function draw() {
    transactionFilters = {
      search: search.value,
      month: month.value,
      account: account.value,
      category: category.value,
    };
    tbody.replaceChildren();
    const accountName = (id) =>
        state.accounts.find((a) => a.id === id)?.name || "",
      categoryName = (t) =>
        t.kind === "transfer"
          ? "Virement"
          : state.categories.find((c) => c.id === t.category_id)?.name ||
            "Sans catégorie";
    const list = [
      ...state.transactions.map((t) => ({ ...t, kind: "transaction" })),
      ...state.transfers.map((t) => ({
        ...t,
        kind: "transfer",
        account_id: t.from_account_id,
        amount_cents:
          account.value && String(t.to_account_id) === account.value
            ? t.amount_cents
            : -t.amount_cents,
      })),
    ]
      .filter(
        (t) =>
          (!month.value || t.date.startsWith(month.value)) &&
          (!account.value ||
            String(t.account_id) === account.value ||
            String(t.to_account_id) === account.value) &&
          (!category.value ||
            (category.value === "transfers"
              ? t.kind === "transfer"
              : t.kind === "transaction" &&
                (category.value === "none"
                  ? !t.category_id
                  : String(t.category_id) === category.value))) &&
          norm(
            [
              t.description,
              categoryName(t),
              accountName(t.account_id),
              accountName(t.to_account_id),
            ].join(" "),
          ).includes(norm(search.value)),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq);
    for (const t of list) {
      const row = node("tr"),
        classification = node("td", null, "classification"),
        edit = node("td", null, "edit");
      classification.append(
        node("span", categoryName(t)),
        node(
          "small",
          accountName(t.account_id) +
            (t.kind === "transfer" ? " → " + accountName(t.to_account_id) : ""),
        ),
      );
      edit.append(
        button(
          "Modifier",
          () =>
            t.kind === "transfer"
              ? transferEditor(state.transfers.find((v) => v.id === t.id))
              : transactionEditor(t),
          "text-button",
        ),
      );
      row.append(
        node("td", shortDate(t.date), "date"),
        node("td", t.description, "description"),
        classification,
        node(
          "td",
          (t.kind === "transfer" ? "↔ " : "") + money(t.amount_cents),
          "amount money",
        ),
        edit,
      );
      tbody.append(row);
    }
    const real = list.filter((t) => t.kind === "transaction"),
      income = real
        .filter((t) => t.amount_cents > 0)
        .reduce((n, t) => n + t.amount_cents, 0),
      expense = -real
        .filter((t) => t.amount_cents < 0)
        .reduce((n, t) => n + t.amount_cents, 0),
      transfers = list
        .filter((t) => t.kind === "transfer")
        .reduce((n, t) => n + Math.abs(t.amount_cents), 0);
    foot.replaceChildren(
      node("span", list.length + " opération" + (list.length === 1 ? "" : "s")),
      node(
        "span",
        "Entrées " +
          money(income) +
          " · Sorties " +
          money(expense) +
          " · Net " +
          money(income - expense) +
          (transfers ? " · Virements (hors net) " + money(transfers) : ""),
      ),
    );
    if (!list.length) {
      const row = node("tr"),
        cell = node("td", "Aucune opération pour ces filtres.", "empty");
      cell.colSpan = 5;
      row.append(cell);
      tbody.append(row);
    }
  }
  search.oninput = draw;
  month.onchange = account.onchange = category.onchange = draw;
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
        "À la semaine, le restant se reporte jusqu’au premier renouvellement du nouveau mois. Le montant habituel revient alors sans report. Les allocations restent protégées automatiquement.",
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
      ...(r
        ? [
            node(
              "p",
              "Ce formulaire définit le montant habituel. Pour une exception, choisissez « Modifier cette fois » dans les opérations à venir ou le calendrier.",
              "muted",
            ),
          ]
        : []),
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
  heading.append(
    node("h1", "Votre plan"),
    button("Tutoriel", () => tutorialEditor(), "text-button"),
  );
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
              rrq: "RRQ (calendrier de versement)",
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
  limits.append(
    node(
      "p",
      "À la semaine : le restant se reporte dans le même mois. Au premier renouvellement du nouveau mois, les reports s’effacent et l’allocation reste entière.",
      "muted limit-rollover-help",
    ),
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
    node("h3", "Laine et fleur de lys"),
    node(
      "p",
      "Bleu québécois, crème et touches dorées. Le mode sombre suit automatiquement le réglage de votre appareil.",
    ),
  );
  content.append(appearance);
  const backups = node("div", null, "settings-card");
  backups.append(
    node("h3", "Vos données"),
    node(
      "p",
      state.backup_status?.error
        ? "Copie quotidienne à vérifier."
        : state.backup_status?.last_daily_at
          ? "Copie quotidienne locale : " +
            new Date(state.backup_status.last_daily_at).toLocaleString(
              "fr-CA",
              {
                timeZone: "America/Toronto",
                dateStyle: "medium",
                timeStyle: "short",
              },
            )
          : "Aucune copie quotidienne disponible.",
      "backup-date muted",
    ),
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
  steps.setAttribute("aria-label", "Étape " + (step + 1) + " sur 4");
  root.append(steps);
  const helpToggle = button(
    setupHelpVisible ? "Masquer l’aide" : "Afficher le tutoriel",
    () => {},
    "text-button",
  );
  // Toggle only the help card: rebuilding the form would discard unsaved inputs.
  helpToggle.onclick = () => {
    setupHelpVisible = !setupHelpVisible;
    help.hidden = !setupHelpVisible;
    helpToggle.textContent = setupHelpVisible
      ? "Masquer l’aide"
      : "Afficher le tutoriel";
  };
  const help = tutorialCard(step);
  help.hidden = !setupHelpVisible;
  root.append(helpToggle, help);
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
const tutorialSteps = [
  {
    title: "Partir du solde réel",
    text: "Ouvrez votre banque et entrez le solde actuel du compte qui paie les dépenses du ménage.",
    tip: "Ce solde inclut les opérations déjà passées. N’ajoutez pas le solde de vos cartes ou de votre épargne.",
    example: "Exemple : si le compte conjoint affiche 1 000 $, entrez 1 000 $.",
  },
  {
    title: "Inscrire les prochaines paies",
    text: "Ajoutez chaque source de revenu avec son montant, sa fréquence et la prochaine date à recevoir.",
    tip: "Vérifiez l’aperçu des dates : par défaut, une paie tombe au jour ouvrable précédent si sa date est un week-end ou un férié bancaire. Vous pouvez changer ce choix.",
    example:
      "Exemple : une paie toutes les deux semaines reste aux deux semaines; elle n’est pas transformée en moyenne mensuelle.",
  },
  {
    title: "Ajouter les factures fixes",
    text: "Inscrivez les factures à venir : montant, fréquence et prochaine échéance. Vous pouvez passer cette étape si vous n’en avez pas encore.",
    tip: "Ne mettez pas aussi une limite pour la même dépense. Pour un achat variable comme l’épicerie, utilisez plutôt l’étape suivante.",
    example:
      "Exemple : Internet, 65 $ par mois. Par défaut, une date non ouvrable est reportée au prochain jour ouvrable.",
  },
  {
    title: "Protéger les dépenses variables",
    text: "Choisissez un montant, une période et un jour de renouvellement pour chaque catégorie. Ajustez les exemples ou décochez ceux qui ne vous servent pas.",
    tip: "Le restant hebdomadaire se reporte jusqu’au premier renouvellement du nouveau mois. Les montants restants et les allocations à venir protègent le disponible, sans argent à déplacer.",
    example:
      "Exemple : Épicerie, 230 $ par semaine, renouvellement jeudi. Si une seule période de 230 $ est à protéger sur un solde de 1 000 $, le disponible est 770 $. Un achat de 71,69 $ couvert par cette limite laisse le même disponible.",
  },
  {
    title: "Utiliser le budget au quotidien",
    text: "Saisissez chaque achat une seule fois, avec sa catégorie et son moyen de paiement. Une facture peut être enregistrée avec Payée dans les échéances.",
    tip: "Ajoutez vos cartes et votre épargne dans Plan. Les achats sur carte restent protégés jusqu’au paiement. Vérifier mon solde permet de repartir du solde bancaire réel.",
    example:
      "Aujourd’hui : consultez le disponible ou testez un achat. Plan : modifiez les montants, consultez le calendrier et exportez une sauvegarde. Ce tutoriel reste accessible ici sans recommencer la configuration.",
  },
];
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
      (shared
        ? state.purchase_options.accounts
        : state.accounts.filter((a) => a.is_main || a.kind === "card")
      ).map((a) => [a.id, a.name]),
    ),
    category = select("category_id", [
      ["", "Sans catégorie"],
      ...(shared
        ? state.purchase_options.categories
        : state.categories.filter((c) => c.active)
      ).map((c) => [c.id, c.name]),
    ]),
    result = node("div", null, "purchase-result");
  date.min = dateNow();
  date.max = addDays(dateNow(), 60);
  let revision = 0;
  for (const el of [amount, date, account, category]) {
    el.addEventListener("input", () => {
      revision++;
      result.replaceChildren();
    });
    el.addEventListener("change", () => {
      revision++;
      result.replaceChildren();
    });
  }
  const options = node("details", null, "details-options");
  options.append(
    node("summary", "Options : date, carte ou limite"),
    field("Date de l’achat", date),
    field("Moyen de paiement", account),
    field("Catégorie (si prévue dans une limite)", category),
  );
  modal(
    "Puis-je faire cet achat ?",
    shared
      ? [field("Montant", amount), options, result]
      : [
          field("Montant", amount),
          field("Date de l’achat", date),
          field("Moyen de paiement", account),
          field("Catégorie (si prévue dans une limite)", category),
          result,
        ],
    async () => {
      const ticket = revision;
      const r = await request(
        shared ? shared[0] + "/purchase" : "/api/purchase/preview",
        {
          amount: amount.value,
          date: date.value,
          account_id: account.value,
          category_id: category.value,
        },
      );
      if (ticket !== revision) return false;
      result.replaceChildren(
        node(
          "h2",
          r.provisional ? "À vérifier" : r.allowed ? "Oui" : "Non",
          r.allowed ? "positive" : "negative",
        ),
        ...(shared
          ? []
          : [
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
            ]),
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
  const sim = state.simulation,
    days = new Map(sim.daily.map((d) => [d.date, d]));
  const firstMonth = sim.reference.slice(0, 7),
    lastMonth = sim.daily.at(-1).date.slice(0, 7);
  if (
    !calendarChoice.month ||
    calendarChoice.month < firstMonth ||
    calendarChoice.month > lastMonth
  )
    calendarChoice.month = firstMonth;
  const host = node("details", null, "panel schedule");
  host.open = calendarChoice.open;
  host.ontoggle = () => {
    calendarChoice.open = host.open;
  };
  host.append(node("summary", "Calendrier des échéances"));
  const toolbar = node("div", null, "calendar-toolbar"),
    month = input("schedule_month", "month", calendarChoice.month),
    modes = node("div", null, "calendar-modes"),
    content = node("div", null, "calendar-content"),
    detail = node("section", null, "calendar-day-detail");
  month.min = firstMonth;
  month.max = lastMonth;
  const previous = button("←", () => moveMonth(-1)),
    next = button("→", () => moveMonth(1));
  previous.setAttribute("aria-label", "Mois précédent");
  next.setAttribute("aria-label", "Mois suivant");
  const monthButton = button("Mois", () => {
      calendarChoice.mode = "month";
      draw();
    }),
    listButton = button("Liste", () => {
      calendarChoice.mode = "list";
      draw();
    });
  modes.setAttribute("aria-label", "Affichage du calendrier");
  modes.append(monthButton, listButton);
  toolbar.append(previous, field("Mois", month), next, modes);
  host.append(
    toolbar,
    node(
      "p",
      "Disponible prévu après les limites et les cartes. Touchez une journée pour le détail. Les cases hors prévision n’ont pas de montant.",
      "muted calendar-help",
    ),
    content,
    detail,
  );
  function renewals(day) {
    return sim.categories.flatMap((c) =>
      c.periods
        .filter((p) => p.date === day && p.date >= sim.reference)
        .map((p) => ({ name: c.name, amount_cents: p.remaining_cents })),
    );
  }
  function eventRow(e) {
    const row = node("div", null, "schedule-row"),
      text = node("div");
    text.append(
      node("strong", e.name),
      node(
        "small",
        (e.overdue ? "En retard · " : "") + scheduleDate(e),
        "calendar-event-date",
      ),
    );
    const actions = node("div", null, "actions");
    for (const [label, action] of [
      [
        e.kind === "income"
          ? "Reçue"
          : e.kind === "transfer"
            ? "Effectué"
            : "Payée",
        "pay",
      ],
      ["Modifier cette fois", "edit_amount"],
      ["Reporter", "postpone"],
    ])
      actions.append(
        button(label, () => occurrenceAction(e, action), "text-button"),
      );
    row.append(
      text,
      node(
        "strong",
        (e.kind === "income" ? "+" : e.kind === "expense" ? "−" : "↔ ") +
          money(e.amount_cents),
        e.kind === "income" ? "positive" : "",
      ),
      actions,
    );
    return row;
  }
  function dayContents(parent, d) {
    for (const e of d.events) parent.append(eventRow(e));
    for (const r of renewals(d.date)) {
      const row = node("div", null, "calendar-renewal");
      row.append(
        node("strong", "Renouvellement · " + r.name),
        node("span", money(r.amount_cents) + " protégés"),
        node("small", "Inclus dans le disponible, sans débit bancaire."),
      );
      parent.append(row);
    }
    if (!d.events.length && !renewals(d.date).length)
      parent.append(node("p", "Aucun mouvement prévu.", "muted"));
  }
  function showDay(date) {
    const d = days.get(date);
    if (!d) return;
    calendarChoice.selected = date;
    for (const cell of content.querySelectorAll("[data-calendar-date]"))
      cell.setAttribute(
        "aria-pressed",
        String(cell.dataset.calendarDate === date),
      );
    detail.replaceChildren(
      node("h3", longDate(date)),
      node("p", "Disponible prévu en fin de journée", "muted"),
      node(
        "strong",
        money(d.safe_cents),
        "calendar-selected-balance" + (d.safe_cents < 0 ? " negative" : ""),
      ),
    );
    if (date === sim.minimum_on)
      detail.append(node("small", "Minimum prévu sur 90 jours", "muted"));
    detail.dataset.date = date;
    dayContents(detail, d);
  }
  function moveMonth(delta) {
    const d = new Date(month.value + "-01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + delta);
    month.value = d.toISOString().slice(0, 7);
    draw();
  }
  function draw() {
    const value = month.value;
    content.replaceChildren();
    detail.replaceChildren();
    monthButton.setAttribute(
      "aria-pressed",
      String(calendarChoice.mode === "month"),
    );
    listButton.setAttribute(
      "aria-pressed",
      String(calendarChoice.mode === "list"),
    );
    previous.disabled = !value || value <= firstMonth;
    next.disabled = !value || value >= lastMonth;
    if (
      !/^\d{4}-\d{2}$/.test(value) ||
      value < firstMonth ||
      value > lastMonth
    ) {
      content.append(
        node("p", "Choisissez un mois compris dans les 90 jours de prévision."),
      );
      detail.hidden = true;
      return;
    }
    calendarChoice.month = value;
    const visible = sim.daily.filter((d) => d.date.startsWith(value));
    const heading = node(
      "h3",
      new Date(value + "-01T12:00:00").toLocaleDateString("fr-CA", {
        month: "long",
        year: "numeric",
      }),
      "calendar-month-title",
    );
    content.append(heading);
    detail.hidden = calendarChoice.mode !== "month";
    if (calendarChoice.mode === "list") {
      for (const d of visible) {
        const row = node("section", null, "calendar-list-day"),
          head = node("div", null, "daily-row");
        head.append(
          node("h4", longDate(d.date)),
          node(
            "strong",
            money(d.safe_cents),
            "money" + (d.safe_cents < 0 ? " negative" : ""),
          ),
        );
        row.append(head);
        dayContents(row, d);
        content.append(row);
      }
      return;
    }
    const grid = node("div", null, "calendar-grid");
    grid.setAttribute("aria-label", "Calendrier de " + heading.textContent);
    for (const day of ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."])
      grid.append(node("div", day, "calendar-weekday"));
    const first = new Date(value + "-01T12:00:00Z"),
      offset = (first.getUTCDay() + 6) % 7,
      total = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
      ).getUTCDate();
    for (let i = 0; i < offset; i++) {
      const blank = node("div", null, "calendar-blank");
      blank.setAttribute("aria-hidden", "true");
      grid.append(blank);
    }
    for (let n = 1; n <= total; n++) {
      const date = value + "-" + String(n).padStart(2, "0"),
        d = days.get(date),
        cell = button("", () => showDay(date), "calendar-cell");
      cell.dataset.calendarDate = date;
      const top = node("span", null, "calendar-cell-top");
      top.append(node("span", String(n), "calendar-date-number"));
      if (date === sim.reference) {
        cell.setAttribute("aria-current", "date");
        top.append(node("span", "●", "calendar-today-dot"));
      }
      cell.append(top);
      if (!d) {
        cell.disabled = true;
        cell.setAttribute("aria-label", longDate(date) + " · hors prévision");
        cell.append(node("span", "—", "calendar-balance"));
      } else {
        cell.setAttribute(
          "aria-label",
          longDate(date) +
            " · Disponible prévu " +
            money(d.safe_cents) +
            " · " +
            d.events.length +
            " mouvement(s)",
        );
        cell.setAttribute("aria-pressed", "false");
        cell.append(
          node(
            "strong",
            money(d.safe_cents),
            "calendar-balance" + (d.safe_cents < 0 ? " negative" : ""),
          ),
        );
        const items = [
          ...d.events.map((e) => ({
            name:
              (e.kind === "income"
                ? "+ "
                : e.kind === "transfer"
                  ? "↔ "
                  : "− ") + e.name,
            kind: e.kind,
          })),
          ...renewals(date).map((r) => ({
            name: "◇ " + r.name,
            kind: "renewal",
          })),
        ];
        for (const item of items.slice(0, 2))
          cell.append(node("span", item.name, "calendar-chip " + item.kind));
        if (items.length)
          cell.append(
            node("small", "● " + String(items.length), "calendar-count"),
          );
        if (d.safe_cents < 0) cell.classList.add("calendar-negative");
        if (date === sim.minimum_on) {
          cell.classList.add("calendar-low");
          cell.setAttribute(
            "aria-label",
            cell.getAttribute("aria-label") + " · Minimum prévu sur 90 jours",
          );
        }
        cell.title = cell.getAttribute("aria-label");
      }
      grid.append(cell);
    }
    content.append(grid);
    const selected = visible.some((d) => d.date === calendarChoice.selected)
      ? calendarChoice.selected
      : visible[0]?.date;
    if (selected) showDay(selected);
  }
  month.onchange = draw;
  draw();
  return host;
}

function tutorialCard(index) {
  const item = tutorialSteps[index],
    card = node("section", null, "tutorial-card");
  card.setAttribute("aria-label", "Tutoriel de configuration");
  card.append(
    node(
      "p",
      index < 4 ? "Étape " + (index + 1) + " sur 4" : "Après la configuration",
      "eyebrow",
    ),
    node("h3", item.title),
    node("p", item.text),
    node("p", item.tip, "muted"),
    node("p", item.example, "tutorial-example"),
  );
  return card;
}
function tutorialEditor() {
  let index = 0;
  const content = node("div", null, "tutorial-review"),
    progress = node("p", null, "muted");
  const previous = button("Précédent", () => {
    index--;
    draw();
  });
  function draw() {
    content.replaceChildren(progress, tutorialCard(index), previous);
    progress.textContent =
      "Tutoriel · " + (index + 1) + " / " + tutorialSteps.length;
    previous.hidden = index === 0;
    $("#editor-save").textContent =
      index === tutorialSteps.length - 1 ? "Terminer" : "Suivant";
  }
  modal(
    "Bien démarrer",
    content,
    () => {
      if (index === tutorialSteps.length - 1) return true;
      index++;
      draw();
      return false;
    },
    "Suivant",
  );
  draw();
}

function overdueEditor() {
  const events = state.simulation.upcoming.filter(
      (e) => e.overdue && e.kind !== "income",
    ),
    content = node("div", null, "overdue-list");
  if (!events.length) {
    toast("Aucune échéance en retard.");
    return;
  }
  for (const e of events) {
    const row = node("div", null, "schedule-row"),
      text = node("div");
    text.append(
      node("strong", e.name),
      node("small", scheduleDate(e), "muted"),
    );
    const actions = node("div", null, "actions");
    for (const [label, action] of [
      [e.kind === "transfer" ? "Effectué" : "Payée", "pay"],
      ["Modifier cette fois", "edit_amount"],
      ["Reporter", "postpone"],
    ])
      actions.append(
        button(
          label,
          () => {
            editor.close();
            occurrenceAction(e, action);
          },
          "text-button",
        ),
      );
    row.append(text, node("strong", money(e.amount_cents)), actions);
    content.append(row);
  }
  modal("Échéances à traiter", content, null);
}
