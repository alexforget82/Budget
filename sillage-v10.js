// Domain initializer. Shared state and rendering hooks are explicit dependencies.
export function initialize(runtime) {
  /* V10 composes existing ledger workflows; simulations never record transactions. */
  (() => {
    const $ = (id) => document.getElementById(id),
      el = (tag, text, cls) => {
        const n = document.createElement(tag);
        if (text !== undefined) n.textContent = text;
        if (cls) n.className = cls;
        return n;
      },
      money = (n) =>
        (n / 100).toLocaleString("fr-CA", {
          style: "currency",
          currency: "CAD",
        }),
      button = (text, fn) => {
        const b = el("button", text, "secondary");
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
      go = (id) =>
        document.querySelector(`.app-shell-nav [data-view="${id}"]`).click();
    let current = typeof runtime.state !== "undefined" ? runtime.state : null;
    async function request(url, payload) {
      const r = await fetch(
          url,
          payload === undefined
            ? { cache: "no-store" }
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
        ),
        data = await r.json();
      if (!r.ok) throw Error(data.error || "Opération impossible.");
      return data;
    }
    function dialog(id, title) {
      const d = el("dialog", undefined, "editor-dialog v10-dialog"),
        inside = el("div", undefined, "dialog-inner"),
        head = el("div", undefined, "dialog-heading");
      d.id = id;
      d.setAttribute("aria-label", title);
      head.append(
        el("h2", title),
        button("Fermer", () => d.close()),
      );
      inside.append(head);
      d.append(inside);
      document.body.append(d);
      return { d, inside };
    }
    // Transaction workbench uses the entire canonical ledger, not just the visible page.
    const work = el("details", undefined, "v10-panel");
    work.id = "v10-workbench";
    work.append(el("summary", "Centre de transactions à traiter"));
    const workBody = el("div");
    work.append(workBody);
    $("section-transactions").querySelector(".register-top").before(work);
    function filterRecords(kind) {
      for (const id of [
        "v2-search",
        "v2-account",
        "v2-kind",
        "v2-review",
        "v3-category-filter",
        "v3-date-from",
        "v3-date-to",
      ])
        $(id).value = "";
      window.budgetSetSubcategory?.("v3-category-filter", null);
      $("transactions-period").value = "all";
      if (kind === "pending") $("v2-review").value = "0";
      if (kind === "uncategorized")
        $("v3-category-filter").value = "uncategorized";
      $("v2-account").dispatchEvent(new Event("change", { bubbles: true }));
    }
    function drawWork() {
      const tx = current.calendar_actuals || [],
        pending = tx.filter((t) => !t.reviewed),
        uncat = tx.filter((t) => !t.category_id),
        groups = new Map();
      for (const t of tx) {
        const key = JSON.stringify([
          t.account_id,
          t.happened_on,
          t.amount_cents,
          t.description.trim().toLocaleLowerCase("fr-CA"),
        ]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      }
      const duplicates = [...groups.values()].filter((g) => g.length > 1);
      workBody.replaceChildren(
        el(
          "p",
          "Importez, classez puis associez les opérations réelles au prévu. La sélection multiple reste disponible dans la liste.",
          "quiet-copy",
        ),
      );
      const actions = el("div", undefined, "v10-actions");
      actions.append(
        button("Importer un relevé CSV", () => go("importer")),
        button("À vérifier · " + pending.length, () =>
          filterRecords("pending"),
        ),
        button("Sans catégorie · " + uncat.length, () =>
          filterRecords("uncategorized"),
        ),
        button("Doublons possibles · " + duplicates.length, () => {
          go("verification");
        }),
      );
      workBody.append(
        actions,
        el(
          "p",
          "Aucune suppression ni association automatique. Les totaux portent sur tout l’historique chargé.",
          "quiet-copy",
        ),
      );
    }
    const match = dialog("v10-match", "Associer au prévu");
    function openMatch(t) {
      while (match.inside.children.length > 1) match.inside.lastChild.remove();
      const used = new Set(current.planning.rows.flatMap((r) => r.actual_ids)),
        claimed =
          used.has("transaction:" + t.id) ||
          (current.planning.envelope_actual_links || []).some(
            (l) => l.transaction_id === t.id,
          ),
        rows = claimed
          ? []
          : current.planning.rows.filter(
              (r) =>
                ["recurring", "envelope"].includes(r.source) &&
                ["planned", "pending"].includes(r.status) &&
                r.type === (t.amount_cents < 0 ? "expense" : "income") &&
                r.account_id === t.account_id &&
                (!t.envelope_id || t.envelope_id === r.envelope_id) &&
                Math.abs(Date.parse(r.date) - Date.parse(t.happened_on)) <=
                  7 * 86400000,
            );
      match.inside.append(
        el(
          "p",
          t.description + " · " + money(t.amount_cents) + " · " + t.happened_on,
        ),
        el(
          "p",
          "Choisissez une échéance à proximité (±7 jours). Vérifiez le montant avant de valider. Associer cette transaction ne débitera pas une seconde fois le compte.",
          "quiet-copy",
        ),
      );
      if (!rows.length)
        match.inside.append(
          el(
            "p",
            claimed
              ? "Cette opération est déjà associée à une prévision."
              : "Aucune échéance compatible à proximité. Consultez le calendrier si la date est plus éloignée.",
          ),
        );
      for (const r of rows)
        match.inside.append(
          button(
            r.date + " · " + r.description + " · " + money(r.remaining_cents),
            () => {
              match.d.close();
              window.budgetPlanningAction(r.key, "confirm", { actualId: t.id });
            },
          ),
        );
      match.d.showModal();
    }
    // Propose a match only after a successful manual creation, never on import/edit/refresh.
    const suggestion = dialog(
      "v111-match",
      "Associer cette transaction au prévu ?",
    );
    function matchingRows(t) {
      const used = new Set(
        current.planning.rows.flatMap((r) => r.actual_ids || []),
      );
      if (
        used.has("transaction:" + t.id) ||
        (current.planning.envelope_actual_links || []).some(
          (l) => l.transaction_id === t.id,
        )
      )
        return [];
      const normalize = (value) =>
        (value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("fr-CA")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      return current.planning.rows
        .filter((r) => {
          if (
            !["recurring", "envelope"].includes(r.source) ||
            !["planned", "pending"].includes(r.status) ||
            r.remaining_cents <= 0 ||
            r.type !== (t.amount_cents < 0 ? "expense" : "income") ||
            r.account_id !== t.account_id ||
            Math.abs(Date.parse(r.date) - Date.parse(t.happened_on)) >
              7 * 86400000
          )
            return false;
          if (t.envelope_id && t.envelope_id !== r.envelope_id) return false;
          if (t.category_id && r.category_id && t.category_id !== r.category_id)
            return false;
          if (
            t.subcategory_id &&
            r.subcategory_id &&
            t.subcategory_id !== r.subcategory_id
          )
            return false;
          return (
            !!(t.envelope_id && t.envelope_id === r.envelope_id) ||
            !!(t.category_id && t.category_id === r.category_id) ||
            normalize(t.description) === normalize(r.description) ||
            normalize(t.description)
              .split(" ")
              .some(
                (word) =>
                  word.length >= 4 &&
                  ![
                    "achat",
                    "paiement",
                    "depense",
                    "revenu",
                    "carte",
                    "compte",
                    "pour",
                    "avec",
                  ].includes(word) &&
                  normalize(r.description).split(" ").includes(word),
              )
          );
        })
        .sort(
          (a, b) =>
            Math.abs(Date.parse(a.date) - Date.parse(t.happened_on)) -
              Math.abs(Date.parse(b.date) - Date.parse(t.happened_on)) ||
            Math.abs(a.remaining_cents - Math.abs(t.amount_cents)) -
              Math.abs(b.remaining_cents - Math.abs(t.amount_cents)),
        );
    }
    function proposeMatch(t) {
      const rows = matchingRows(t);
      if (!rows.length) return;
      while (suggestion.inside.children.length > 1)
        suggestion.inside.lastChild.remove();
      suggestion.inside.append(
        el(
          "p",
          "Transaction enregistrée : " +
            t.description +
            " · " +
            money(t.amount_cents) +
            " · " +
            t.happened_on,
        ),
        el(
          "p",
          "Correspond-elle à une échéance ci-dessous ? L’association ne débite pas le compte une deuxième fois.",
          "quiet-copy",
        ),
      );
      const error = el("p", undefined, "sillage-error");
      error.setAttribute("role", "alert");
      for (const row of rows) {
        const box = el("section", undefined, "v10-panel");
        box.append(
          el("h3", row.description),
          el("p", "Prévu le " + row.date + " · " + money(row.remaining_cents)),
        );
        const complete = el("input");
        complete.type = "checkbox";
        complete.checked = false;
        if (row.source === "envelope")
          box.append(
            field("Aucun autre achat prévu pour cette période", complete),
          );
        box.append(
          button("Associer", async () => {
            const buttons = [...suggestion.d.querySelectorAll("button")];
            buttons.forEach((b) => (b.disabled = true));
            error.textContent = "";
            try {
              const out = await request("/api/planning/action", {
                key: row.key,
                signature: row.signature,
                action: "confirm",
                account_id: t.account_id,
                actual_id: t.id,
                complete_period: row.source !== "envelope" || complete.checked,
                allow_new_payment: false,
              });
              runtime.render(out);
              suggestion.d.close();
              window.budgetRefreshTransactions();
            } catch (e) {
              error.textContent =
                e.message +
                " La transaction reste enregistrée. Vous pouvez réessayer depuis « Associer au prévu ».";
            } finally {
              buttons.forEach((b) => (b.disabled = false));
            }
          }),
        );
        suggestion.inside.append(box);
      }
      suggestion.inside.append(
        error,
        button("Garder séparée", () => suggestion.d.close()),
      );
      suggestion.d.showModal();
    }
    const sendBeforeSuggestion = runtime.send;
    runtime.send = async function (url, data) {
      const manual = url === "/api/transactions",
        before = manual
          ? new Set((current?.calendar_actuals || []).map((t) => t.id))
          : null;
      const ok = await sendBeforeSuggestion(url, data);
      if (ok && manual) {
        const created = (current.calendar_actuals || []).filter(
          (t) =>
            !before.has(t.id) &&
            t.account_id === Number(data.account_id) &&
            t.happened_on === data.happened_on &&
            t.description === data.description &&
            t.amount_cents === Math.round(Number(data.amount) * 100),
        );
        if (created.length === 1) setTimeout(() => proposeMatch(created[0]), 0);
      }
      return ok;
    };
    document.addEventListener("budget:transactions-loaded", (event) => {
      for (const t of event.detail.rows) {
        const row = document.querySelector(
          `.ledger-row[data-transaction-id="${t.id}"]`,
        );
        row?.querySelector(".ledger-menu-items").append(
          button("Associer au prévu", () => {
            row.querySelector(".ledger-menu").open = false;
            openMatch(t);
          }),
        );
      }
    });
    // Compact envelope directory clarifies targets versus actual protected money.
    const envelopes = el("details", undefined, "v10-panel");
    envelopes.id = "v10-envelopes";
    envelopes.append(el("summary", "Mes enveloppes en un coup d’œil"));
    const envelopeList = el("div");
    envelopes.append(
      el(
        "p",
        "L’objectif moins les achats est un repère budgétaire. Seul le montant protégé est retiré du disponible.",
        "quiet-copy",
      ),
      envelopeList,
    );
    $("section-enveloppes").querySelector(".page-intro").after(envelopes);
    function plannedPurchase(e) {
      const target = current.accounts.find(
          (a) => a.id === e.forecast_account_id,
        ),
        sources = current.accounts.filter(
          (a) => a.included && a.kind !== "credit",
        ),
        funding =
          e.forecast_spend &&
          target &&
          target.kind !== "credit" &&
          !target.included &&
          sources.length === 1;
      runtime.resetRec();
      window.appOpenEditor("recurring");
      const f = $("recurring");
      f.elements.id.value = "";
      f.elements.type.value = funding ? "transfer" : "expense";
      f.elements.type.dispatchEvent(new Event("change", { bubbles: true }));
      f.elements.description.value = e.name;
      f.elements.start_on.value = current.forecast[0].date;
      f.elements.frequency.value = "monthly";
      f.elements.one_time.value = "true";
      f.elements.account_id.value = String(
        funding
          ? sources[0].id
          : e.forecast_account_id ||
              current.setup70.scope?.account_id ||
              current.accounts.find((a) => a.included && a.kind !== "credit")
                ?.id ||
              "",
      );
      if (funding) f.elements.to_account_id.value = String(target.id);
      f.elements.envelope_id.value = String(e.id);
      f.elements.type.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function drawEnvelopes() {
      envelopeList.replaceChildren();
      for (const e of current.envelopes) {
        const i = current.envelope_insights.items.find((i) => i.id === e.id);
        if (!i) continue;
        const held = current.sts_breakdown.card_envelopes
            .filter((f) => f.envelope_id === e.id)
            .reduce((n, f) => n + f.amount_cents, 0),
          spent = i.period_start ? i.spent_period_cents : i.spent_month_cents,
          row = el("div", undefined, "v10-row"),
          copy = el("div");
        copy.append(
          el("strong", e.name),
          el(
            "small",
            (!i.period_budget_cents && e.frequency === "none"
              ? "Sans objectif fixe"
              : "Objectif : " + money(i.period_budget_cents)) +
              " · " +
              (i.period_start
                ? "Achats de la période : "
                : "Achats ce mois-ci : ") +
              money(spent) +
              (!i.period_budget_cents && e.frequency === "none"
                ? ""
                : " · Reste sur l’objectif : " +
                  money(i.period_budget_cents - spent)),
          ),
        );
        row.append(
          copy,
          el("strong", "Protégé : " + money(e.reserved_cents + held)),
          button("Détails", () => window.budgetOpenEnvelopeSheet(e.id)),
          button("Achat réel", () => window.budgetDraftEnvelopePurchase(e.id)),
          button("Prévoir un achat", () => plannedPurchase(e)),
        );
        envelopeList.append(row);
      }
      if (!current.envelopes.length)
        envelopeList.append(el("p", "Créez une enveloppe pour commencer."));
    }
    // Scenario laboratory: multiple changes, three alternatives, recalculated on demand.
    const lab = dialog("v10-lab", "Comparer mes scénarios"),
      labForm = el("form"),
      scenarioName = el("input"),
      horizon = el("select"),
      editRows = el("div"),
      saved = el("div"),
      result = el("div"),
      error = el("p", undefined, "sillage-error");
    scenarioName.required = true;
    scenarioName.maxLength = 60;
    scenarioName.value = "Mon scénario";
    horizon.add(new Option("30 jours", "30"));
    horizon.add(new Option("60 jours", "60"));
    horizon.add(new Option("90 jours", "90"));
    error.setAttribute("role", "alert");
    let changes = [],
      ticket = 0;
    function invalidate() {
      ticket++;
      result.replaceChildren();
      error.textContent = "";
    }
    function addChange(kind) {
      if (changes.length >= 10) {
        error.textContent = "Maximum de 10 changements.";
        return;
      }
      changes.push(
        kind === "purchase"
          ? {
              kind,
              amount: 0,
              date: current.forecast[0].date,
              account_id:
                current.setup70.scope?.account_id ||
                current.accounts.find((a) => a.included && a.kind !== "credit")
                  ?.id,
            }
          : { kind, key: "", new_on: current.forecast[0].date },
      );
      invalidate();
      drawChanges();
    }
    function input(type, value, min) {
      const n = el("input");
      n.type = type;
      n.value = value ?? "";
      n.required = true;
      if (min) n.min = min;
      return n;
    }
    function drawChanges() {
      editRows.replaceChildren();
      for (const [i, c] of changes.entries()) {
        const row = el("div", undefined, "v10-change");
        row.append(
          el(
            "h3",
            c.kind === "purchase"
              ? "Achat ou imprévu"
              : "Décaler une échéance ou un revenu",
          ),
        );
        if (c.kind === "purchase") {
          const amount = input("number", c.amount, "0.01");
          amount.step = "0.01";
          amount.oninput = () => {
            c.amount = Number(amount.value);
            invalidate();
          };
          const date = input("date", c.date, current.forecast[0].date);
          date.max = current.forecast[Number(horizon.value) - 1].date;
          date.oninput = () => {
            c.date = date.value;
            invalidate();
          };
          const account = el("select");
          account.required = true;
          for (const a of current.accounts)
            account.add(new Option(a.name, a.id));
          account.value = String(c.account_id || "");
          account.onchange = () => {
            c.account_id = Number(account.value);
            invalidate();
          };
          row.append(
            field("Montant ($)", amount),
            field("Date de l’achat", date),
            field("Compte de l’achat", account),
          );
        } else {
          const choice = el("select");
          choice.required = true;
          choice.add(new Option("Choisir une échéance", ""));
          for (const r of current.planning.rows.filter(
            (r) =>
              ["recurring", "envelope"].includes(r.source) &&
              r.type !== "reserve" &&
              ["planned", "pending"].includes(r.status),
          ))
            choice.add(
              new Option(
                r.date +
                  " · " +
                  r.description +
                  " · " +
                  money(r.remaining_cents),
                r.key,
              ),
            );
          choice.value = c.key;
          choice.onchange = () => {
            c.key = choice.value;
            invalidate();
          };
          const date = input("date", c.new_on, current.forecast[0].date);
          date.max = current.forecast[Number(horizon.value) - 1].date;
          date.oninput = () => {
            c.new_on = date.value;
            invalidate();
          };
          row.append(
            field("Échéance à décaler", choice),
            field("Nouvelle date simulée", date),
          );
        }
        row.append(
          button("Retirer ce changement", () => {
            changes.splice(i, 1);
            invalidate();
            drawChanges();
          }),
        );
        editRows.append(row);
      }
    }
    const controls = el("div", undefined, "v10-actions");
    controls.append(
      button("+ Achat ou imprévu", () => addChange("purchase")),
      button("+ Revenu retardé ou report", () => addChange("move")),
    );
    const compare = el("button", "Comparer les scénarios", "primary");
    compare.type = "submit";
    labForm.append(
      field("Nom du scénario", scenarioName),
      field("Horizon de comparaison", horizon),
      controls,
      editRows,
      saved,
      error,
      compare,
      result,
    );
    lab.inside.append(
      el(
        "p",
        "Les comparaisons utilisent vos données actuelles. Aucun achat, revenu ou virement n’est enregistré.",
        "quiet-copy",
      ),
      labForm,
    );
    horizon.onchange = () => {
      invalidate();
      for (const date of editRows.querySelectorAll("input[type=date]"))
        date.max = current.forecast[Number(horizon.value) - 1].date;
    };
    scenarioName.oninput = invalidate;
    function payload() {
      return {
        kind: "plan",
        horizon: Number(horizon.value),
        changes: structuredClone(changes),
      };
    }
    function drawSaved() {
      saved.replaceChildren(el("h3", "Scénarios enregistrés"));
      for (const s of current.support41.scenarios) {
        const row = el("div", undefined, "v10-saved"),
          check = el("input");
        check.type = "checkbox";
        check.dataset.id = s.id;
        check.onchange = invalidate;
        row.append(
          field("Comparer : " + s.name, check),
          button("Reprendre", () => {
            changes = structuredClone(
              s.payload.kind === "plan" ? s.payload.changes : [s.payload],
            );
            scenarioName.value = s.name;
            horizon.value = s.payload.horizon || 30;
            drawChanges();
            invalidate();
          }),
          button("Supprimer", async () => {
            try {
              runtime.render(
                await request("/api/support/scenarios/delete", { id: s.id }),
              );
              drawSaved();
              invalidate();
            } catch (e) {
              error.textContent = e.message;
            }
          }),
        );
        saved.append(row);
      }
      saved.append(
        button("Enregistrer ce scénario", async () => {
          if (!labForm.reportValidity()) return;
          try {
            runtime.render(
              await request("/api/support/scenarios", {
                name: scenarioName.value,
                payload: payload(),
              }),
            );
            drawSaved();
            invalidate();
            error.textContent =
              "Scénario enregistré. Il sera recalculé lors de la prochaine comparaison.";
          } catch (e) {
            error.textContent = e.message;
          }
        }),
      );
    }
    labForm.onsubmit = async (event) => {
      event.preventDefault();
      invalidate();
      const mine = ticket,
        selected = [...saved.querySelectorAll("input:checked")].map((c) =>
          current.support41.scenarios.find((s) => s.id === c.dataset.id),
        );
      if (!changes.length) {
        error.textContent = "Ajoutez au moins un changement.";
        return;
      }
      if (selected.length > 2) {
        error.textContent =
          "Comparez au maximum deux scénarios enregistrés et votre brouillon.";
        return;
      }
      compare.disabled = true;
      try {
        const cases = [
            { name: scenarioName.value, payload: payload() },
            ...selected,
          ],
          outputs = await Promise.all(
            cases.map((s) => request("/api/simulate", s.payload)),
          );
        if (mine !== ticket || !lab.d.open) return;
        const days = Number(horizon.value),
          base = outputs[0].baseline.slice(0, days),
          initial = current.safe_cents,
          baseLow = Math.min(initial, ...base.map((d) => d.safe_cents)),
          cards = el("div", undefined, "v10-cases");
        for (const [i, s] of [{ name: "Budget actuel" }, ...cases].entries()) {
          const list = i ? outputs[i - 1].scenario.slice(0, days) : base,
            low = [
              { date: current.forecast[0].date, safe_cents: initial },
              ...list,
            ].reduce((a, b) => (b.safe_cents < a.safe_cents ? b : a)),
            card = el("div", undefined, "v10-case");
          card.append(
            el("h3", s.name),
            el("strong", money(low.safe_cents)),
            el("p", "Minimum · " + low.date),
            el(
              "p",
              "Écart au minimum actuel : " + money(low.safe_cents - baseLow),
            ),
            el("p", "Fin de période : " + money(list.at(-1).safe_cents)),
          );
          if (i && outputs[i - 1].warnings.length)
            card.append(
              el(
                "small",
                outputs[i - 1].warnings.length +
                  " point(s) de configuration à vérifier.",
              ),
            );
          cards.append(card);
        }
        result.append(cards);
      } catch (e) {
        if (mine === ticket) error.textContent = e.message;
      } finally {
        compare.disabled = false;
      }
    };
    function openLab() {
      invalidate();
      drawChanges();
      drawSaved();
      lab.d.showModal();
    }
    document
      .querySelector("#v4-forecast .v4-topbar")
      .append(button("Comparer mes scénarios", openLab));
    document
      .querySelector(".v47-toolbar-actions")
      .append(button("Scénarios", openLab));
    // Monthly observations are arithmetic on actual transactions, with no generated advice.
    const report = el("details", undefined, "v10-panel");
    report.id = "v10-monthly";
    report.append(
      el("summary", "Ce mois-ci : variations et abonnements à revoir"),
    );
    const reportBody = el("div");
    report.append(reportBody);
    $("sillage-comparison").before(report);
    function drawReport() {
      const month =
          $("report-month").value || current.forecast[0].date.slice(0, 7),
        d = new Date(month + "-15T12:00:00");
      d.setUTCMonth(d.getUTCMonth() - 1);
      const previous = d.toISOString().slice(0, 7),
        account = Number($("report-account").value) || null,
        tx = current.calendar_actuals.filter(
          (t) => (!account || t.account_id === account) && t.amount_cents < 0,
        ),
        totals = (m) => {
          const map = new Map();
          for (const t of tx.filter((t) => t.happened_on.startsWith(m)))
            map.set(
              t.category_id,
              (map.get(t.category_id) || 0) - t.amount_cents,
            );
          return map;
        },
        now = totals(month),
        before = totals(previous),
        ids = new Set([...now.keys(), ...before.keys()]);
      reportBody.replaceChildren(
        el(
          "p",
          month === current.forecast[0].date.slice(0, 7)
            ? "Mois en cours : comparaison provisoire avec le mois précédent complet."
            : "Achats enregistrés, hors virements.",
          "quiet-copy",
        ),
      );
      for (const c of [...ids]
        .map((id) => ({
          id,
          amount: now.get(id) || 0,
          delta: (now.get(id) || 0) - (before.get(id) || 0),
        }))
        .filter((c) => c.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 5)) {
        const row = el("div", undefined, "v10-row");
        row.append(
          el(
            "span",
            current.categories.find((k) => k.id === c.id)?.name ||
              "Non-catégorisé",
          ),
          el("strong", money(c.amount)),
          el("small", "Écart depuis " + previous + " : " + money(c.delta)),
        );
        reportBody.append(row);
      }
      if (!ids.size)
        reportBody.append(el("p", "Pas encore de dépenses à comparer."));
      reportBody.append(
        el("h3", "Paiements récurrents à revoir"),
        el(
          "p",
          "Repérez les services ou abonnements que vous souhaitez conserver. Cette liste ne suppose pas qu’ils sont inutiles.",
          "quiet-copy",
        ),
      );
      for (const r of current.recurring
        .filter(
          (r) =>
            r.type === "expense" &&
            r.active &&
            !r.one_time &&
            (!account || r.account_id === account) &&
            /abonn|netflix|spotify|iptv|disney|apple|amazon|youtube|prime/i.test(
              r.description,
            ),
        )
        .slice(0, 10)) {
        reportBody.append(
          button(
            r.description + " · " + money(r.amount_cents) + " · " + r.frequency,
            () => runtime.editRule(r.id),
          ),
        );
      }
      const trend = el("div");
      reportBody.append(el("h3", "Dépassements réguliers"), trend);
      const check = button(
        "Analyser les trois derniers mois terminés",
        async () => {
          check.disabled = true;
          trend.replaceChildren(el("p", "Analyse en cours…"));
          try {
            const anchor = new Date(month + "-15T12:00:00");
            if (month >= current.forecast[0].date.slice(0, 7))
              anchor.setUTCMonth(anchor.getUTCMonth() - 1);
            const months = Array.from({ length: 3 }, (_, i) => {
                const d = new Date(anchor);
                d.setUTCMonth(d.getUTCMonth() - i);
                return d.toISOString().slice(0, 7);
              }),
              data = await Promise.all(
                months.map((m) => request("/api/budget/global?month=" + m)),
              );
            if (!trend.isConnected) return;
            const categories = new Map();
            for (const period of data)
              for (const r of period.rows.filter(
                (r) => r.direction === "expense" && r.budget_cents !== null,
              )) {
                const c = categories.get(r.id) || {
                  name: r.name,
                  count: 0,
                  months: 0,
                };
                c.months++;
                if (r.variance_cents < 0) c.count++;
                categories.set(r.id, c);
              }
            const repeated = [...categories.values()].filter(
              (c) => c.count >= 2,
            );
            trend.replaceChildren(
              el(
                "p",
                "Budget global, tous comptes · " +
                  months.slice().reverse().join(", "),
                "quiet-copy",
              ),
            );
            for (const c of repeated)
              trend.append(
                el(
                  "p",
                  c.name +
                    " : dépassement dans " +
                    c.count +
                    " mois sur " +
                    c.months +
                    " mois budgétés.",
                ),
              );
            if (!repeated.length)
              trend.append(
                el(
                  "p",
                  "Aucun dépassement répété dans les mois budgétés analysés.",
                ),
              );
          } catch (e) {
            if (trend.isConnected)
              trend.replaceChildren(el("p", e.message, "sillage-error"));
          } finally {
            check.disabled = false;
          }
        },
      );
      reportBody.append(check);
    }
    for (const id of ["report-month", "report-account"])
      $(id).addEventListener("change", drawReport);
    let signature = current ? JSON.stringify(current) : null;
    const prior = runtime.render;
    function draw() {
      if (!current) return;
      drawWork();
      drawEnvelopes();
      drawReport();
      if (lab.d.open) invalidate();
    }
    runtime.render = function (s) {
      const key = JSON.stringify(s);
      if (key === signature) {
        runtime.state = s;
        return;
      }
      prior(s);
      current = s;
      signature = key;
      draw();
    };
    draw();
  })();
}
