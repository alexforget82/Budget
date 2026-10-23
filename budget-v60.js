// Domain initializer. Shared state and rendering hooks are explicit dependencies.
export function initialize(runtime) {
  /* Global targets never reserve money; the recurring agenda retains real dates. */
  (() => {
    const $ = (id) => document.getElementById(id),
      el = (tag, text, cls) => {
        const e = document.createElement(tag);
        if (text !== undefined) e.textContent = text;
        if (cls) e.className = cls;
        return e;
      },
      cash = (c) =>
        (c / 100).toLocaleString("fr-CA", {
          style: "currency",
          currency: "CAD",
        }),
      short = (d) =>
        new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
          day: "numeric",
          month: "short",
        }),
      button = (text, fn, cls = "secondary") => {
        const b = el("button", text, cls);
        b.type = "button";
        b.onclick = fn;
        return b;
      },
      field = (text, input) => {
        const l = el("label", text);
        input.setAttribute("aria-label", text);
        l.append(input);
        return l;
      },
      go = (key) =>
        document.querySelector(`.app-shell-nav [data-view="${key}"]`).click();
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
        ),
        s = await r.json();
      if (!r.ok) throw Error(s.error || "Opération impossible.");
      return s;
    }
    const root = $("monthly-budget-workspace"),
      month = el("input"),
      toolbar = el("div", undefined, "v60-toolbar"),
      summary = el("div", undefined, "v60-metrics"),
      notice = el("div", undefined, "v60-notice"),
      list = el("div", undefined, "v60-directory"),
      search = el("input"),
      filter = el("select");
    month.type = "month";
    month.value = runtime.today().slice(0, 7);
    month.id = "v60-month";
    search.type = "search";
    search.placeholder = "Rechercher une catégorie";
    search.setAttribute("aria-label", "Rechercher dans le budget");
    filter.setAttribute("aria-label", "Afficher les catégories");
    for (const [v, t] of [
      ["all", "Toutes les catégories"],
      ["over", "Dépenses au-dessus du budget"],
      ["missing", "Activité sans budget"],
      ["recurring", "Échéances au-dessus du budget"],
    ])
      filter.add(new Option(t, v));
    notice.setAttribute("role", "status");
    let latest,
      data,
      ticket = 0,
      expanded = new Set();
    const budgetNames = {
      weekly: "À la semaine",
      biweekly: "Aux 2 semaines",
      monthly: "Au mois",
      quarterly: "Aux 3 mois",
      semiannual: "Aux 6 mois",
      yearly: "À l’année",
    };
    function shift(input, n) {
      if (!/^\d{4}-\d{2}$/.test(input.value)) return;
      const d = new Date(input.value + "-15T12:00:00");
      d.setMonth(d.getMonth() + n);
      input.value =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      input.dispatchEvent(new Event("change"));
    }
    toolbar.append(
      button("←", () => shift(month, -1)),
      field("Mois du budget", month),
      button("→", () => shift(month, 1)),
      search,
      filter,
      button("Mes enveloppes", () => go("enveloppes")),
      button("Mes récurrences", () => go("recurrences")),
    );
    toolbar.firstChild.setAttribute("aria-label", "Mois budgétaire précédent");
    toolbar.children[2].setAttribute("aria-label", "Mois budgétaire suivant");
    root.classList.add("budget-register-view");
    const hideEmpty = el("input");
    hideEmpty.type = "checkbox";
    hideEmpty.onchange = drawBudget;
    const emptyControl = field("Masquer les catégories vides", hideEmpty);
    emptyControl.className = "budget-hide-empty";
    toolbar.append(emptyControl);
    const tools = el("details", undefined, "budget-register-tools");
    tools.append(el("summary", "Options du budget"));
    const footer = el("div", undefined, "budget-register-total");
    footer.setAttribute("aria-live", "polite");
    root.append(toolbar, tools, summary, notice, list, footer);
    const help = el("details", undefined, "v60-help");
    help.append(
      el("summary", "Comment lire mon budget global ?"),
      el(
        "p",
        "Prévu est votre objectif, Réel regroupe les transactions classées, y compris celles sur carte. Un écart positif signifie des revenus au-dessus du prévu ou des dépenses en dessous. Le mois en cours est encore incomplet.",
      ),
      el(
        "p",
        "Les budgets à la semaine et aux deux semaines comptent les dates du mois : 4 ou 5 occurrences à la semaine, 2 ou 3 aux deux semaines. Le montant par occurrence reste fixe. Une récurrence ou une date de référence fournit le calendrier; aucun paiement n’est créé. Les autres objectifs conservent leur mode de calcul.",
      ),
      el(
        "p",
        "Budget ne réserve aucun argent et ne modifie pas le Safe-to-Spend. Les enveloppes protègent l’argent; les récurrences portent les échéances. Leurs programmations existantes sont conservées. Les virements internes sont exclus des revenus et dépenses.",
      ),
    );
    root.append(help);
    const nav = document.querySelector(
      '.app-shell-nav [data-view="recurrences"]',
    );
    nav.classList.remove("planning-subroute");
    const hub = document.querySelector(
      '.app-shell-nav [data-view="prevision"]',
    );
    for (const n of hub.childNodes)
      if (n.nodeType === Node.TEXT_NODE) n.textContent = "Prévisions";
    for (const section of document.querySelectorAll(".planning-tabs"))
      section.prepend(button("Budget", () => go("budget")));
    for (const key of ["budget", "recurrences"])
      document
        .querySelector(`.app-shell-nav [data-view="${key}"]`)
        .addEventListener("click", () => {
          hub.classList.remove("planning-hub-active");
          hub.setAttribute("aria-current", "false");
        });
    function openDialog(title, id) {
      const d = el("dialog", undefined, "editor-dialog v60-dialog");
      d.id = id;
      d.setAttribute("aria-label", title);
      const inside = el("div", undefined, "dialog-inner"),
        head = el("div", undefined, "dialog-heading");
      head.append(
        el("h2", title),
        button("Fermer", () => d.close()),
      );
      inside.append(head);
      d.append(inside);
      document.body.append(d);
      return { d, inside, head };
    }
    const startEditor = openDialog("Mois de démarrage", "start-budget-editor");
    const editor = openDialog(
        "Configurer un objectif global",
        "v60-budget-editor",
      ),
      copyDialog = openDialog(
        "Reprendre les objectifs du mois précédent",
        "v60-copy-dialog",
      );
    toolbar.append(
      button("Reprendre le mois précédent", async () => {
        while (copyDialog.inside.children.length > 1)
          copyDialog.inside.lastChild.remove();
        copyDialog.d.showModal();
        const error = el("p", undefined, "v60-error");
        copyDialog.inside.append(error);
        const d = new Date(month.value + "-15T12:00:00");
        d.setMonth(d.getMonth() - 1);
        const args = {
          from:
            d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"),
          to: month.value,
        };
        try {
          const p = await request("/api/budget/global-copy-preview", args);
          copyDialog.inside.append(
            el(
              "p",
              p.rows.length +
                " objectif(s) à reprendre. Les objectifs existants et déjà reconduits sont conservés.",
            ),
            el(
              "p",
              "Cette copie reprend uniquement les objectifs, pour ce mois. Aucun solde, aucune enveloppe ni récurrence ne sont modifiés.",
              "quiet-copy",
            ),
          );
          if (p.rows.length) {
            const items = el("details");
            items.append(el("summary", "Voir les montants"));
            for (const r of p.rows)
              items.append(
                el(
                  "p",
                  r.name +
                    " · " +
                    (r.monthly_amount_cents === null
                      ? "Calendrier à configurer"
                      : cash(r.monthly_amount_cents) + " pour le mois choisi"),
                ),
              );
            copyDialog.inside.append(
              items,
              button(
                "Confirmer la reprise",
                async () => {
                  try {
                    runtime.render(
                      await request("/api/budget/global-copy", {
                        ...args,
                        token: p.token,
                      }),
                    );
                    copyDialog.d.close();
                  } catch (e) {
                    error.textContent = e.message;
                  }
                },
                "primary",
              ),
            );
          }
        } catch (e) {
          error.textContent = e.message;
        }
      }),
    );
    toolbar.append(button("Mois de démarrage", () => editStart()));
    function editStart(row = null, sub = null) {
      while (startEditor.inside.children.length > 1)
        startEditor.inside.lastChild.remove();
      const target = sub || row,
        partial = data?.start_period;
      startEditor.head.firstChild.textContent = row
        ? "Exception · " +
          row.name +
          (sub ? " / " + sub.name : "") +
          " · " +
          data.month
        : "Mois de démarrage";
      const form = el("form", undefined, "v60-form"),
        error = el("p", undefined, "v60-error"),
        result = el("div");
      error.setAttribute("role", "alert");
      let dateInput, amount, count, mode;
      if (!row) {
        dateInput = el("input");
        dateInput.type = "date";
        dateInput.required = true;
        dateInput.value =
          partial?.start_on ||
          (month.value === runtime.today().slice(0, 7)
            ? runtime.today()
            : month.value + "-01");
        form.append(
          field("Début du suivi budgétaire", dateInput),
          el(
            "p",
            "Le réel de ce mois commence à cette date. Ajustez ensuite les catégories concernées avec Exception. Les objectifs habituels reprennent les mois suivants. Aucune transaction ni réserve n’est créée.",
            "quiet-copy",
          ),
        );
      } else {
        mode = el("select");
        mode.add(new Option("Montant × nombre restant", "count"));
        mode.add(new Option("Total exceptionnel", "total"));
        amount = el("input");
        amount.type = "number";
        amount.min = "0";
        amount.step = ".01";
        amount.required = true;
        amount.value = (
          (target.start_exception?.unit_cents ??
            target.plan?.amount_cents ??
            target.regular_budget_cents ??
            target.budget_cents ??
            0) / 100
        ).toFixed(2);
        count = el("input");
        count.type = "number";
        count.min = "0";
        count.max = "1000";
        count.step = "1";
        count.required = true;
        count.value = String(target.start_exception?.count ?? 1);
        const countField = field(
          "Nombre de paiements ou paies restants",
          count,
        );
        form.append(
          field("Méthode de calcul", mode),
          field("Montant ($)", amount),
          countField,
          el(
            "p",
            "Exception pour ce mois seulement. Les paiements restent dans Récurrences. Aucun effet sur le Safe-to-Spend.",
            "quiet-copy",
          ),
        );
        mode.onchange = () => {
          countField.hidden = mode.value === "total";
          count.disabled = mode.value === "total";
        };
      }
      const preview = el("button", "Vérifier l’exception", "primary");
      preview.type = "submit";
      form.append(error, preview, result);
      let serial = 0;
      form.oninput = () => {
        serial++;
        result.replaceChildren();
      };
      form.addEventListener("change", () => {
        serial++;
        result.replaceChildren();
      });
      async function verify(action) {
        const mine = ++serial;
        error.textContent = "";
        result.replaceChildren();
        const payload = row
          ? {
              action: action || "exception",
              month: data.month,
              category_id: row.id,
              subcategory_id: sub?.id || null,
              amount: Number(amount.value),
              count: mode.value === "total" ? 1 : Number(count.value),
            }
          : { action: action || "period", start_on: dateInput.value };
        try {
          const p = await request("/api/budget/start-preview", payload);
          if (mine !== serial || !startEditor.d.open) return;
          result.append(
            el(
              "p",
              p.action === "reset"
                ? "Retirer la période de démarrage et toutes ses exceptions. Le mois complet et les objectifs habituels seront rétablis."
                : p.action === "remove"
                  ? "Retirer cette exception et retrouver l’objectif habituel pour ce mois."
                  : row
                    ? "Total exceptionnel : " + cash(p.amount_cents)
                    : "Début du suivi : " +
                      short(p.after.start_on) +
                      ". Les transactions précédentes restent conservées.",
              "life-preview",
            ),
            button(
              "Confirmer",
              async () => {
                try {
                  runtime.render(
                    await request("/api/budget/start-apply", {
                      ...payload,
                      token: p.token,
                    }),
                  );
                  startEditor.d.close();
                } catch (e) {
                  error.textContent = e.message;
                  result.replaceChildren();
                }
              },
              "primary",
            ),
          );
        } catch (e) {
          error.textContent = e.message;
        }
      }
      form.onsubmit = async (e) => {
        e.preventDefault();
        preview.disabled = true;
        try {
          await verify();
        } finally {
          preview.disabled = false;
        }
      };
      if (row && target.start_exception)
        form.append(button("Retirer cette exception", () => verify("remove")));
      if (!row && partial)
        form.append(
          button("Retirer le mois de démarrage", () => verify("reset")),
        );
      startEditor.inside.append(form);
      startEditor.d.showModal();
    }
    async function load() {
      const mine = ++ticket;
      notice.textContent = "Chargement du budget…";
      try {
        const s = await request(
          "/api/budget/global?" + new URLSearchParams({ month: month.value }),
        );
        if (mine !== ticket) return;
        data = s;
        drawBudget();
      } catch (e) {
        if (mine === ticket) {
          notice.textContent = e.message;
          list.replaceChildren();
          summary.replaceChildren();
        }
      }
    }
    toolbar.append(
      button("Tout replier", () => {
        if (data)
          for (const r of data.rows)
            expanded.add(
              r.direction +
                "|" +
                (r.direction === "income" ? "Revenus" : r.group),
            );
        drawBudget();
      }),
      button("Tout déplier", () => {
        expanded.clear();
        drawBudget();
      }),
    );
    month.onchange = load;
    search.oninput = drawBudget;
    filter.onchange = drawBudget;
    function metric(label, planned, actual) {
      const d = el("div");
      d.append(
        el("span", label),
        el("strong", cash(planned), planned < 0 ? "v60-negative" : ""),
        el(
          "small",
          data?.calendar_warnings?.length
            ? "Prévu · total incomplet"
            : data?.start_period
              ? "Prévu · période de démarrage"
              : "Prévu · total du mois",
        ),
        el("div", "Réel : " + cash(actual), "v74-metric-actual"),
      );
      summary.append(d);
    }
    function drawBudget() {
      if (!data) return;
      summary.replaceChildren();
      metric(
        "Revenus prévus",
        data.totals.income.budget_cents,
        data.totals.income.actual_cents,
      );
      metric(
        "Budgété",
        data.totals.expense.budget_cents,
        data.totals.expense.actual_cents,
      );
      metric(
        "Reste à répartir",
        data.planned_net_cents,
        data.actual_net_cents,
      );
      footer.textContent = "Dépenses · Budget " + cash(data.totals.expense.budget_cents) + " · Dépensé " + cash(data.totals.expense.actual_cents) + " · Disponible " + cash(data.totals.expense.budget_cents - data.totals.expense.actual_cents);
      // Keep secondary operations available without crowding the table.
      for (const b of [...toolbar.children])
        if (b.tagName === "BUTTON" && !["←", "→", "Reprendre le mois précédent"].includes(b.textContent)) tools.append(b);
      notice.replaceChildren();
      if (data.calendar_warnings?.length)
        notice.append(
          el(
            "p",
            "Total incomplet : " +
              data.calendar_warnings.length +
              " budget(s) à la semaine ou aux deux semaines nécessitent un calendrier. Ouvrez les lignes « Calendrier à choisir » pour les configurer. Aucune moyenne n’est utilisée.",
            "v74-warning",
          ),
        );
      if (data.start_period)
        notice.append(
          el(
            "p",
            "Mois de démarrage · du " +
              short(data.start_period.start_on) +
              " à la fin du mois. Le réel exclut les opérations précédentes. Seules les lignes avec Exception ont un objectif ajusté; les autres gardent leur montant habituel. Les mois suivants reprennent vos objectifs habituels.",
            "start-budget-banner",
          ),
        );
      if (data.uncategorized.count) {
        notice.append(
          el(
            "p",
            data.uncategorized.count +
              " transaction(s) non catégorisée(s) : revenus " +
              cash(data.uncategorized.income_cents) +
              ", dépenses " +
              cash(data.uncategorized.expense_cents) +
              ". Inclus dans les totaux réels, à classer pour détailler les catégories.",
          ),
          button("Classer les transactions", () => {
            go("transactions");
            $("v3-category-filter").value = "uncategorized";
            $("v3-date-from").value =
              data.start_period?.start_on || data.month + "-01";
            const end = new Date(data.month + "-15T12:00:00Z");
            end.setUTCMonth(end.getUTCMonth() + 1);
            end.setUTCDate(0);
            $("v3-date-to").value = end.toISOString().slice(0, 10);
            $("v3-category-filter").dispatchEvent(
              new Event("change", { bubbles: true }),
            );
          }),
        );
      }
      if (data.warnings.length)
        notice.append(
          button(
            data.warnings.length +
              " catégorie(s) : échéances supérieures au budget",
            () => {
              filter.value = "recurring";
              drawBudget();
            },
          ),
        );
      if (data.unbudgeted_count)
        notice.append(
          button(
            data.unbudgeted_count + " catégorie(s) avec activité sans budget",
            () => {
              filter.value = "missing";
              drawBudget();
            },
          ),
        );
      list.replaceChildren();
      const term = search.value
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLocaleLowerCase("fr-CA"),
        rows = data.rows
          .filter(r => !hideEmpty.checked || r.budget_cents || r.actual_cents || r.recurring_cents || r.plan || r.subcategories.some(sub => sub.plan || sub.actual_cents))
          .filter((r) =>
            (
              r.name +
              " " +
              r.group +
              " " +
              r.subcategories.map((s) => s.name).join(" ")
            )
              .normalize("NFD")
              .replace(/\p{M}/gu, "")
              .toLocaleLowerCase("fr-CA")
              .includes(term),
          )
          .filter(
            (r) =>
              filter.value === "all" ||
              (filter.value === "over" &&
                r.direction === "expense" &&
                ((r.variance_cents !== null && r.variance_cents < 0) ||
                  r.overspent_subcategory_count > 0)) ||
              (filter.value === "missing" &&
                ((r.budget_cents === null && r.actual_cents !== 0) ||
                  r.unbudgeted_subcategory_count > 0)) ||
              (filter.value === "recurring" &&
                r.recurring_over_budget_cents > 0),
          );
      const head = el("div", undefined, "v60-table-heading");
      for (const t of [
        "Catégorie",
        data.start_period ? "Budget · période" : "Budget",
        "Dépensé / reçu",
        "Disponible",
      ])
        head.append(el("span", t));
      list.append(head);
      const keys = [
        ...new Set(
          rows.map(
            (r) =>
              r.direction +
              "|" +
              (r.direction === "income" ? "Revenus" : r.group),
          ),
        ),
      ].sort(
        (a, b) =>
          Number(!a.startsWith("income")) - Number(!b.startsWith("income")) ||
          a.localeCompare(b, "fr-CA"),
      );
      for (const key of keys) {
        const items = rows.filter(
            (r) =>
              r.direction +
                "|" +
                (r.direction === "income" ? "Revenus" : r.group) ===
              key,
          ),
          group = el("details", undefined, "v60-group"),
          heading = el("summary", undefined, "v60-group-heading");
        group.dataset.group = key;
        group.open = !!term || filter.value !== "all" || !expanded.has(key);
        group.ontoggle = () => {
          if (!group.isConnected || term || filter.value !== "all") return;
          if (group.open) expanded.delete(key);
          else expanded.add(key);
        };
        heading.append(el("span", key.split("|")[1] + " · " + items.length));
        const budget = items.reduce((n, r) => n + (r.budget_cents || 0), 0),
          actual = items.reduce((n, r) => n + r.actual_cents, 0),
          variance = budget - actual;
        for (const value of [budget, actual, variance])
          heading.append(el("strong", cash(value)));
        group.append(heading);
        for (const r of items) {
          const row = el("div", undefined, "v60-budget-row");
          row.dataset.categoryId = r.id;
          const name = el("div", undefined, "v60-category-copy");
          name.append(button(r.name, () => editBudget(r), "v60-name"));
          if (r.budget_mode === "subcategories")
            name.append(
              el(
                "small",
                "Total de " +
                  r.subcategories.filter((s) => s.budget_cents !== null)
                    .length +
                  " / " +
                  r.subcategories.filter(
                    (s) => !s.archived || s.budget_cents !== null,
                  ).length +
                  " sous-catégories budgétées",
              ),
            );
          if (r.overspent_subcategory_count)
            name.append(
              el(
                "small",
                r.overspent_subcategory_count +
                  " sous-catégorie(s) au-dessus du budget",
                "v74-warning",
              ),
            );
          if (r.archived)
            name.append(el("small", "Archivée · objectif conservé"));
          if (
            data.start_period &&
            !r.archived &&
            r.budget_mode !== "subcategories"
          )
            name.append(
              button(
                r.start_exception ? "Modifier l’exception" : "Exception",
                () => editStart(r),
                "v4-text-button start-budget-button",
              ),
            );
          if (r.start_exception)
            name.append(
              el(
                "small",
                "Exception : " +
                  cash(r.start_exception.unit_cents) +
                  " × " +
                  r.start_exception.count +
                  " · ce mois seulement",
                "start-budget-tag",
              ),
            );
          if (r.plan && r.budget_mode !== "subcategories")
            name.append(
              el(
                "small",
                (data.start_period ? "Habituel : " : "") +
                  cash(r.plan.amount_cents) +
                  " · " +
                  budgetNames[r.plan.frequency] +
                  " · " +
                  (r.plan.repeat ? "reconduit" : "ce mois seulement"),
              ),
            );
          if (r.calendar)
            name.append(
              el("small", calendarText(r.calendar, r.plan), "v113-calendar"),
            );
          if (r.recurring_ids.length)
            name.append(
              el(
                "small",
                (data.start_period
                  ? "Échéances de la période : "
                  : "Échéances du mois : ") +
                  cash(r.recurring_cents) +
                  " · " +
                  r.recurring_ids.length +
                  " récurrence(s)",
              ),
            );
          if (r.recurring_over_budget_cents > 0)
            name.append(
              el(
                "small",
                "Budget inférieur aux échéances de " +
                  cash(r.recurring_over_budget_cents),
                "v74-warning",
              ),
            );
          row.append(name);
          const amount = button(
            r.budget_cents === null
              ? r.plan
                ? "Calendrier à choisir"
                : "Définir"
              : cash(r.budget_cents),
            () => (r.start_exception ? editStart(r) : editBudget(r)),
            "v60-money-button",
          );
          amount.disabled = !!r.archived;
          name.querySelector("button").disabled = !!r.archived;
          amount.setAttribute("aria-label", "Budget de " + r.name);
          row.append(
            amount,
            el("span", cash(r.actual_cents), "v60-actual"),
            el(
              "strong",
              r.variance_cents === null ? "—" : cash(r.variance_cents),
              r.variance_cents < 0 ? "v60-negative" : "v60-positive",
            ),
          );
          decorateBudgetRow(row, r);
          group.append(row);
          if (r.subcategories.length) {
            const detail = el("details", undefined, "v60-subcategories");
            detail.dataset.parentId = r.id;
            detail.open = !!term || r.budget_mode === "subcategories";
            detail.append(el("summary", "Sous-catégories de " + r.name));
            for (const sub of r.subcategories.filter(
              (s) => !s.archived || s.budget_cents !== null || s.actual_cents,
            )) {
              const line = el("div", undefined, "v60-budget-row v74-sub-row");
              line.dataset.subcategoryId = sub.id;
              const copy = el("div", undefined, "v60-category-copy"),
                edit = () =>
                  sub.start_exception
                    ? editStart(r, sub)
                    : editBudget({
                        ...sub,
                        id: r.id,
                        subcategory_id: sub.id,
                        name: r.name + " / " + sub.name,
                        direction: r.direction,
                        recurring_ids: [],
                        budget_mode: "subcategory",
                      });
              const title = button(sub.name, edit, "v60-name");
              title.disabled = !!r.archived || !!sub.archived;
              copy.append(title);
              if (data.start_period && !r.archived && !sub.archived)
                copy.append(
                  button(
                    sub.start_exception ? "Modifier l’exception" : "Exception",
                    () => editStart(r, sub),
                    "v4-text-button start-budget-button",
                  ),
                );
              if (sub.start_exception)
                copy.append(
                  el(
                    "small",
                    "Exception : " +
                      cash(sub.start_exception.unit_cents) +
                      " × " +
                      sub.start_exception.count +
                      " · ce mois seulement",
                    "start-budget-tag",
                  ),
                );
              if (sub.calendar)
                copy.append(
                  el(
                    "small",
                    calendarText(sub.calendar, sub.plan),
                    "v113-calendar",
                  ),
                );
              if (sub.plan)
                copy.append(
                  el(
                    "small",
                    (data.start_period ? "Habituel : " : "") +
                      cash(sub.plan.amount_cents) +
                      " · " +
                      budgetNames[sub.plan.frequency] +
                      " · " +
                      (sub.plan.repeat ? "reconduit" : "ce mois seulement"),
                  ),
                );
              const planned = button(
                sub.budget_cents === null
                  ? sub.plan
                    ? "Calendrier à choisir"
                    : "Définir"
                  : cash(sub.budget_cents),
                edit,
                "v60-money-button",
              );
              planned.setAttribute(
                "aria-label",
                "Budget de " + r.name + " / " + sub.name,
              );
              planned.disabled = title.disabled;
              line.append(
                copy,
                planned,
                el("span", cash(sub.actual_cents), "v60-actual"),
                el(
                  "strong",
                  sub.variance_cents === null ? "—" : cash(sub.variance_cents),
                  sub.variance_cents < 0 ? "v60-negative" : "v60-positive",
                ),
              );
              decorateBudgetRow(line, {...sub, id:r.id, subcategory_id:sub.id, direction:r.direction, archived:r.archived || sub.archived});
              detail.append(line);
            }
            if (r.budget_mode === "subcategories")
              detail.append(
                el(
                  "p",
                  "Le total de la catégorie additionne uniquement les objectifs détaillés, sans ajouter un second budget global.",
                  "quiet-copy",
                ),
              );
            if (r.unassigned_subcategory_cents)
              detail.append(
                el(
                  "p",
                  "Réel sans sous-catégorie : " +
                    cash(r.unassigned_subcategory_cents) +
                    ". Inclus dans le réel de la catégorie.",
                  "quiet-copy",
                ),
              );
            group.append(detail);
          }
        }
        list.append(group);
      }
      if (!rows.length)
        list.append(el("p", "Aucune catégorie pour ces filtres.", "v60-empty"));
    }
    function decorateBudgetRow(line, row) {
      const previous = line.querySelector(".v60-money-button");
      const simple = !row.start_exception && row.budget_mode !== "subcategories" && (!row.plan || row.plan.frequency === "monthly");
      if (simple && !row.archived) {
        const input = el("input", undefined, "budget-inline-amount");
        input.type = "number"; input.min = "0"; input.max = "100000000"; input.step = "0.01";
        input.value = row.budget_cents == null ? "" : (row.budget_cents / 100).toFixed(2);
        input.placeholder = "Définir";
        input.setAttribute("aria-label", previous.getAttribute("aria-label"));
        input.title = row.plan?.repeat ? "Montant mensuel reconduit" : "Montant pour ce mois seulement";
        const originalMonth = data.month;
        input.addEventListener("keydown", e => { if(e.key === "Enter") { e.preventDefault(); input.blur(); } });
        input.onchange = async () => {
          if (!input.reportValidity() || input.value === "") return;
          const payload = {month:originalMonth,category_id:row.id,subcategory_id:row.subcategory_id || null,amount:Number(input.value),frequency:"monthly",repeat:row.plan?.repeat || false,direction:row.direction};
          input.disabled = true;
          try {
            const preview = await request("/api/budget/global-preview",payload);
            runtime.render(await request("/api/budget/global-apply",{...payload,token:preview.token}));
          } catch(error) { notice.textContent = error.message; input.disabled = false; }
        };
        previous.replaceWith(input);
      }
      const remaining = line.lastElementChild;
      if (row.direction === "income" && row.variance_cents !== null) {
        remaining.textContent = cash(-row.variance_cents);
        remaining.title = "Revenus restant à recevoir par rapport au budget";
        remaining.className = row.variance_cents > 0 ? "v60-negative" : "v60-positive";
      }
      if (row.direction === "expense" && row.budget_cents > 0) {
        const progress = el("progress");
        progress.max = row.budget_cents;
        progress.value = Math.min(row.budget_cents, Math.max(0,row.actual_cents));
        progress.setAttribute("aria-label", "Budget utilisé pour " + row.name);
        if (row.actual_cents > row.budget_cents) line.classList.add("budget-over");
        remaining.append(progress);
      }
    }
    function editBudget(row) {
      while (editor.inside.children.length > 1)
        editor.inside.lastChild.remove();
      editor.head.firstChild.textContent = row.name + " · " + data.month;
      const form = el("form", undefined, "v60-form"),
        amount = el("input"),
        frequency = el("select"),
        repeat = el("select"),
        direction = el("select"),
        out = el("div"),
        error = el("p", undefined, "v60-error");
      error.setAttribute("role", "alert");
      amount.type = "number";
      amount.min = "0";
      amount.max = "100000000";
      amount.step = ".01";
      amount.required = true;
      amount.value = row.plan
        ? row.plan.amount_cents === null
          ? ""
          : (row.plan.amount_cents / 100).toFixed(2)
        : row.budget_cents === null
          ? ""
          : (row.budget_cents / 100).toFixed(2);
      for (const [v, t] of Object.entries(budgetNames))
        frequency.add(new Option(t, v));
      frequency.value = row.plan?.frequency || "monthly";
      for (const [v, t] of [
        ["", "Choisir Oui ou Non"],
        ["true", "Oui — même montant les mois suivants"],
        ["false", "Non — ce mois seulement"],
      ])
        repeat.add(new Option(t, v));
      repeat.required = true;
      repeat.value = row.plan ? String(row.plan.repeat) : "";
      direction.add(new Option("Dépense", "expense"));
      direction.add(new Option("Revenu", "income"));
      direction.value = row.direction;
      form.append(
        field("Montant budgété ($)", amount),
        field("Fréquence du budget", frequency),
        field("Reconduire le même montant ?", repeat),
        field("Type de catégorie", direction),
        el(
          "p",
          "Le montant est saisi par occurrence. À la semaine ou aux deux semaines, le total dépend des dates du mois. Aucun argent n’est réservé ici; les paiements restent dans Récurrences.",
          "quiet-copy",
        ),
      );
      const calendarSelect = el("select"),
        reference = el("input"),
        calendarControls = el("div"),
        calendarHelp = el("p", undefined, "quiet-copy");
      reference.type = "date";
      reference.value =
        row.plan?.reference_on || row.calendar?.reference_on || "";
      calendarControls.append(
        field("Calendrier des occurrences", calendarSelect),
        field("Date de référence du budget", reference),
        calendarHelp,
      );
      form.append(calendarControls);
      function syncCalendar() {
        const previous =
          calendarSelect.value ||
          (row.plan?.calendar_rule_id
            ? String(row.plan.calendar_rule_id)
            : row.plan?.reference_on
              ? "reference"
              : "auto");
        calendarSelect.replaceChildren(
          new Option("Calendrier lié (automatique)", "auto"),
        );
        for (const rule of latest.recurring.filter(
          (r) =>
            r.active &&
            !r.one_time &&
            r.type === direction.value &&
            r.frequency === frequency.value,
        ))
          calendarSelect.add(
            new Option(
              rule.description + " · " + short(rule.start_on),
              String(rule.id),
            ),
          );
        calendarSelect.add(
          new Option("Choisir une date de référence", "reference"),
        );
        calendarSelect.value = [...calendarSelect.options].some(
          (o) => o.value === previous,
        )
          ? previous
          : "auto";
        const periodic = ["weekly", "biweekly"].includes(frequency.value);
        calendarControls.hidden = !periodic;
        reference.parentElement.hidden = calendarSelect.value !== "reference";
        reference.required = periodic && calendarSelect.value === "reference";
        calendarHelp.textContent =
          calendarSelect.value === "reference"
            ? "Une date connue de cette série suffit. Le rythme de 7 ou 14 jours se poursuit les mois suivants."
            : "Les dates de la récurrence choisie, ou du calendrier lié à la catégorie, déterminent le nombre d’occurrences. Le montant par occurrence reste celui du budget.";
      }
      frequency.addEventListener("change", syncCalendar);
      direction.addEventListener("change", syncCalendar);
      calendarSelect.addEventListener("change", syncCalendar);
      syncCalendar();
      if (row.subcategory_id) direction.disabled = true;
      if (row.budget_mode === "subcategories")
        form.append(
          el(
            "p",
            "Enregistrer cet objectif global remplacera les objectifs détaillés à partir de ce mois. Leurs transactions seront conservées. Pour modifier un seul montant, ouvrez plutôt sa sous-catégorie.",
            "v74-warning",
          ),
        );
      if (row.subcategory_id)
        form.append(
          el(
            "p",
            "Ce montant entre dans le total de la catégorie. Le budget global ne sera pas ajouté une deuxième fois.",
            "quiet-copy",
          ),
        );
      if (row.recurring_ids.length)
        form.append(
          button("Utiliser le total des récurrences du mois", () => {
            amount.value = (row.recurring_cents / 100).toFixed(2);
            frequency.value = "monthly";
            syncCalendar();
            reviewTicket++;
            out.replaceChildren();
          }),
        );
      let reviewTicket = 0;
      const args = (clear) => ({
        month: data.month,
        category_id: row.id,
        subcategory_id: row.subcategory_id || null,
        replace_children: row.budget_mode === "subcategories",
        amount: clear ? 0 : Number(amount.value),
        frequency: frequency.value,
        repeat: clear ? false : repeat.value === "true",
        direction: direction.value,
        clear,
        ...(!clear && ["weekly", "biweekly"].includes(frequency.value)
          ? calendarSelect.value === "reference"
            ? { reference_on: reference.value }
            : calendarSelect.value !== "auto"
              ? { calendar_rule_id: Number(calendarSelect.value) }
              : {}
          : {}),
      });
      async function review(clear) {
        const mine = ++reviewTicket;
        error.textContent = "";
        try {
          const payload = args(clear),
            p = await request("/api/budget/global-preview", payload);
          if (mine !== reviewTicket) return;
          out.replaceChildren(
            el(
              "p",
              clear
                ? "Retirer cet objectif à partir de ce mois. Les objectifs futurs déjà saisis séparément restent prioritaires."
                : "Prévu pour ce mois : " + cash(p.monthly_amount_cents),
              "life-preview",
            ),
          );
          if (p.calendar) {
            out.append(el("p", calendarText(p.calendar, p), "v113-calendar"));
            const dates = el("details");
            dates.append(el("summary", "Dates retenues pour ce mois"));
            for (const date of p.calendar.dates)
              dates.append(el("p", short(date)));
            out.append(dates);
          }
          if (row.subcategory_id)
            out.append(
              el(
                "p",
                p.category_monthly_cents === null
                  ? "Plus aucun objectif détaillé pour cette catégorie."
                  : "Total prévu de la catégorie : " +
                      cash(p.category_monthly_cents),
                "quiet-copy",
              ),
            );
          if (row.budget_mode === "subcategories")
            out.append(
              el(
                "p",
                "Cette confirmation remplace les objectifs détaillés par cet objectif global.",
                "v74-warning",
              ),
            );
          if (!clear)
            out.append(
              el(
                "p",
                p.repeat
                  ? p.calendar
                    ? "Le montant par occurrence est reconduit. Le nombre d’occurrences dépend du calendrier de chaque mois."
                    : "Montant reconduit automatiquement. Les objectifs déjà saisis pour un autre mois restent prioritaires."
                  : "Cet objectif s’applique seulement au mois choisi.",
                "quiet-copy",
              ),
            );
          out.append(
            el(
              "p",
              "Le Safe-to-Spend, les soldes, les enveloppes et les récurrences restent identiques.",
              "quiet-copy",
            ),
            button(
              clear ? "Confirmer le retrait" : "Enregistrer ce budget",
              async () => {
                try {
                  runtime.render(
                    await request("/api/budget/global-apply", {
                      ...payload,
                      token: p.token,
                    }),
                  );
                  editor.d.close();
                } catch (e) {
                  error.textContent = e.message;
                  out.replaceChildren();
                }
              },
              "primary",
            ),
          );
        } catch (e) {
          error.textContent = e.message;
        }
      }
      const preview = el("button", "Vérifier l’objectif", "primary");
      preview.type = "submit";
      form.append(error, preview);
      if (row.plan || row.budget_cents !== null)
        form.append(
          button("Retirer cet objectif", () => review(true), "secondary"),
        );
      form.append(out);
      form.oninput = form.onchange = () => {
        reviewTicket++;
        out.replaceChildren();
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        preview.disabled = true;
        try {
          await review(false);
        } finally {
          preview.disabled = false;
        }
      };
      editor.inside.append(form);
      editor.d.showModal();
      amount.focus();
    }
    // A compact, month-based agenda; the original rule editor remains available.
    const recurring = $("section-recurrences"),
      agenda = el("div", undefined, "v60-recurring");
    agenda.id = "v60-recurring";
    recurring.querySelector(".page-intro").after(agenda);
    recurring.querySelector(".section-head h2").textContent =
      "Vos rendez-vous financiers";
    recurring.querySelector(".page-intro").textContent =
      "Les dates, les fréquences et les comptes. Vos objectifs mensuels restent dans Budget.";
    const old = el("details", undefined, "v60-help");
    old.append(el("summary", "Gérer les règles récurrentes"));
    const oldGroups = $("rec-groups");
    oldGroups.before(old);
    old.append(oldGroups);
    const oldFilters = recurring.querySelector(".planning-filters");
    if (oldFilters) old.prepend(oldFilters);
    const recMonth = el("input"),
      recType = el("select"),
      recSearch = el("input"),
      recToolbar = el("div", undefined, "v60-toolbar"),
      recMetrics = el("div", undefined, "v60-metrics"),
      recList = el("div");
    recMonth.type = "month";
    recMonth.value = runtime.today().slice(0, 7);
    recMonth.id = "v60-recurring-month";
    for (const [v, t] of [
      ["all", "Tous les mouvements"],
      ["income", "Revenus"],
      ["expense", "Factures"],
      ["transfer", "Virements"],
      ["reserve", "Réserves"],
    ])
      recType.add(new Option(t, v));
    recType.setAttribute("aria-label", "Type de récurrence");
    recSearch.type = "search";
    recSearch.placeholder = "Nom, compte ou catégorie";
    recSearch.setAttribute("aria-label", "Rechercher une récurrence");
    recToolbar.append(
      button("←", () => shift(recMonth, -1)),
      field("Mois des récurrences", recMonth),
      button("→", () => shift(recMonth, 1)),
      recType,
      recSearch,
      button("Voir mon budget", () => go("budget")),
    );
    recToolbar.firstChild.setAttribute(
      "aria-label",
      "Mois des récurrences précédent",
    );
    recToolbar.children[2].setAttribute(
      "aria-label",
      "Mois des récurrences suivant",
    );
    agenda.append(recToolbar, recMetrics, recList);
    recMonth.onchange = drawRecurring;
    recType.onchange = drawRecurring;
    recSearch.oninput = drawRecurring;
    const classify = openDialog(
      "Lier une récurrence à une catégorie",
      "v60-classify",
    );
    function classifyRule(rule) {
      rule = { ...rule, id: rule.recurring_id || rule.id };
      while (classify.inside.children.length > 1)
        classify.inside.lastChild.remove();
      const form = el("form", undefined, "v60-form"),
        select = el("select"),
        error = el("p", undefined, "v60-error"),
        save = el("button", "Enregistrer le lien", "primary");
      select.add(new Option("Sans catégorie liée", ""));
      for (const cat of latest.categories.filter((c) => !c.archived))
        select.add(new Option(cat.name, cat.id));
      select.value = latest.budget60.recurring[rule.id] || "";
      save.type = "submit";
      form.append(
        el("p", rule.description),
        field("Catégorie du budget", select),
        el(
          "p",
          "Le lien classe les prochaines confirmations. Une réserve liée à cette catégorie est utilisée dans la prévision et lors d’une nouvelle dépense; les transactions déjà saisies gardent leur classement.",
          "quiet-copy",
        ),
        error,
        save,
      );
      form.onsubmit = async (e) => {
        e.preventDefault();
        save.disabled = true;
        try {
          runtime.render(
            await request("/api/budget/recurring-link", {
              recurring_id: rule.id,
              category_id: select.value ? Number(select.value) : null,
            }),
          );
          classify.d.close();
        } catch (err) {
          error.textContent = err.message;
        } finally {
          save.disabled = false;
        }
      };
      classify.inside.append(form);
      classify.d.showModal();
    }
    const frequencies = {
      weekly: "Chaque semaine",
      biweekly: "Aux deux semaines",
      monthly: "Chaque mois",
      quarterly: "Aux trois mois",
      semiannual: "Aux six mois",
      yearly: "Chaque année",
      last_business_day: "Dernier jour ouvrable",
      rrq: "Dernier jour ouvrable",
    };
    // Date generation stays on the server to share holiday and month-end rules.
    let recTicket = 0;
    async function drawRecurring() {
      if (!latest) return;
      const mine = ++recTicket;
      try {
        const result = await request(
          "/api/budget/occurrences?" +
            new URLSearchParams({ month: recMonth.value }),
        );
        if (mine !== recTicket) return;
        recMetrics.replaceChildren();
        for (const [label, type] of [
          ["Revenus programmés", "income"],
          ["Paiements programmés", "expense"],
          ["Virements programmés", "transfer"],
        ]) {
          const d = el("div");
          d.append(
            el("span", label),
            el(
              "strong",
              cash(
                result.items
                  .filter((i) => i.type === type)
                  .reduce((n, i) => n + i.planned_cents, 0),
              ),
            ),
          );
          recMetrics.append(d);
        }
        const term = recSearch.value.toLocaleLowerCase("fr-CA"),
          items = result.items.filter(
            (i) =>
              (recType.value === "all" || i.type === recType.value) &&
              (
                i.description +
                " " +
                i.account_name +
                " " +
                (i.category_name || "")
              )
                .toLocaleLowerCase("fr-CA")
                .includes(term),
          );
        recList.replaceChildren();
        for (const freq of [
          "once",
          "weekly",
          "biweekly",
          "monthly",
          "quarterly",
          "semiannual",
          "yearly",
          "last_business_day",
          "rrq",
        ]) {
          const matches = items.filter(
            (i) => (i.one_time ? "once" : i.frequency) === freq,
          );
          if (!matches.length) continue;
          const group = el("details", undefined, "v60-rec-group");
          group.open = true;
          group.append(
            el(
              "summary",
              (freq === "once" ? "Une seule fois" : frequencies[freq]) +
                " · " +
                matches.length,
            ),
          );
          for (const item of matches) {
            const row = el("article", undefined, "v60-occurrence " + item.type);
            row.dataset.key = item.key;
            const when = el("div", short(item.date), "v60-date"),
              copy = el("div", undefined, "v60-rec-copy");
            copy.append(
              el("strong", item.description),
              el(
                "small",
                item.account_name + (item.to_name ? " → " + item.to_name : ""),
              ),
              el("small", item.category_name || "Catégorie à choisir"),
            );
            const status = el(
              "span",
              {
                actual: "✓ Réel associé",
                pending: "À confirmer",
                planned: "Prévu",
                skipped: "Annulé",
                outside: "Hors période de suivi",
                covered: "Couvert par l’enveloppe",
              }[item.status] || "Prévu",
              "v60-status " + item.status,
            );
            row.append(
              when,
              copy,
              el(
                "strong",
                (item.type === "income"
                  ? "+"
                  : item.type === "expense"
                    ? "−"
                    : "") +
                  cash(
                    item.status === "actual"
                      ? item.actual_cents
                      : item.planned_cents,
                  ),
                "v60-rec-amount",
              ),
              status,
            );
            const actions = el("div", undefined, "v60-rec-actions");
            if (
              ["pending", "planned"].includes(item.status) &&
              item.type !== "reserve" &&
              latest.planning.rows.some((r) => r.key === item.key)
            )
              actions.append(
                button("Confirmer", () =>
                  window.budgetPlanningAction(item.key, "confirm"),
                ),
              );
            if (["income", "expense"].includes(item.type))
              actions.append(button("Classer", () => classifyRule(item)));
            actions.append(
              button("Modifier la règle", () =>
                runtime.editRule(item.recurring_id),
              ),
            );
            row.append(actions);
            group.append(row);
          }
          recList.append(group);
        }
        if (!items.length)
          recList.append(
            el(
              "p",
              "Aucune échéance pour ces filtres. Ajoutez une récurrence ou choisissez un autre mois.",
              "v60-empty",
            ),
          );
      } catch (e) {
        if (mine === recTicket)
          recList.replaceChildren(el("p", e.message, "v60-error"));
      }
    }
    function calendarText(calendar, plan) {
      return calendar.count === null
        ? "Calendrier à choisir : aucune moyenne utilisée."
        : calendar.count +
            " occurrence" +
            (calendar.count === 1 ? "" : "s") +
            " × " +
            cash(plan.amount_cents) +
            " ce mois" +
            (calendar.name ? " · " + calendar.name : "");
    }
    const previous = runtime.render;
    runtime.render = function (s) {
      previous(s);
      latest = s;
      load();
      drawRecurring();
    };
    if (typeof runtime.state !== "undefined" && runtime.state) {
      latest = runtime.state;
      load();
      drawRecurring();
    }
  })();
}
