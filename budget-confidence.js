// Read-only explanations; reuse the canonical forecast and existing financial editors.
export function initialize(runtime) {
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const money = (n) =>
    new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
    }).format(n / 100);
  const date = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
      day: "numeric",
      month: "short",
    });
  const button = (text, fn) => {
    const b = node("button", text, "secondary");
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  const hero = document.getElementById("v80-hero"),
    menu = document.querySelector(".dashboard-more-home");
  const open = button("Pourquoi mon minimum a changé ?", show);
  open.id = "minimum-history-open";
  menu.append(open);
  const quiet = node("div", undefined, "minimum-history-shortcut");
  quiet.append(button("Comprendre les variations du minimum", show));
  hero.after(quiet);
  const dialog = node("dialog", undefined, "editor-dialog confidence-dialog");
  dialog.id = "minimum-history-dialog";
  dialog.setAttribute("aria-label", "Variations du minimum");
  const inner = node("div", undefined, "dialog-inner"),
    heading = node("div", undefined, "dialog-heading"),
    close = button("Fermer", () => dialog.close()),
    content = node("div"),
    status = node("p");
  status.setAttribute("role", "status");
  heading.append(node("h2", "Variations du minimum"), close);
  inner.append(heading, status, content);
  dialog.append(inner);
  document.body.append(dialog);
  const tabs = node("div", undefined, "confidence-horizons");
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", "Horizon de l’historique");
  let horizon = 30,
    latest = null,
    ticket = 0;
  for (const n of [30, 60, 90]) {
    const b = button(n + " jours", () => {
      horizon = n;
      draw();
    });
    b.dataset.historyHorizon = n;
    tabs.append(b);
  }
  heading.after(tabs);
  async function show() {
    horizon = Number(
      hero.querySelector("[data-horizon][aria-pressed=true]")?.dataset
        .horizon || 30,
    );
    if (!dialog.open) dialog.showModal();
    await load();
  }
  async function load() {
    const id = ++ticket;
    status.textContent = "Chargement…";
    content.replaceChildren();
    try {
      const r = await fetch("/api/forecast/history", { cache: "no-store" }),
        data = await r.json();
      if (id !== ticket || !dialog.open) return;
      if (!r.ok) throw Error(data.error || "Historique indisponible.");
      latest = data;
      status.textContent = data.error || "";
      draw();
    } catch (e) {
      if (id === ticket) {
        status.textContent = e.message;
        content.append(button("Réessayer", load));
      }
    }
  }
  function draw() {
    if (!latest) return;
    const expanded = new Set(
      [...content.querySelectorAll("details[open]")].map(
        (d) => d.dataset.recordId,
      ),
    );
    content.replaceChildren();
    for (const b of tabs.children)
      b.setAttribute(
        "aria-pressed",
        String(+b.dataset.historyHorizon === horizon),
      );
    content.append(
      node(
        "p",
        "Observations locales depuis cette version : les jours précédents ne peuvent pas être reconstitués. Les " +
          latest.retention +
          " dernières observations sont conservées.",
        "v4-footnote",
      ),
    );
    const rows = latest.records.filter((r) => !r.baseline);
    if (!rows.length)
      content.append(
        node(
          "p",
          latest.error
            ? "L’historique n’est pas disponible pour le moment."
            : "Le point de départ est enregistré. La prochaine variation apparaîtra ici.",
          "confidence-empty",
        ),
      );
    for (const record of rows) {
      const c = record.comparisons[horizon],
        detail = node("details", undefined, "confidence-change"),
        summary = node("summary"),
        when = new Date(record.at).toLocaleString("fr-CA", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
      detail.dataset.recordId = record.id;
      detail.open = expanded.has(record.id);
      const title = node("span");
      const main =
        record.changes.find((c) => !/^(Compte|Réglage)/.test(c.label)) ||
        record.changes[0];
      title.append(
        node(
          "span",
          main?.label ||
            (c.window_changed ? "Nouvelle journée" : "Prévision mise à jour"),
        ),
        node("small", when),
      );
      summary.append(
        title,
        node("strong", (c.delta_cents > 0 ? "+" : "") + money(c.delta_cents)),
      );
      detail.append(
        summary,
        node(
          "p",
          money(c.before.cents) +
            " le " +
            date(c.before.date) +
            " → " +
            money(c.after.cents) +
            " le " +
            date(c.after.date),
        ),
      );
      if (c.delta_cents === 0)
        detail.append(
          node(
            "p",
            "Le minimum est inchangé; des montants ou des dates de la prévision ont changé.",
          ),
        );
      if (c.window_changed)
        detail.append(
          node(
            "p",
            "L’horizon avance avec la journée : certaines dates sortent de la période et d’autres y entrent.",
          ),
        );
      if (c.bridge) {
        const lines = node("dl", undefined, "confidence-bridge");
        for (const [label, cents] of [
          ["Effet du solde prévu", c.bridge.cash_change_cents],
          ["Effet des protections et réserves", c.bridge.reserve_change_cents],
          [
            "Déplacement du point le plus bas",
            c.bridge.minimum_date_change_cents,
          ],
        ]) {
          lines.append(
            node("dt", label),
            node("dd", (cents > 0 ? "+" : "") + money(cents)),
          );
        }
        detail.append(
          lines,
          node(
            "p",
            "Ces trois effets expliquent exactement la variation du minimum. Les opérations ci-dessous sont les changements observés ensemble; leur effet individuel n’est pas estimé.",
            "v4-footnote",
          ),
        );
      } else
        detail.append(
          node(
            "p",
            "Le nouveau point bas est hors de la période précédemment observée. La différence totale est connue; une décomposition à date égale n’est pas disponible.",
          ),
        );
      if (record.changes.length) {
        const list = node("ul");
        for (const change of record.changes)
          list.append(node("li", change.action + " · " + change.label));
        detail.append(list);
        if (record.changes_count > record.changes.length)
          detail.append(
            node(
              "p",
              record.changes_count -
                record.changes.length +
                " autres changements.",
            ),
          );
      } else
        detail.append(
          node(
            "p",
            "Mise à jour de la journée, des associations ou des paramètres de prévision.",
          ),
        );
      content.append(detail);
    }
  }
  dialog.addEventListener("close", () => {
    ticket++;
  });
  // The canonical insight already distinguishes current and next periods, including early purchases.
  function envelopes(state) {
    for (const card of document.querySelectorAll(
      "#envelopes>[data-envelope-id]",
    )) {
      card.querySelector(".confidence-envelope-summary")?.remove();
      const e = state.envelopes.find(
          (e) => e.id === Number(card.dataset.envelopeId),
        ),
        i = state.envelope_insights?.items.find((i) => i.id === e?.id);
      if (!i || i.mode !== "reserved" || e.frequency === "none") continue;
      const budget = i.period_start
          ? i.period_budget_cents
          : i.next_period_remaining_cents + i.next_period_spent_cents,
        spent = i.period_start
          ? i.spent_period_cents
          : i.next_period_spent_cents;
      const strip = node("div", undefined, "confidence-envelope-summary");
      for (const [label, value] of [
        ["Budget", budget],
        ["Dépensé", spent],
        ["Restant", budget - spent],
      ]) {
        const line = node("div");
        line.append(node("span", label), node("strong", money(value)));
        strip.append(line);
      }
      const current = card.querySelector(".v13-envelope-period");
      current.firstChild.textContent = i.period_start
        ? "Période depuis le " + date(i.period_start)
        : "Restant du prochain budget · achats anticipés inclus";
      current.after(strip);
    }
  }
  const render = runtime.render;
  runtime.render = function (state) {
    const result = render(state);
    envelopes(state);
    return result;
  };
  if (runtime.state) envelopes(runtime.state);
}
