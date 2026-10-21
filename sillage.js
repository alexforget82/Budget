// Domain initializer. Shared state and rendering hooks are explicit dependencies.
export function initialize(runtime) {
  /* Sillage, second generation. Existing financial engines remain authoritative. */
  (() => {
    "use strict";
    const $ = (id) => document.getElementById(id),
      n = (tag, text, cls) => {
        const e = document.createElement(tag);
        if (text !== undefined) e.textContent = text;
        if (cls) e.className = cls;
        return e;
      },
      b = (text, fn, cls = "secondary") => {
        const e = n("button", text, cls);
        e.type = "button";
        e.onclick = fn;
        return e;
      },
      money = (c) =>
        (c / 100).toLocaleString("fr-CA", {
          style: "currency",
          currency: "CAD",
        }),
      go = (view) =>
        document.querySelector(`.app-shell-nav [data-view="${view}"]`).click(),
      field = (name, input) => {
        const l = n("label", name);
        input.setAttribute("aria-label", name);
        l.append(input);
        return l;
      };
    let current,
      reviewTicket = 0,
      reportTicket = 0,
      detailTicket = 0;
    async function request(url, payload) {
      const response = await fetch(
          url,
          payload === undefined
            ? { cache: "no-store" }
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
        ),
        out = await response.json();
      if (!response.ok) throw Error(out.error || "Opération impossible.");
      return out;
    }
    const toast = n("div", undefined, "sillage-toast");
    toast.id = "sillage-toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
    let toastTimer;
    function notify(text) {
      clearTimeout(toastTimer);
      toast.replaceChildren(
        n("span", text),
        b("Annuler", () => {
          $("v41-undo").click();
          toast.hidden = true;
        }),
        b("Fermer", () => (toast.hidden = true)),
      );
      toast.hidden = false;
      toastTimer = setTimeout(() => (toast.hidden = true), 7000);
    }
    toast.hidden = true;
    $("transaction-dialog").addEventListener("close", () =>
      document.querySelector(".sillage-refund-note")?.remove(),
    );
    const previousSend = runtime.send;
    runtime.send = async function (url, payload) {
      const ok = await previousSend(url, payload);
      if (ok && !/preview|simulate|reconcile$/.test(url))
        notify("Modification enregistrée.");
      return ok;
    };
    const sort = n("select");
    sort.id = "sillage-sort";
    for (const [value, label] of [
      ["date:desc", "Date · plus récentes"],
      ["date:asc", "Date · plus anciennes"],
      ["amount:asc", "Montant · croissant"],
      ["amount:desc", "Montant · décroissant"],
      ["description:asc", "Description · A à Z"],
      ["account:asc", "Compte · A à Z"],
      ["category:asc", "Catégorie · A à Z"],
    ])
      sort.add(new Option(label, value));
    document
      .querySelector(".register-tools")
      .append(field("Trier tout l’historique", sort));
    sort.onchange = () => {
      $("section-transactions").classList.toggle(
        "sillage-sorted",
        !sort.value.startsWith("date:"),
      );
      $("v2-account").dispatchEvent(new Event("change", { bubbles: true }));
    };
    const ledgerHead = n("div", undefined, "sillage-ledger-head");
    for (const [label, key] of [
      ["Description", "description"],
      ["Catégorie", "category"],
      ["Montant", "amount"],
    ])
      ledgerHead.append(
        b(label, () => {
          sort.value =
            key + ":" + (sort.value === key + ":asc" ? "desc" : "asc");
          if (!sort.value) {
            sort.add(new Option(label + " · décroissant", key + ":desc"));
            sort.value = key + ":desc";
          }
          sort.onchange();
        }),
      );
    ledgerHead.append(n("span", "Révision"));
    $("v2-transaction-list").before(ledgerHead);
    // Put the register first; keep occasional tools folded without losing their controls.
    const register = $("section-transactions"),
      advanced = register.querySelector(".register-advanced");
    register.querySelector(".register-search-row").append(sort.parentElement);
    advanced.append(register.querySelector(".v80-saved-filters"));
    ledgerHead.append(n("span", "Actions"));
    let compact = true;
    try {
      compact =
        localStorage.getItem("sillage-register-density") !== "comfortable";
    } catch {}
    const density = b(
      "",
      () => {
        compact = !compact;
        applyDensity();
        try {
          localStorage.setItem(
            "sillage-register-density",
            compact ? "compact" : "comfortable",
          );
        } catch {}
      },
      "secondary",
    );
    density.id = "register-density";
    function applyDensity() {
      register.classList.toggle("register-compact", compact);
      density.textContent = compact ? "Vue aérée" : "Vue compacte";
      density.setAttribute("aria-pressed", String(compact));
      density.setAttribute("aria-label", "Affichage compact des transactions");
    }
    const registerTop = n("div", undefined, "register-top");
    const registerHeading = register.querySelector(".section-head");
    registerHeading.before(registerTop);
    registerTop.append(
      registerHeading,
      register.querySelector(".register-summary"),
    );
    register.querySelector(".page-actions").append(density);
    applyDensity();

    const inspector = n("dialog", undefined, "editor-dialog sillage-inspector");
    inspector.id = "sillage-inspector";
    inspector.setAttribute("aria-label", "Détail de l’opération");
    const inside = n("div", undefined, "dialog-inner");
    inspector.append(inside);
    document.body.append(inspector);
    inspector.addEventListener("close", () => detailTicket++);
    async function inspect(id) {
      const ticket = ++detailTicket;
      inside.replaceChildren(n("p", "Chargement…"));
      if (!inspector.open) inspector.showModal();
      try {
        const t = await request("/api/pro/transaction?id=" + id);
        if (ticket !== detailTicket || !inspector.open) return;
        inside.replaceChildren();
        const head = n("div", undefined, "dialog-heading");
        head.append(
          n("h2", t.description),
          b("Fermer", () => inspector.close()),
        );
        inside.append(
          head,
          n("strong", money(t.amount_cents), "sillage-detail-amount"),
          n("p", t.happened_on + " · " + t.account_name, "quiet-copy"),
        );
        for (const [label, value] of [
          [
            "Catégorie",
            t.category_name +
              (t.subcategory_name ? " › " + t.subcategory_name : ""),
          ],
          ["Enveloppe", t.envelope_name || "Aucune"],
          [
            "Solde bancaire",
            t.affects_balance === 0
              ? "Historique sans effet sur le solde"
              : "Opération appliquée au solde",
          ],
          ["Révision", t.reviewed ? "Vérifiée" : "À vérifier"],
        ]) {
          const line = n("div", undefined, "sillage-detail-line");
          line.append(n("span", label), n("strong", value));
          inside.append(line);
        }
        const category = n("select"),
          sub = n("select"),
          review = n("input");
        category.add(new Option("Non-catégorisé", ""));
        for (const c of current.categories.filter(
          (c) => !c.archived || c.id === t.category_id,
        ))
          category.add(new Option(c.name, c.id));
        category.value = String(t.category_id || "");
        function subs() {
          sub.replaceChildren(new Option("Sans sous-catégorie", ""));
          for (const s of current.subcategories.filter(
            (s) => s.category_id === Number(category.value) && !s.archived,
          ))
            sub.add(new Option(s.name, s.id));
        }
        category.onchange = subs;
        subs();
        sub.value = String(t.subcategory_id || "");
        review.type = "checkbox";
        review.checked = !!t.reviewed;
        const form = n("form", undefined, "sillage-form"),
          error = n("p", undefined, "sillage-error"),
          result = n("div");
        error.setAttribute("role", "alert");
        const preview = n("button", "Vérifier le classement", "primary");
        preview.type = "submit";
        form.append(
          n("h3", "Classement rapide"),
          field("Catégorie de l’opération", category),
          field("Sous-catégorie de l’opération", sub),
          field("Opération vérifiée", review),
          preview,
          error,
          result,
        );
        let editVersion = 0;
        form.oninput = form.onchange = () => {
          editVersion++;
          result.replaceChildren();
        };
        form.onsubmit = async (event) => {
          event.preventDefault();
          const version = editVersion;
          preview.disabled = true;
          error.textContent = "";
          try {
            const payload = {
                ids: [t.id],
                changes: {
                  category_id: category.value ? Number(category.value) : null,
                  subcategory_id: sub.value ? Number(sub.value) : null,
                  reviewed: review.checked,
                },
              },
              out = await request("/api/workspace/bulk-preview", payload);
            if (version !== editVersion || !inspector.open) return;
            result.replaceChildren(
              n(
                "p",
                "Les soldes et les enveloppes restent identiques.",
                "quiet-copy",
              ),
              b(
                "Confirmer le classement",
                async () => {
                  try {
                    const s = await request("/api/workspace/bulk-apply", {
                      ...payload,
                      token: out.token,
                    });
                    runtime.render(s);
                    window.budgetRefreshTransactions();
                    inspector.close();
                    notify("Classement enregistré.");
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
          } finally {
            preview.disabled = false;
          }
        };
        inside.append(
          form,
          b("Modifier le montant, la date ou le compte", () => {
            inspector.close();
            window.v2Edit("transaction", t.id);
          }),
        );
        if (t.amount_cents < 0)
          inside.append(
            b("Préparer un remboursement", () => {
              inspector.close();
              window.dispatchEvent(
                new CustomEvent("budget:repeat-transaction", {
                  detail: {
                    ...t,
                    amount_cents: -t.amount_cents,
                    description: "Remboursement · " + t.description,
                  },
                }),
              );
              const note =
                $("transaction").querySelector(".sillage-refund-note") ||
                n("p", undefined, "quiet-copy sillage-refund-note");
              note.textContent =
                "Remboursement à vérifier : choisissez le compte qui reçoit réellement le crédit et le montant remboursé. Rien n’est enregistré avant confirmation. La réserve inutilisée d’une enveloppe n’est pas recréée automatiquement.";
              $("transaction").append(note);
            }),
          );
      } catch (e) {
        if (ticket === detailTicket)
          inside.replaceChildren(
            n("p", e.message, "sillage-error"),
            b("Fermer", () => inspector.close()),
          );
      }
    }
    window.sillageInspect = inspect;
    document.addEventListener("budget:transactions-loaded", (event) => {
      for (const t of event.detail.rows) {
        const row = document.querySelector(
          `.ledger-row[data-transaction-id="${t.id}"]`,
        );
        if (!row) continue;
        const name = row.querySelector(".ledger-name");
        name.onclick = () => inspect(t.id);
        name.setAttribute("aria-label", "Consulter " + t.description);
        const view = b("Consulter", () => inspect(t.id));
        row.querySelector(".ledger-menu-items").prepend(view);
        const when = n(
          "time",
          new Date(t.happened_on + "T12:00:00").toLocaleDateString("fr-CA", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          "sillage-row-date",
        );
        when.dateTime = t.happened_on;
        when.title = "Date de la transaction : " + t.happened_on;
        row.querySelector(".ledger-meta").append(when);
      }
    });
    const reviewHost = $("sillage-review");
    async function loadReview() {
      const ticket = ++reviewTicket;
      reviewHost.setAttribute("aria-busy", "true");
      try {
        const out = await request(
          "/api/pro/overview?month=" + runtime.today().slice(0, 7),
        );
        if (ticket !== reviewTicket) return;
        const r = out.review;
        reviewHost.replaceChildren(
          n(
            "p",
            "Les signalements sont des invitations à vérifier. Aucun doublon n’est supprimé et aucun solde n’est corrigé automatiquement.",
            "quiet-copy",
          ),
        );
        const summary = n("div", undefined, "sillage-review-summary");
        for (const [label, count] of [
          ["À vérifier", r.unreviewed.count],
          ["Sans catégorie", r.uncategorized.count],
          ["Groupes semblables", r.duplicates.length],
          ["Échéances à confirmer", r.due.length],
        ]) {
          const c = n("div", undefined, "sillage-surface");
          c.append(n("span", label), n("strong", String(count)));
          summary.append(c);
        }
        reviewHost.append(summary);
        function queue(title, data, filter) {
          const box = n("details", undefined, "sillage-surface");
          box.open = !!data.count;
          box.append(n("summary", title + " · " + data.count));
          for (const t of data.items) {
            const row = n("div", undefined, "sillage-review-row");
            row.append(
              n(
                "span",
                t.description + " · " + t.happened_on + " · " + t.account_name,
              ),
              n("strong", money(t.amount_cents)),
              b("Examiner", () => inspect(t.id)),
            );
            box.append(row);
          }
          if (!data.count) box.append(n("p", "Tout est à jour.", "quiet-copy"));
          if (data.count > data.items.length)
            box.append(
              b("Voir toutes les opérations", () => {
                go("transactions");
                $("v2-review").value = filter === "review" ? "0" : "";
                if ($("v46-subcategory-filter"))
                  $("v46-subcategory-filter").value = "";
                $("v3-category-filter").value =
                  filter === "category" ? "uncategorized" : "";
                $("v2-search").value = "";
                $("v2-account").value = "";
                $("v2-kind").value = "";
                $("v3-date-from").value = "";
                $("v3-date-to").value = "";
                $("v2-account").dispatchEvent(
                  new Event("change", { bubbles: true }),
                );
              }),
            );
          reviewHost.append(box);
        }
        queue("Opérations à vérifier", r.unreviewed, "review");
        queue("Opérations sans catégorie", r.uncategorized, "category");
        const duplicate = n("details", undefined, "sillage-surface");
        duplicate.append(
          n(
            "summary",
            "Doublons possibles · " +
              r.duplicates.length +
              (r.duplicates.length === r.duplicates_limit
                ? " premiers groupes"
                : ""),
          ),
        );
        for (const t of r.duplicates) {
          const row = n("div", undefined, "sillage-review-row");
          row.append(
            n(
              "span",
              t.description +
                " · " +
                t.happened_on +
                " · " +
                t.count +
                " opérations · " +
                (current.accounts.find((a) => a.id === t.account_id)?.name ||
                  ""),
            ),
            n("strong", money(t.amount_cents)),
            b("Comparer", () => {
              go("transactions");
              for (const id of [
                "v2-review",
                "v2-kind",
                "v3-category-filter",
                "v46-subcategory-filter",
              ])
                if ($(id)) $(id).value = "";
              $("v2-search").value = t.description;
              $("v2-account").value = String(t.account_id);
              $("v3-date-from").value = $("v3-date-to").value = t.happened_on;
              $("v2-account").dispatchEvent(
                new Event("change", { bubbles: true }),
              );
            }),
          );
          duplicate.append(row);
        }
        reviewHost.append(duplicate);
        const due = n("details", undefined, "sillage-surface");
        due.append(n("summary", "Échéances à confirmer · " + r.due.length));
        for (const t of r.due) {
          const row = n("div", undefined, "sillage-review-row");
          row.append(
            n("span", t.date + " · " + t.description),
            n("strong", money(t.remaining_cents)),
            b("Consulter le calendrier", () =>
              window.budgetExploreCalendar(t.date),
            ),
          );
          due.append(row);
        }
        reviewHost.append(due);
        const bank = n("div", undefined, "sillage-surface");
        bank.append(n("h3", "Comptes et sauvegardes"));
        for (const a of current.accounts) {
          const check = r.bank_checks.find((c) => c.account_id === a.id),
            row = n("div", undefined, "sillage-review-row");
          row.append(
            n(
              "span",
              a.name +
                " · " +
                (check?.current
                  ? "rapprochement à jour"
                  : check?.checked_at
                    ? "opérations modifiées depuis le rapprochement"
                    : "à rapprocher"),
            ),
            n("strong", money(a.balance_cents)),
            b("Rapprocher", () => window.budgetOpenBankCheck(a.id)),
          );
          bank.append(row);
        }
        bank.append(
          n(
            "p",
            r.backup.error ||
              (r.backup.last_at
                ? "Dernière copie quotidienne : " +
                  new Date(r.backup.last_at).toLocaleString("fr-CA")
                : "Aucune copie quotidienne disponible."),
            "quiet-copy",
          ),
          b("Ouvrir les sauvegardes", () => go("sauvegardes")),
          b(
            current.setup70.completed
              ? "Revoir la configuration"
              : "Continuer la configuration",
            () => go("demarrage"),
          ),
        );
        reviewHost.append(bank);
      } catch (e) {
        if (ticket === reviewTicket)
          reviewHost.replaceChildren(
            n("p", e.message, "sillage-error"),
            b("Réessayer", loadReview),
          );
      } finally {
        if (ticket === reviewTicket) reviewHost.removeAttribute("aria-busy");
      }
    }
    document
      .querySelector("[data-view=verification]")
      .addEventListener("click", loadReview);
    const report = n("div", undefined, "sillage-comparison");
    report.id = "sillage-comparison";
    $("monthly-summary").before(report);
    async function compare() {
      const ticket = ++reportTicket;
      report.setAttribute("aria-busy", "true");
      try {
        const out = await request(
          "/api/pro/overview?" +
            new URLSearchParams({
              month: $("report-month").value,
              account: $("report-account").value,
            }),
        );
        if (ticket !== reportTicket) return;
        report.replaceChildren(
          n("h2", "Votre trajectoire sur six mois"),
          n(
            "p",
            out.partial
              ? "Mois en cours : comparaison provisoire avec le mois précédent complet."
              : out.future
                ? "Mois futur : seules les opérations déjà enregistrées sont affichées."
                : "Opérations enregistrées, hors virements. Les crédits, y compris remboursements, sont comptés dans les entrées.",
            "quiet-copy",
          ),
        );
        const grid = n("div", undefined, "sillage-months"),
          max = Math.max(
            1,
            ...out.months.flatMap((m) => [m.income_cents, m.expense_cents]),
          );
        for (const m of out.months) {
          const col = n("div", undefined, "sillage-month");
          col.append(n("strong", m.month));
          for (const [label, key] of [
            ["Entrées", "income_cents"],
            ["Sorties", "expense_cents"],
          ]) {
            const bar = n("div", undefined, "sillage-bar " + key);
            bar.style.setProperty("--size", (m[key] / max) * 100 + "%");
            bar.setAttribute("aria-hidden", "true");
            col.append(bar, n("small", label + " " + money(m[key])));
          }
          col.append(n("span", "Écart " + money(m.net_cents)));
          grid.append(col);
        }
        report.append(
          n(
            "p",
            "Entrées = tous les crédits, remboursements compris; sorties = achats bruts. L’écart n’est pas une mesure du patrimoine. Les virements entre comptes sont exclus.",
            "quiet-copy",
          ),
        );
        report.append(
          grid,
          n("h3", "Ce qui change depuis " + out.previous.month),
        );
        for (const c of out.changes
          .filter((c) => c.delta_cents !== 0)
          .slice(0, 8)) {
          const row = n("div", undefined, "sillage-review-row");
          row.append(
            n("span", c.name),
            n("span", money(c.previous_cents) + " → " + money(c.current_cents)),
            n("strong", (c.delta_cents > 0 ? "+" : "") + money(c.delta_cents)),
          );
          report.append(row);
        }
        if (!out.changes.some((c) => c.delta_cents))
          report.append(
            n("p", "Aucune variation des achats enregistrés.", "quiet-copy"),
          );
      } catch (e) {
        if (ticket === reportTicket)
          report.replaceChildren(
            n("p", e.message, "sillage-error"),
            b("Réessayer", compare),
          );
      } finally {
        if (ticket === reportTicket) report.removeAttribute("aria-busy");
      }
    }
    document
      .querySelector("[data-view=bilan]")
      .addEventListener("click", compare);
    for (const id of ["report-month", "report-account"])
      $(id).addEventListener("change", compare);
    const health = b(
      "État des données",
      () => go("verification"),
      "sillage-health",
    );
    document.querySelector(".workspace-header").append(health);
    health.title = "Comptes, vérifications et sauvegardes";
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.target.matches("input,textarea,select,[contenteditable=true]") &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        go("transactions");
        $("v2-search").focus();
      }
    });

    // Essential home keeps the canonical metrics; the personalized dashboard remains available.
    const home = $("app-dashboard"),
      homeHero = $("v80-hero"),
      homeAlerts = n("section", undefined, "home-alerts");
    homeAlerts.id = "home-alerts";
    homeAlerts.setAttribute("aria-label", "À surveiller");
    homeHero.after(homeAlerts);
    let essential = true;
    try {
      essential = localStorage.getItem("sillage-home-mode") !== "detailed";
    } catch {}
    const homeToggle = b("", () => {
      essential = !essential;
      paintHome();
      try {
        localStorage.setItem(
          "sillage-home-mode",
          essential ? "essential" : "detailed",
        );
      } catch {}
    });
    homeToggle.id = "home-mode";
    homeToggle.setAttribute("aria-controls", "dashboard-widgets");
    document.querySelector(".v47-toolbar-actions").prepend(homeToggle);

    const dailyDialog = n(
      "dialog",
      undefined,
      "editor-dialog home-daily-dialog",
    );
    dailyDialog.id = "home-daily-dialog";
    dailyDialog.setAttribute("aria-labelledby", "home-daily-title");
    const dailyInside = n("div", undefined, "dialog-inner"),
      dailyHeading = n("div", undefined, "dialog-heading"),
      dailyTitle = n("h2", "Disponible jour par jour");
    dailyTitle.id = "home-daily-title";
    dailyHeading.append(
      dailyTitle,
      b("Fermer", () => dailyDialog.close()),
    );
    const dailyChoices = n("div", undefined, "v80-segment");
    dailyChoices.setAttribute("role", "group");
    dailyChoices.setAttribute("aria-label", "Période du disponible quotidien");
    let dailyDays = 30;
    const dailyNow = n("p", undefined, "home-daily-now"),
      dailyList = n("div", undefined, "home-daily-list");
    dailyList.setAttribute("role", "list");
    dailyList.setAttribute("aria-label", "Safe-to-Spend prévu par jour");
    dailyList.tabIndex = 0;
    for (const days of [30, 60, 90]) {
      const choice = b(days + " jours", () => {
        dailyDays = days;
        drawDaily();
        dailyList.scrollTop = 0;
      });
      choice.dataset.days = days;
      dailyChoices.append(choice);
    }
    dailyInside.append(
      dailyHeading,
      n(
        "p",
        "Disponible prévu en fin de journée, après les enveloppes et les protections.",
        "quiet-copy",
      ),
      dailyChoices,
      dailyNow,
      dailyList,
      b("Actualiser les montants", () => $("v21-refresh").click()),
    );
    dailyDialog.append(dailyInside);
    document.body.append(dailyDialog);
    function drawDaily() {
      if (!current) return;
      const scroll = dailyList.scrollTop;
      dailyNow.textContent =
        "Disponible maintenant : " + money(current.safe_cents);
      for (const choice of dailyChoices.children)
        choice.setAttribute(
          "aria-pressed",
          String(Number(choice.dataset.days) === dailyDays),
        );
      dailyList.replaceChildren();
      for (const day of current.forecast.slice(0, dailyDays)) {
        const row = n("div", undefined, "home-daily-row"),
          date = n(
            "time",
            new Date(day.date + "T12:00:00").toLocaleDateString("fr-CA", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          ),
          amount = n("strong", money(day.safe_cents));
        row.setAttribute("role", "listitem");
        date.dateTime = day.date;
        amount.classList.toggle("v80-negative", day.safe_cents < 0);
        row.append(date, amount);
        dailyList.append(row);
      }
      dailyList.scrollTop = scroll;
    }
    const dailyOpen = b("Disponible jour par jour", () => {
      if (!current) return;
      dailyDays = Number(
        homeHero.querySelector("[aria-pressed=true]")?.dataset.horizon || 30,
      );
      drawDaily();
      dailyList.scrollTop = 0;
      dailyDialog.showModal();
    });
    dailyOpen.id = "home-daily-open";
    dailyOpen.setAttribute("aria-haspopup", "dialog");
    dailyOpen.setAttribute("aria-controls", "home-daily-dialog");
    document.querySelector(".v47-toolbar-actions").prepend(dailyOpen);
    function paintHome() {
      home.classList.toggle("home-essential", essential);
      homeToggle.textContent = essential
        ? "Voir tous les tableaux"
        : "Revenir à l’essentiel";
      homeToggle.setAttribute("aria-expanded", String(!essential));
    }
    paintHome();
    function drawHomeAlerts(s) {
      const horizon = Number(
          homeHero.querySelector("[aria-pressed=true]")?.dataset.horizon || 30,
        ),
        start = s.forecast[0].date,
        days = [
          { date: start, safe_cents: s.safe_cents, now: true },
          ...s.forecast.slice(0, horizon),
        ],
        negative = days.find((d) => d.safe_cents < 0),
        low = days.find((d) => d.safe_cents < 10000),
        due = s.planning.rows
          .filter(
            (r) =>
              ["planned", "pending"].includes(r.status) &&
              r.type !== "reserve" &&
              r.remaining_cents > 0 &&
              r.date <= start,
          )
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) || a.key.localeCompare(b.key),
          );
      const minimum = [
          { date: "now", safe_cents: s.safe_cents },
          ...s.forecast.slice(0, horizon),
        ].reduce((a, b) => (b.safe_cents < a.safe_cents ? b : a)),
        income = s.forecast
          .slice(0, horizon)
          .find((d) =>
            d.events.some(
              (e) =>
                e.type === "income" &&
                e.cash_impact_cents !== 0 &&
                e.amount_cents > 0,
            ),
          );
      for (const [card, on, label] of [
        [
          homeHero.querySelector(".v80-hero-facts>div:nth-child(2)"),
          minimum.date,
          "Voir le calcul du minimum prévu",
        ],
        [
          homeHero.querySelector(".v80-hero-facts>div:nth-child(3)"),
          income?.date,
          "Voir la prochaine rentrée d’argent",
        ],
      ]) {
        if (on) {
          card.setAttribute("role", "button");
          card.tabIndex = 0;
          card.setAttribute("aria-label", label);
          card.onclick = () =>
            label.startsWith("Voir le calcul")
              ? window.budgetExplainAvailable(minimum.date)
              : window.budgetExploreForecast(on, horizon);
          card.onkeydown = (event) => {
            if (["Enter", " "].includes(event.key)) {
              event.preventDefault();
              card.click();
            }
          };
        } else {
          card.removeAttribute("role");
          card.removeAttribute("tabindex");
          card.removeAttribute("aria-label");
          card.onclick = card.onkeydown = null;
        }
      }
      homeAlerts.replaceChildren();
      if (!s.accounts.some((a) => a.included && a.kind !== "credit")) {
        homeAlerts.append(
          n(
            "p",
            "Configurez le compte du disponible pour commencer.",
            "quiet-copy",
          ),
          b("Configurer mon budget", () => go("demarrage")),
        );
        return;
      }
      const heading = n("div", undefined, "home-alert-heading");
      heading.append(
        n("h3", "À surveiller"),
        n("small", "Sur les " + horizon + " prochains jours"),
        b("Actualiser le tableau de bord", () => $("v21-refresh").click()),
      );
      homeAlerts.append(heading);
      if (negative || low) {
        const point = negative || low,
          item = n(
            "div",
            undefined,
            "home-alert " +
              (negative ? "home-alert-danger" : "home-alert-caution"),
          ),
          copy = n("div"),
          when =
            point.date === start
              ? "aujourd’hui"
              : "le " +
                new Date(point.date + "T12:00:00").toLocaleDateString("fr-CA", {
                  day: "numeric",
                  month: "long",
                });
        copy.append(
          n(
            "strong",
            negative
              ? point.now
                ? "Votre disponible actuel est négatif de " +
                  money(-point.safe_cents) +
                  "."
                : "Un manque de " +
                  money(-point.safe_cents) +
                  " est prévu " +
                  when +
                  "."
              : point.now
                ? "Votre disponible actuel est inférieur à 100 $."
                : "Votre disponible passe sous 100 $ " + when + ".",
          ),
          n(
            "small",
            "Disponible prévu : " +
              money(point.safe_cents) +
              " après les protections.",
          ),
        );
        item.append(
          copy,
          b(point.now ? "Comprendre ce montant" : "Voir cette date", () =>
            point.now
              ? window.budgetExplainAvailable("now")
              : window.budgetExploreForecast(point.date, horizon),
          ),
        );
        homeAlerts.append(item);
      }
      if (due.length) {
        const item = n("div", undefined, "home-alert"),
          copy = n("div");
        copy.append(
          n(
            "strong",
            due.length + " opération(s) prévue(s) restent à confirmer.",
          ),
          n(
            "small",
            due
              .slice(0, 2)
              .map((r) => r.description)
              .join(" · ") + (due.length > 2 ? " · …" : ""),
          ),
        );
        item.append(
          copy,
          b("Vérifier les opérations", () => window.budgetOpenPlanningQueue()),
        );
        homeAlerts.append(item);
      }
      const warnings = s.planning.warnings || [];
      if (warnings.length) {
        const item = n("div", undefined, "home-alert");
        item.append(
          n(
            "strong",
            warnings.length + " point(s) de configuration à vérifier.",
          ),
          b("Vérifier la configuration", () => {
            window.budgetExploreForecast(start, horizon);
            $("v4-forecast-audit").open = true;
            $("planning-notices").scrollIntoView({ block: "center" });
          }),
        );
        homeAlerts.append(item);
      }
      if (!negative && !low && !due.length && !warnings.length)
        homeAlerts.append(
          n(
            "p",
            "Aucun passage sous 100 $ prévu sur cette période et aucune échéance à confirmer.",
            "home-all-clear",
          ),
        );
      homeAlerts.append(
        n(
          "p",
          "Le seuil de 100 $ est un repère visuel; il ne réserve pas d’argent.",
          "home-alert-note",
        ),
      );
    }
    homeHero.addEventListener("click", (event) => {
      if (event.target.closest("[data-horizon]") && current)
        drawHomeAlerts(current);
    });
    function draw(s) {
      current = s;
      drawHomeAlerts(s);
      if (dailyDialog.open) drawDaily();
      $("app-version").textContent = s.version === "12.0.0" ? "v12.0.0" : "Interface v12.0.0 · serveur v" + s.version;
      $("app-version").title =
        "Deuxième génération · version technique " + s.version;
      health.textContent = s.support41.backup.error
        ? "Sauvegarde à vérifier"
        : "État des données";
      health.title =
        s.support41.backup.error ||
        (s.support41.backup.last_at
          ? "Dernière copie : " +
            new Date(s.support41.backup.last_at).toLocaleString("fr-CA")
          : "Aucune copie quotidienne disponible.");
      if (
        document
          .querySelector("[data-view=verification]")
          .classList.contains("active")
      )
        loadReview();
      if (
        document.querySelector("[data-view=bilan]").classList.contains("active")
      )
        compare();
    }
    const previousRender = runtime.render;
    runtime.render = function (s) {
      previousRender(s);
      draw(s);
    };
    if (typeof runtime.state !== "undefined" && runtime.state)
      draw(runtime.state);
    document.body.classList.add("sillage-app");
    window.budgetRefreshTransactions?.();
  })();
}
