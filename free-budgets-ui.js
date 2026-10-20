// Domain initializer. Shared state and rendering hooks are explicit dependencies.
export function initialize(runtime) {
  /* Flexible priorities, backed by the existing envelope ledger. */
  (() => {
    const $ = (id) => document.getElementById(id),
      n = (tag, text, cls) => {
        const e = document.createElement(tag);
        if (text !== undefined) e.textContent = text;
        if (cls) e.className = cls;
        return e;
      },
      b = (text, fn, cls = "v4-button") => {
        const e = n("button", text, cls);
        e.type = "button";
        e.onclick = fn;
        return e;
      },
      field = (text, input) => {
        const e = n("label", text);
        e.append(input);
        return e;
      },
      cash = (v) =>
        (v / 100).toLocaleString("fr-CA", {
          style: "currency",
          currency: "CAD",
        });
    const normalize = (s) =>
      s
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase("fr-CA")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    let current = null,
      ticket = 0;
    const host = $("free-budgets-workspace");
    host.className = "free-workspace";
    const actions = n("div", undefined, "free-actions"),
      metrics = n("div", undefined, "free-metrics"),
      cards = n("div", undefined, "free-grid"),
      feedback = n("p", undefined, "free-feedback");
    feedback.id = "free-feedback";
    feedback.setAttribute("role", "status");
    actions.append(
      b("+ Nouveau budget libre", () => edit(null), "v4-button v4-primary"),
      b("Reprendre une enveloppe", adopt),
      b("Préparer mes neuf postes", starter),
    );
    const help = n("details", undefined, "free-help");
    help.append(
      n("summary", "Comment fonctionnent les budgets libres ?"),
      n(
        "p",
        "Réservez un montant quand vous le souhaitez. Aucun budget fixe et aucun renouvellement automatique. Cet argent reste dans vos comptes, mais n’est plus disponible pour autre chose.",
      ),
      n(
        "p",
        "Associez chaque achat à son budget : il réduit la réserve restante. Une enveloppe programmée reste dans Enveloppes; une catégorie sert toujours à classer les dépenses dans vos rapports.",
      ),
      n(
        "p",
        "Un achat sur carte et son remboursement sont deux mouvements distincts. Vérifiez aussi vos prévisions : aucune réserve automatique pour les dettes de cartes n’est ajoutée.",
      ),
    );
    const filter = n("input");
    filter.type = "search";
    filter.id = "free-budget-filter";
    filter.placeholder = "Rechercher parmi vos budgets libres…";
    filter.setAttribute("aria-label", "Rechercher un budget libre");
    filter.oninput = () => draw(current);
    host.append(actions, metrics, filter, feedback, cards, help);
    const dialog = n("dialog", undefined, "editor-dialog free-dialog");
    dialog.id = "free-budget-dialog";
    document.body.append(dialog);
    async function request(url, data) {
      const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
        out = await response.json();
      if (!response.ok) throw Error(out.error || "Enregistrement impossible.");
      return out;
    }
    function shell(title) {
      ticket++;
      dialog.replaceChildren();
      const inner = n("div", undefined, "dialog-inner"),
        heading = n("div", undefined, "dialog-heading"),
        error = n("p", undefined, "free-error");
      error.setAttribute("role", "alert");
      heading.append(
        n("h2", title),
        b("Fermer", () => dialog.close(), "secondary"),
      );
      inner.append(heading, error);
      dialog.append(inner);
      return { inner, error };
    }
    function show() {
      if (!dialog.open) dialog.showModal();
      requestAnimationFrame(() =>
        dialog.querySelector("input:not([type=checkbox]),select")?.focus(),
      );
    }
    function finish(s, message) {
      runtime.render(s);
      dialog.close();
      feedback.textContent = message;
    }
    function edit(item) {
      const { inner, error } = shell(
          item ? "Votre budget libre" : "Une nouvelle priorité",
        ),
        form = n("form", undefined, "free-form"),
        name = n("input");
      name.name = "name";
      name.required = true;
      name.maxLength = 80;
      name.placeholder = "Ex. Essentiels pour la maison";
      name.value = item?.name || "";
      const active = n("input");
      active.type = "checkbox";
      active.name = "active";
      active.checked = item?.active !== 0;
      form.append(field("Nom du budget", name));
      if (item) {
        const label = field("Budget actif", active);
        label.className = "free-check";
        form.append(
          label,
          n(
            "p",
            "Une mise en pause conserve votre réserve. Vous pouvez la réactiver sans perdre vos achats.",
            "v4-footnote",
          ),
        );
      } else
        form.append(
          n(
            "p",
            "Création à 0 $. Vous choisirez ensuite le montant à réserver, avec un aperçu de son effet sur le disponible.",
            "v4-footnote",
          ),
        );
      const save = n(
        "button",
        item ? "Enregistrer le budget" : "Créer à 0 $",
        "v4-button v4-primary",
      );
      save.type = "submit";
      form.append(save);
      inner.append(form);
      if (item) {
        const remove = n("details", undefined, "free-history");
        remove.append(
          n("summary", "Supprimer ce budget"),
          n(
            "p",
            "Sans achat ni récurrence associés, sa suppression libérera " +
              cash(item.reserved_cents) +
              " dans le disponible libre. Avec un historique, mettez-le plutôt en pause.",
            "v4-footnote",
          ),
        );
        const destroy = b(
          "Confirmer la suppression",
          async () => {
            destroy.disabled = true;
            try {
              finish(
                await request("/api/free-budgets/delete", {
                  id: item.id,
                  expected_reserved_cents: item.reserved_cents,
                }),
                "Budget supprimé. Sa réserve a été libérée.",
              );
            } catch (e) {
              error.textContent = e.message;
            } finally {
              destroy.disabled = false;
            }
          },
          "v4-button",
        );
        remove.append(destroy);
        inner.append(remove);
      }
      form.onsubmit = async (event) => {
        event.preventDefault();
        save.disabled = true;
        error.textContent = "";
        try {
          finish(
            await request("/api/free-budgets/" + (item ? "update" : "create"), {
              id: item?.id,
              name: name.value,
              active: active.checked,
            }),
            item
              ? "Budget libre mis à jour."
              : "Budget créé. Aucun montant n’a encore été réservé.",
          );
        } catch (e) {
          error.textContent = e.message;
        } finally {
          save.disabled = false;
        }
      };
      show();
    }
    function starter() {
      const { inner, error } = shell("Vos neuf postes, prêts à organiser");
      inner.append(
        n(
          "p",
          "Les postes manquants seront créés à 0 $. Vos enveloppes existantes et leurs montants sont conservés. Rien n’est réservé automatiquement.",
          "v4-footnote",
        ),
      );
      const list = n("div", undefined, "free-starter-list");
      for (const name of current.free_budgets.suggestions) {
        const existing = current.envelopes.find(
            (e) => normalize(e.name) === normalize(name),
          ),
          free =
            existing &&
            current.free_budgets.items.some((e) => e.id === existing.id),
          line = n("div");
        line.append(
          n("strong", name),
          n(
            "small",
            existing
              ? free
                ? "Déjà dans vos budgets libres"
                : "Enveloppe existante conservée · reprise séparée"
              : "À créer · 0,00 $",
          ),
        );
        list.append(line);
      }
      inner.append(list);
      const save = b(
        "Créer les budgets manquants",
        async () => {
          save.disabled = true;
          try {
            finish(
              await request("/api/free-budgets/starter", {}),
              "Vos postes sont prêts. Les enveloppes existantes n’ont pas été modifiées.",
            );
          } catch (e) {
            error.textContent = e.message;
          } finally {
            save.disabled = false;
          }
        },
        "v4-button v4-primary",
      );
      inner.append(save);
      show();
    }
    function adopt() {
      const { inner, error } = shell("Reprendre une enveloppe existante"),
        freeIds = new Set(current.free_budgets.items.map((e) => e.id)),
        available = current.envelopes.filter(
          (e) =>
            e.frequency === "none" &&
            !freeIds.has(e.id) &&
            !current.recurring.some(
              (r) =>
                r.active &&
                r.envelope_id === e.id &&
                (r.type === "reserve" || (r.type === "expense" && !r.one_time)),
            ),
        ),
        choice = n("select");
      choice.name = "envelope_id";
      for (const e of available)
        choice.add(
          new Option(
            e.name + " · " + cash(e.reserved_cents) + " réservés",
            e.id,
          ),
        );
      inner.append(
        n(
          "p",
          "Les enveloppes sans renouvellement, sans budget fixe et en mode Réserve seulement apparaissent déjà ici. Pour les autres enveloppes non programmées, cette reprise conserve l’identifiant, la réserve et les achats; elle remet le budget théorique à 0 et active Réserve seulement.",
          "v4-footnote",
        ),
        field("Enveloppe sans renouvellement récurrent à reprendre", choice),
      );
      if (!available.length)
        inner.append(
          n(
            "p",
            "Aucune autre enveloppe non programmée à reprendre. Les enveloppes avec un renouvellement ou une récurrence restent dans Enveloppes.",
            "v4-footnote",
          ),
        );
      const save = b(
        "Reprendre sans changer les montants",
        async () => {
          const e = available.find((e) => e.id === Number(choice.value));
          if (!e) return;
          save.disabled = true;
          try {
            finish(
              await request("/api/free-budgets/adopt", {
                id: e.id,
                expected_reserved_cents: e.reserved_cents,
                expected_budget_cents: e.budget_cents,
                expected_forecast_spend: e.forecast_spend,
              }),
              "Enveloppe reprise. Votre réserve et vos achats sont conservés.",
            );
          } catch (err) {
            error.textContent = err.message;
          } finally {
            save.disabled = false;
          }
        },
        "v4-button v4-primary",
      );
      save.disabled = !available.length;
      inner.append(save);
      show();
    }
    function fund(item, direction = "add") {
      const { inner, error } = shell(
          direction === "add"
            ? "Ajouter de l’argent · " + item.name
            : "Libérer de l’argent · " + item.name,
        ),
        form = n("form", undefined, "free-form"),
        amount = n("input");
      amount.type = "number";
      amount.name = "amount";
      amount.min = ".01";
      amount.step = ".01";
      amount.required = true;
      amount.placeholder = "Ex. 50,00";
      if (direction === "release")
        amount.max = (item.reserved_cents / 100).toFixed(2);
      const result = n("div", undefined, "free-fund-preview"),
        preview = n(
          "button",
          "Voir l’effet sur mon disponible",
          "v4-button v4-primary",
        );
      preview.type = "submit";
      form.append(
        field(
          direction === "add"
            ? "Montant à réserver ($)"
            : "Montant à remettre au disponible libre ($)",
          amount,
        ),
        n(
          "p",
          "C’est une répartition de votre argent : aucun virement bancaire et aucune dépense ne seront créés.",
          "v4-footnote",
        ),
        preview,
      );
      inner.append(form, result);
      amount.oninput = () => {
        ticket++;
        result.replaceChildren();
        error.textContent = "";
      };
      form.onsubmit = async (event) => {
        event.preventDefault();
        const serial = ++ticket;
        preview.disabled = true;
        error.textContent = "";
        result.replaceChildren();
        const payload = {
          id: item.id,
          amount: Number(amount.value),
          direction,
        };
        try {
          const p = await request("/api/free-budgets/preview", payload);
          if (serial !== ticket || !dialog.open) return;
          result.append(n("h3", "Avant de confirmer"));
          for (const [label, before, after, key] of [
            [
              "Réserve de " + item.name,
              p.reserved_before_cents,
              p.reserved_after_cents,
              "reserved",
            ],
            [
              "Disponible libre aujourd’hui",
              p.safe_before_cents,
              p.safe_after_cents,
              "safe",
            ],
            [
              "Minimum prévu sur 90 jours",
              p.min_before_cents,
              p.min_after_cents,
              "minimum",
            ],
          ]) {
            const row = n("div", undefined, "free-preview-line");
            row.dataset.value = key;
            row.append(
              n("span", label),
              n(
                "strong",
                cash(before) + " → " + cash(after),
                after < 0 ? "negative" : "",
              ),
            );
            result.append(row);
          }
          result.append(
            n(
              "p",
              "Solde bancaire inchangé : " +
                cash(p.cash_cents) +
                ". Minimum après réservation atteint le " +
                new Date(p.min_on + "T12:00:00").toLocaleDateString("fr-CA") +
                ".",
              "v4-footnote",
            ),
          );
          const ack = n("input");
          ack.type = "checkbox";
          ack.name = "allow_negative";
          if (p.needs_ack) {
            result.append(
              n(
                "p",
                "Cette réservation laisse un disponible négatif aujourd’hui ou dans les prévisions. Réduisez le montant ou confirmez ce choix.",
                "free-warning",
              ),
            );
            const label = field(
              "Je comprends que mon disponible devient ou reste négatif.",
              ack,
            );
            label.className = "free-check";
            result.append(label);
          }
          const confirm = b(
            direction === "add"
              ? "Confirmer la réservation"
              : "Confirmer la libération",
            async () => {
              confirm.disabled = true;
              error.textContent = "";
              try {
                finish(
                  await request("/api/free-budgets/fund", {
                    ...payload,
                    token: p.token,
                    allow_negative: ack.checked,
                  }),
                  direction === "add"
                    ? "Montant réservé. Vos soldes bancaires sont inchangés."
                    : "Montant remis dans le disponible libre.",
                );
              } catch (e) {
                error.textContent = e.message;
                if (e.message.includes("changé")) result.replaceChildren();
              } finally {
                confirm.disabled = p.needs_ack && !ack.checked;
              }
            },
            "v4-button v4-primary",
          );
          confirm.disabled = p.needs_ack;
          ack.onchange = () => (confirm.disabled = !ack.checked);
          result.append(confirm);
        } catch (e) {
          if (serial === ticket) error.textContent = e.message;
        } finally {
          preview.disabled = false;
        }
      };
      show();
    }
    function purchase(item) {
      const form = $("transaction");
      form.elements.amount.value = "";
      form.elements.description.value = "";
      window.appOpenEditor("transaction");
      $("transaction-direction").value = "expense";
      $("transaction-direction").dispatchEvent(
        new Event("change", { bubbles: true }),
      );
      $("envelope-options").value = item.id;
      form.querySelector(".entry-more").open = true;
      form.elements.happened_on.value = runtime.today();
      if (item.recent[0])
        form.elements.account_id.value = item.recent[0].account_id;
    }
    function draw(s) {
      current = s;
      const items = s.free_budgets?.items || [],
        total = items.reduce((v, e) => v + e.reserved_cents, 0),
        spent = items.reduce((v, e) => v + e.spent_month_cents, 0);
      metrics.replaceChildren();
      for (const [label, value, copy] of [
        [
          "Disponible libre",
          s.safe_cents,
          "Après toutes vos réserves, y compris les enveloppes régulières",
        ],
        [
          "Réservé dans vos budgets libres",
          total,
          items.length + " poste(s) · argent conservé dans vos comptes",
        ],
        [
          "Achats associés ce mois",
          spent,
          "Les achats réels classés dans ces budgets",
        ],
      ]) {
        const card = n("div");
        card.append(
          n("span", label),
          n("strong", cash(value), value < 0 ? "negative" : ""),
          n("small", copy),
        );
        metrics.append(card);
      }
      cards.replaceChildren();
      if (!items.length) {
        const empty = n("div", undefined, "free-empty");
        empty.append(
          n("h3", "Vos priorités n’ont pas besoin d’un montant fixe"),
          n(
            "p",
            "Créez Maison ou préparez vos neuf postes. Vous pourrez les alimenter quand votre disponible le permet.",
          ),
        );
        cards.append(empty);
      }
      const visible = items.filter((item) =>
        normalize(item.name).includes(normalize(filter.value)),
      );
      if (items.length && !visible.length)
        cards.append(
          n("p", "Aucun budget ne correspond à cette recherche.", "free-empty"),
        );
      for (const item of visible) {
        const card = n("article", undefined, "free-card");
        card.dataset.budgetId = item.id;
        const heading = n("div", undefined, "free-card-heading");
        heading.append(
          n("h3", item.name),
          n("span", item.active ? "À votre rythme" : "En pause", "free-badge"),
        );
        card.append(
          heading,
          n("span", "Encore réservé pour ce budget", "free-caption"),
          n("strong", cash(item.reserved_cents), "free-amount"),
        );
        const facts = n("dl", undefined, "free-facts");
        facts.append(
          n("dt", "Achats ce mois"),
          n("dd", cash(item.spent_month_cents)),
          n("dt", "Achats associés au total"),
          n("dd", cash(item.spent_total_cents)),
        );
        card.append(facts);
        if (!item.active)
          card.append(
            n(
              "p",
              "La réserve reste déduite du disponible libre. Réactivez le budget pour l’alimenter.",
              "v4-footnote",
            ),
          );
        const buttons = n("div", undefined, "free-card-actions"),
          add = b(
            "Ajouter de l’argent",
            () => fund(item),
            "v4-button v4-primary",
          ),
          release = b("Libérer", () => fund(item, "release"));
        add.disabled = !item.active;
        release.disabled = !item.active || !item.reserved_cents;
        buttons.append(
          add,
          release,
          b("Saisir un achat", () => purchase(item), "v4-text-button"),
          b("Modifier", () => edit(item), "v4-text-button"),
        );
        card.append(buttons);
        if (item.recent.length) {
          const history = n("details", undefined, "free-history");
          history.append(
            n("summary", "Derniers achats · " + item.recent.length),
          );
          for (const t of item.recent) {
            const line = n("div");
            line.append(
              n(
                "span",
                t.happened_on + " · " + t.description + " · " + t.account_name,
              ),
              n("strong", cash(-t.amount_cents)),
            );
            history.append(line);
          }
          card.append(history);
        }
        cards.append(card);
      }
    }
    window.budgetEditFreeBudget = (id) => {
      const item = current?.free_budgets.items.find((e) => e.id === id);
      if (item) edit(item);
    };
    dialog.addEventListener("close", () => ticket++);
    const previous = runtime.render;
    runtime.render = function (s) {
      previous(s);
      draw(s);
    };
    if (typeof runtime.state !== "undefined" && runtime.state)
      draw(runtime.state);
  })();
}
