// Domain initializer. Shared state and rendering hooks are explicit dependencies.
export function initialize(runtime) {
  /* Envelope workspace: all previews are read-only and the server owns money calculations. */
  (() => {
    const $ = (id) => document.getElementById(id);
    const node = (tag, text, cls) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = text;
      if (cls) e.className = cls;
      return e;
    };
    const button = (label, fn, cls = "v4-button") => {
      const e = node("button", label, cls);
      e.type = "button";
      e.onclick = fn;
      return e;
    };
    const field = (label, input) => {
      const e = node("label", label);
      e.append(input);
      return e;
    };
    const cash = (v) =>
      (v / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
    const date = (value) =>
      value
        ? new Date(value + "T12:00:00").toLocaleDateString("fr-CA", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Aucun";
    const modes = {
      reserved: "Achats au fil de la période",
      dated: "Paiement à date fixe",
      free: "Budget libre",
    };
    let current = null,
      ticket = 0;
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
        out = await r.json();
      if (!r.ok) throw Error(out.error || "Opération impossible.");
      return out;
    }
    function modal(id) {
      const dialog = node("dialog", undefined, "editor-dialog v44-dialog");
      dialog.id = id;
      const inner = node("div", undefined, "dialog-inner");
      dialog.append(inner);
      document.body.append(dialog);
      return { dialog, inner };
    }
    const sheet = modal("v44-envelope-sheet"),
      wizard = modal("v44-envelope-guide");
    function heading(shell, title) {
      shell.inner.replaceChildren();
      const h = node("div", undefined, "dialog-heading");
      h.append(
        node("h2", title),
        button("Fermer", () => shell.dialog.close()),
      );
      shell.inner.append(h);
    }
    function metric(label, value) {
      const e = node("div", undefined, "v44-metric");
      e.append(node("span", label), node("strong", value));
      return e;
    }
    function row(label, value, cls = "") {
      const e = node("div", undefined, "v44-line " + cls);
      e.append(node("span", label), node("strong", value));
      return e;
    }
    const selected = new Set(),
      selection = node("div", undefined, "v44-selection"),
      selectCount = node("span", "Aucune sélection"),
      selectionButton = button("Configurer la sélection", () =>
        guide([...selected]),
      );
    selectionButton.disabled = true;
    selection.append(
      selectCount,
      selectionButton,
      button("Tout sélectionner", () => {
        for (const e of current.envelopes)
          if (!current.free_budgets.items.some((f) => f.id === e.id))
            selected.add(e.id);
        decorate();
      }),
      button("Effacer", () => {
        selected.clear();
        decorate();
      }),
    );
    $("envelopes").before(selection);
    const summary = node("div", undefined, "v44-overview");
    selection.before(summary);
    const notice = node("p", undefined, "v44-notice");
    notice.id = "v44-notice";
    notice.setAttribute("role", "status");
    summary.before(notice);
    const alerts = node("details", undefined, "v44-alerts");
    alerts.id = "v44-alerts";
    alerts.open = true;
    document.querySelector(".cards").after(alerts);
    function personalFunding(id) {
      const e = current.envelopes.find((e) => e.id === id),
        target = current.accounts.find((a) => a.id === e?.forecast_account_id),
        sources = current.accounts.filter(
          (a) => a.included && a.kind !== "credit",
        );
      return e?.forecast_spend &&
        target &&
        target.kind !== "credit" &&
        !target.included &&
        sources.length === 1
        ? { source: sources[0], target, e }
        : null;
    }
    function openPurchase(id) {
      sheet.dialog.close();
      window.appOpenEditor("transaction");
      const form = $("transaction"),
        funding = personalFunding(id);
      $("transaction-direction").value = funding ? "transfer" : "expense";
      $("transaction-direction").dispatchEvent(
        new Event("change", { bubbles: true }),
      );
      if (funding) {
        $("account-options").value = String(funding.source.id);
        $("account-options").dispatchEvent(
          new Event("change", { bubbles: true }),
        );
        $("transaction-destination").value = String(funding.target.id);
        $("transaction-destination").dispatchEvent(
          new Event("change", { bubbles: true }),
        );
      }
      form.elements.envelope_id.value = String(id);
      form.elements.amount.value = funding
        ? (funding.e.budget_cents / 100).toFixed(2)
        : "";
      form.elements.description.value = funding ? funding.e.name : "";
      form.elements.happened_on.value = runtime.today();
      form.querySelector(".entry-more").open = true;
      form.elements.envelope_id.dispatchEvent(
        new Event("change", { bubbles: true }),
      );
    }
    function showSheet(id) {
      const e = current.envelopes.find((e) => e.id === id),
        insight = current.envelope_insights.items.find((e) => e.id === id);
      if (!e || !insight) return;
      heading(sheet, e.name);
      sheet.inner.append(
        node(
          "p",
          modes[insight.mode] + (e.active ? "" : " · En pause"),
          "v44-mode",
        ),
      );
      const metrics = node("div", undefined, "v44-metrics");
      metrics.append(
        metric("Réserve restante", cash(e.reserved_cents)),
        metric("Achats ce mois-ci", cash(insight.spent_month_cents)),
        metric(
          e.frequency === "none"
            ? "Budget fixe"
            : insight.period_start
              ? "Budget de cette période"
              : "Budget par période",
          e.frequency === "none" && !e.budget_cents
            ? "Libre"
            : cash(insight.period_budget_cents),
        ),
      );
      if (
        insight.next_renewal &&
        (!insight.period_start || insight.next_period_spent_cents > 0)
      )
        metrics.append(
          metric(
            "Restant du budget du " + date(insight.next_renewal),
            cash(insight.next_period_remaining_cents),
          ),
        );
      sheet.inner.append(metrics);
      if (insight.period_budget_cents !== e.budget_cents)
        sheet.inner.append(row("Budget habituel", cash(e.budget_cents)));
      if (insight.period_start)
        sheet.inner.append(
          row("Période commencée le", date(insight.period_start)),
          row("Achats de cette période", cash(insight.spent_period_cents)),
        );
      sheet.inner.append(
        row("Prochain renouvellement", date(insight.next_renewal)),
        node(
          "p",
          insight.mode === "reserved"
            ? "La réserve protège votre disponible. Saisissez les achats à leurs dates réelles."
            : insight.mode === "free"
              ? "Alimentez ce budget à votre rythme, sans renouvellement fixe."
              : "Les paiements sont simulés aux dates programmées.",
          "v4-footnote",
        ),
      );
      if (insight.over_budget_cents > 0)
        sheet.inner.append(
          node(
            "p",
            "Budget de période dépassé de " +
              cash(insight.over_budget_cents) +
              ".",
            "v44-warning",
          ),
        );
      if (personalFunding(id))
        sheet.inner.append(
          row(
            "Virements ce mois-ci",
            cash(insight.transferred_month_cents || 0),
          ),
          node(
            "p",
            "Le virement depuis le compte commun utilise cette enveloppe. Les achats du compte personnel ne débitent pas le compte commun une deuxième fois.",
            "v4-footnote",
          ),
        );
      const onCards = (current.sts_breakdown.card_envelopes || []).filter(
        (f) => f.envelope_id === id,
      );
      if (onCards.length) {
        sheet.inner.append(
          row(
            "Achats sur carte encore protégés",
            cash(onCards.reduce((n, f) => n + f.amount_cents, 0)),
          ),
        );
        for (const f of onCards)
          sheet.inner.append(
            row(f.card_name + " · à rembourser", cash(f.amount_cents)),
          );
        sheet.inner.append(
          node(
            "p",
            "Cet argent reste exclu du disponible jusqu’au remboursement. Le remboursement ne le déduit pas une deuxième fois.",
            "v4-footnote",
          ),
        );
      }
      const funding = node("form", undefined, "v44-funding");
      const amount = node("input");
      amount.type = "number";
      amount.min = "0.01";
      amount.step = "0.01";
      amount.required = true;
      amount.placeholder = "0,00";
      amount.setAttribute("aria-label", "Montant à réserver");
      const save = node("button", "Réserver maintenant", "v4-button");
      save.type = "submit";
      const fundingError = node("p", "");
      fundingError.setAttribute("role", "status");
      funding.append(
        field("Ajouter à cette enveloppe ($)", amount),
        save,
        node(
          "p",
          "Protège l’argent immédiatement, sans mouvement bancaire. Pour une enveloppe programmée, cette somme est une avance sur la prochaine échéance.",
          "v4-footnote",
        ),
        fundingError,
      );
      funding.onsubmit = async (ev) => {
        ev.preventDefault();
        save.disabled = true;
        try {
          const s = await request("/api/envelopes/fund", {
            id,
            amount: Number(amount.value),
            expected_reserved_cents: e.reserved_cents,
          });
          runtime.render(s);
          showSheet(id);
        } catch (err) {
          fundingError.textContent = err.message;
        } finally {
          save.disabled = false;
        }
      };
      if (e.active) sheet.inner.append(funding);
      const actions = node("div", undefined, "v44-actions");
      actions.append(
        button(
          personalFunding(id) ? "Enregistrer un virement" : "Saisir un achat",
          () => openPurchase(id),
          "v4-button v4-primary",
        ),
        button("Configurer l’usage", () => {
          sheet.dialog.close();
          guide([id]);
        }),
        button("Ajuster les montants", () => {
          sheet.dialog.close();
          if (insight.mode === "free") window.budgetEditFreeBudget(id);
          else runtime.editEnvelope(id);
        }),
      );
      actions.append(button("Supprimer l’enveloppe", async () => {
        await runtime.deleteEnvelope(id);
        if (!runtime.state.envelopes.some(e => e.id === id)) sheet.dialog.close();
      }, "v4-button quiet-danger"));
      sheet.inner.append(actions);
      const history = node("div", undefined, "v44-history");
      history.append(
        node("h3", "Achats et opérations associés"),
        node(
          "p",
          insight.transaction_count +
            " opération(s) jusqu’à aujourd’hui · les revenus sont affichés avec leur signe.",
          "v4-footnote",
        ),
      );
      for (const t of insight.transfers || []) {
        const line = node("div", undefined, "v44-operation"),
          copy = node("div");
        copy.append(
          node("strong", t.description),
          node(
            "small",
            date(t.happened_on) + " · " + t.from_name + " → " + t.to_name,
          ),
        );
        line.append(
          copy,
          node("strong", cash(t.amount_cents)),
          button(
            "Modifier le virement",
            () => {
              sheet.dialog.close();
              window.budgetEditRecord("transfer", t);
            },
            "v4-text-button",
          ),
        );
        history.append(line);
      }
      const list = node("div"),
        status = node("p", undefined, "v4-error");
      status.setAttribute("role", "status");
      history.append(list, status);
      sheet.inner.append(history);
      function transactionRow(t) {
        const line = node("div", undefined, "v44-operation"),
          copy = node("div");
        copy.append(
          node("strong", t.description),
          node(
            "small",
            date(t.happened_on) +
              " · " +
              t.account_name +
              (t.affects_balance === 0
                ? " · historique sans effet sur les soldes"
                : ""),
          ),
        );
        line.append(
          copy,
          node("strong", cash(t.amount_cents)),
          button(
            "Modifier",
            () => {
              sheet.dialog.close();
              window.budgetEditRecord("transaction", t);
            },
            "v4-text-button",
          ),
        );
        return line;
      }
      for (const t of insight.recent) list.append(transactionRow(t));
      if (!insight.recent.length)
        list.append(
          node("p", "Aucun achat associé pour le moment.", "v4-footnote"),
        );
      let page = 1;
      const more = button("Afficher tout l’historique", async () => {
        const serial = ++ticket;
        more.disabled = true;
        status.textContent = "";
        try {
          const out = await request(
            "/api/transactions/list?" +
              new URLSearchParams({ envelope: id, to: runtime.today(), page }),
          );
          if (serial !== ticket || !sheet.dialog.open) return;
          if (page === 1) list.replaceChildren();
          for (const t of out.rows) list.append(transactionRow(t));
          page++;
          more.hidden = page > out.pages;
          more.textContent = "Afficher les opérations suivantes";
        } catch (err) {
          status.textContent = err.message;
        } finally {
          more.disabled = false;
        }
      });
      more.hidden = insight.transaction_count <= 10;
      history.append(more);
      sheet.dialog.showModal();
    }
    sheet.dialog.addEventListener("close", () => ticket++);
    function guide(ids) {
      const entries = ids
        .map((id) => current.envelopes.find((e) => e.id === id))
        .filter(Boolean);
      if (!entries.length) return;
      ticket++;
      heading(
        wizard,
        entries.length === 1
          ? "Configurer · " + entries[0].name
          : "Configurer " + entries.length + " enveloppes",
      );
      const error = node("p", undefined, "v4-error");
      error.setAttribute("role", "alert");
      const form = node("form", undefined, "v44-guide-form"),
        choice = node("select");
      choice.name = "mode";
      for (const [key, label] of Object.entries(modes))
        choice.add(new Option(label, key));
      choice.value =
        current.envelope_insights.items.find((i) => i.id === entries[0].id)
          ?.mode || "reserved";
      form.append(field("Comment utilisez-vous ce budget ?", choice));
      const explanation = node("p", undefined, "v4-footnote");
      form.append(explanation);
      const configuration = node("div", undefined, "v44-guide-config");
      let budget, frequency, start, account;
      if (entries.length === 1) {
        const e = entries[0];
        budget = node("input");
        budget.type = "number";
        budget.name = "budget";
        budget.min = ".01";
        budget.step = ".01";
        budget.value = String(e.budget_cents / 100);
        frequency = node("select");
        frequency.name = "frequency";
        for (const [key, label] of [
          ["monthly", "Chaque mois"],
          ["weekly", "Chaque semaine"],
          ["biweekly", "Aux 2 semaines"],
          ["quarterly", "Aux 3 mois"],
          ["semiannual", "Aux 6 mois"],
          ["yearly", "Chaque année"],
        ])
          frequency.add(new Option(label, key));
        frequency.value = e.frequency === "none" ? "monthly" : e.frequency;
        start = node("input");
        start.type = "date";
        start.name = "start_on";
        const next = new Date(runtime.today() + "T12:00:00");
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        start.value =
          e.start_on ||
          next.getFullYear() +
            "-" +
            String(next.getMonth() + 1).padStart(2, "0") +
            "-01";
        account = node("select");
        account.name = "account_id";
        account.add(new Option("Choisir un compte", ""));
        for (const a of current.accounts) account.add(new Option(a.name, a.id));
        account.value = String(e.forecast_account_id || "");
        configuration.append(
          field("Budget par période ($)", budget),
          field("Fréquence", frequency),
          field("Début de programmation", start),
          field("Compte du paiement prévu", account),
        );
      } else
        configuration.append(
          node(
            "p",
            "Chaque enveloppe conserve son budget, ses dates et son compte. Pour définir une nouvelle programmation, configurez d’abord l’enveloppe individuellement.",
            "v4-footnote",
          ),
        );
      const preservation = node(
        "p",
        "Votre réserve actuelle, vos comptes, vos achats, les budgets exceptionnels et le choix de report sont conservés. Les factures programmées séparément restent actives.",
        "v4-footnote",
      );
      form.append(configuration, preservation);
      if (entries.length > 1)
        form.append(
          node("p", entries.map((e) => e.name).join(" · "), "v44-mode"),
        );
      const result = node("div", undefined, "v44-guide-result"),
        preview = node(
          "button",
          "Vérifier les changements",
          "v4-button v4-primary",
        );
      preview.type = "submit";
      form.append(preview);
      wizard.inner.append(form, error, result);
      function invalidate() {
        ticket++;
        result.replaceChildren();
        error.textContent = "";
      }
      function modeChanged() {
        invalidate();
        configuration.hidden = choice.value === "free";
        for (const input of configuration.querySelectorAll("input,select"))
          input.disabled =
            choice.value === "free" ||
            (input === account && choice.value !== "dated");
        if (account) account.closest("label").hidden = choice.value !== "dated";
        explanation.textContent =
          choice.value === "free"
            ? "Alimentation manuelle : retire le budget fixe et le renouvellement, en conservant la réserve."
            : choice.value === "reserved"
              ? "Protège de l’argent sans prévoir une sortie bancaire à chaque début de période."
              : "Simule un paiement bancaire à chaque date programmée.";
      }
      form.addEventListener("input", invalidate);
      form.addEventListener("change", invalidate);
      choice.addEventListener("change", modeChanged);
      modeChanged();
      form.onsubmit = async (event) => {
        event.preventDefault();
        const serial = ++ticket;
        preview.disabled = true;
        error.textContent = "";
        result.replaceChildren();
        const changes = entries.map((e) => ({
            id: e.id,
            mode: choice.value,
            ...(entries.length === 1 && choice.value !== "free"
              ? {
                  budget: Number(budget.value),
                  frequency: frequency.value,
                  start_on: start.value,
                  ...(choice.value === "dated"
                    ? {
                        account_id: account.value
                          ? Number(account.value)
                          : null,
                      }
                    : {}),
                }
              : {}),
          })),
          payload = { changes };
        try {
          const out = await request("/api/envelope-tools/preview", payload);
          if (serial !== ticket || !wizard.dialog.open) return;
          result.append(
            node("h3", "Avant de confirmer"),
            row("Disponible aujourd’hui · inchangé", cash(out.safe_cents)),
            row(
              "Minimum prévu sur 90 jours",
              cash(out.min_before_cents) + " → " + cash(out.min_after_cents),
            ),
            node(
              "p",
              "Minimum après modification le " +
                date(out.min_on) +
                ". Aucun achat ni virement réel ne sera créé.",
              "v4-footnote",
            ),
          );
          for (const c of out.changes) {
            result.append(
              row(c.name, modes[c.mode]),
              node(
                "p",
                "Réserve conservée : " +
                  cash(c.before.reserved_cents) +
                  " · " +
                  (c.mode === "free"
                    ? "Sans budget fixe ni renouvellement."
                    : "Budget : " +
                      cash(c.after.budget_cents) +
                      " · début : " +
                      date(c.after.start_on) +
                      "."),
                "v4-footnote",
              ),
            );
            for (const note of c.notes)
              result.append(node("p", note, "v44-warning"));
          }
          const ack = node("input");
          ack.type = "checkbox";
          ack.name = "allow_negative";
          if (out.needs_ack) {
            const label = field(
              "J’ai vérifié le disponible négatif prévu.",
              ack,
            );
            label.className = "v44-check";
            result.append(label);
          }
          const save = button(
            "Confirmer la configuration",
            async () => {
              save.disabled = true;
              error.textContent = "";
              try {
                const state = await request("/api/envelope-tools/apply", {
                  ...payload,
                  token: out.token,
                  allow_negative: ack.checked,
                });
                runtime.render(state);
                selected.clear();
                decorate();
                wizard.dialog.close();
                notice.textContent =
                  "Configuration enregistrée. Vos réserves et votre historique sont conservés.";
              } catch (err) {
                error.textContent = err.message;
                result.replaceChildren();
              } finally {
                save.disabled = false;
              }
            },
            "v4-button v4-primary",
          );
          save.disabled = out.needs_ack;
          ack.onchange = () => (save.disabled = !ack.checked);
          result.append(save);
        } catch (err) {
          if (serial === ticket) error.textContent = err.message;
        } finally {
          preview.disabled = false;
        }
      };
      wizard.dialog.showModal();
    }
    wizard.dialog.addEventListener("close", () => ticket++);
    function decorate() {
      if (!current?.envelope_insights) return;
      for (const id of selected)
        if (!current.envelopes.some((e) => e.id === id)) selected.delete(id);
      selectCount.textContent = selected.size
        ? selected.size + " enveloppe(s) sélectionnée(s)"
        : "Choisissez des enveloppes à configurer ensemble";
      selectionButton.disabled = !selected.size;
      for (const card of document.querySelectorAll(
        "#envelopes [data-envelope-id],.free-card[data-budget-id]",
      )) {
        card.querySelector(".v44-card-tools")?.remove();
        const id = Number(card.dataset.envelopeId || card.dataset.budgetId),
          insight = current.envelope_insights.items.find((e) => e.id === id);
        if (!insight) continue;
        const tools = node("div", undefined, "v44-card-tools");
        tools.append(
          button(
            "Gérer",
            () => showSheet(id),
            "v4-button v44-sheet-button",
          ),
        );
        if (card.dataset.envelopeId) {
          const check = node("input");
          check.type = "checkbox";
          check.checked = selected.has(id);
          check.setAttribute(
            "aria-label",
            "Sélectionner " + current.envelopes.find((e) => e.id === id).name,
          );
          check.onchange = () => {
            if (check.checked) selected.add(id);
            else selected.delete(id);
            selectCount.textContent =
              selected.size + " enveloppe(s) sélectionnée(s)";
            selectionButton.disabled = !selected.size;
          };
          const label = field("Sélectionner", check);
          label.className = "v44-check";
          tools.append(label);
        }
        card.append(tools);
      }
    }
    function showUnassigned() {
      heading(sheet, "Achats sans enveloppe · ce mois-ci");
      sheet.inner.append(
        node(
          "p",
          "Une enveloppe est facultative. Associez seulement les achats qui doivent consommer une réserve.",
          "v4-footnote",
        ),
      );
      for (const t of current.envelope_insights.unassigned_recent) {
        const line = node("div", undefined, "v44-operation");
        line.append(
          node("span", t.description + " · " + date(t.happened_on)),
          node("strong", cash(t.amount_cents)),
          button(
            "Vérifier",
            () => {
              sheet.dialog.close();
              window.budgetEditRecord("transaction", t);
            },
            "v4-text-button",
          ),
        );
        sheet.inner.append(line);
      }
      sheet.inner.append(
        node(
          "p",
          "Les cinq plus récents sont affichés. Retrouvez les autres dans Transactions.",
          "v4-footnote",
        ),
      );
      sheet.dialog.showModal();
    }
    function drawAlerts() {
      alerts.replaceChildren();
      const entries = [],
        data = current.envelope_insights;
      for (const item of data.items) {
        const e = current.envelopes.find((e) => e.id === item.id);
        if (!e.active) continue;
        if (item.over_budget_cents > 0)
          entries.push({
            title:
              e.name + " · budget dépassé de " + cash(item.over_budget_cents),
            action: () => showSheet(e.id),
            warning: true,
          });
        else if (
          item.period_start &&
          item.period_budget_cents > 0 &&
          e.reserved_cents <= item.period_budget_cents * 0.2
        )
          entries.push({
            title: e.name + " · " + cash(e.reserved_cents) + " restants",
            action: () => showSheet(e.id),
            warning: true,
          });
      }
      if (data.risk)
        entries.unshift({
          title:
            "Disponible négatif prévu le " +
            date(data.risk.date) +
            " · " +
            cash(data.risk.safe_cents) +
            (data.risk.payday
              ? " avant la prochaine paie"
              : " sur les 30 prochains jours"),
          action: () =>
            document.querySelector('[data-view="prevision"]').click(),
          warning: true,
        });
      if (data.unassigned_count)
        entries.push({
          title:
            data.unassigned_count +
            " achat(s) sans enveloppe ce mois-ci · à vérifier au besoin",
          action: showUnassigned,
        });
      alerts.append(
        node(
          "summary",
          entries.length
            ? "À surveiller · " + entries.length + " point(s)"
            : "Votre budget · aucun point à signaler",
        ),
      );
      for (const e of entries)
        alerts.append(
          button(
            e.title,
            e.action,
            "v44-alert" + (e.warning ? " v44-warning" : ""),
          ),
        );
      if (!entries.length)
        alerts.append(
          node(
            "p",
            "Aucun dépassement ni risque détecté sur la période examinée.",
            "v4-footnote",
          ),
        );
    }
    function explainSafe() {
      if (!current || !$("v21-sts-dialog").open) return;
      const host = $("v21-sts-content");
      host.querySelector(".v44-safe-equation")?.remove();
      const box = node("div", undefined, "v44-safe-equation");
      box.append(
        node("h3", "Le calcul aujourd’hui"),
        row("Soldes bancaires inclus", cash(current.cash_cents)),
        row(
          "Réserves de toutes les enveloppes",
          "− " + cash(current.reserved_cents),
        ),
        row("Disponible libre", cash(current.safe_cents)),
        node(
          "p",
          "Les achats d’enveloppes sur carte restent protégés; la dette sans enveloppe ne crée pas de réserve automatique. Un achat bancaire associé à une réserve diminue à la fois la banque et la réserve : le montant couvert n’est pas déduit deux fois.",
          "v4-footnote",
        ),
      );
      const min = current.forecast.reduce((a, b) =>
        a.safe_cents <= b.safe_cents ? a : b,
      );
      box.append(
        row(
          "Point le plus bas sur 90 jours",
          cash(min.safe_cents) + " · " + date(min.date),
        ),
      );
      host.prepend(box);
    }
    const oldDetail = $("v21-sts-detail").onclick;
    $("v21-sts-detail").onclick = () => {
      oldDetail();
      explainSafe();
    };
    for (const id of ["safe", "sts-today", "sts-week", "sts-pay", "low"]) {
      const e = $(id);
      e.tabIndex = 0;
      e.setAttribute("role", "button");
      e.setAttribute(
        "aria-label",
        {
          safe: "Comprendre le disponible actuel",
          "sts-today": "Comprendre le disponible aujourd’hui",
          "sts-week": "Comprendre le disponible de la semaine",
          "sts-pay": "Comprendre le disponible jusqu’à la paie",
          low: "Comprendre le minimum sur 90 jours",
        }[id],
      );
      e.classList.add("v44-safe-link");
      e.onclick = () => $("v21-sts-detail").click();
      e.onkeydown = (event) => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          e.click();
        }
      };
    }
    function draw(s) {
      current = s;
      if (!s.envelope_insights) return;
      summary.replaceChildren(
        metric("Enveloppes et budgets", String(s.envelopes.length)),
        metric("Total réservé", cash(s.reserved_cents)),
        metric(
          "Achats associés ce mois-ci",
          cash(
            s.envelope_insights.items.reduce(
              (n, e) => n + e.spent_month_cents,
              0,
            ),
          ),
        ),
      );
      decorate();
      drawAlerts();
      explainSafe();
    }
    const freeGrid = $("free-budgets-workspace").querySelector(".free-grid");
    new MutationObserver(() => decorate()).observe(freeGrid, {
      childList: true,
    });
    window.budgetOpenEnvelopeSheet = showSheet;
    window.budgetDraftEnvelopePurchase = openPurchase;
    const previousRender = runtime.render;
    runtime.render = function (s) {
      previousRender(s);
      draw(s);
    };
    if (typeof runtime.state !== "undefined" && runtime.state)
      draw(runtime.state);
  })();
}
