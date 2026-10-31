export const $ = (s) => document.querySelector(s);
export const node = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
export const money = (n) =>
  new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format((n || 0) / 100);
export const shortDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
  });
export const longDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
export const field = (label, input) => {
  input.setAttribute("aria-label", label);
  const el = node("label", label);
  el.append(input);
  return el;
};
export const input = (name, type = "text", value = "") => {
  const el = node("input");
  el.name = name;
  el.type = type;
  el.value = value ?? "";
  return el;
};
export const select = (name, options, value) => {
  const el = node("select");
  el.name = name;
  for (const [id, label] of options) el.add(new Option(label, id));
  if (value !== undefined) el.value = value;
  return el;
};
export const button = (text, fn, cls = "secondary") => {
  const b = node("button", text, cls);
  b.type = "button";
  b.onclick = fn;
  return b;
};
export const panel = (title, action) => {
  const el = node("section", null, "panel"),
    head = node("div", null, "panel-head");
  head.append(node("h2", title));
  if (action) head.append(action);
  el.append(head);
  return el;
};
let selectedForecastDate;
export function chart(days, onSelect) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 400 144");
  svg.setAttribute("role", "img");
  svg.classList.add("forecast-plot");
  svg.setAttribute(
    "aria-label",
    "Évolution du disponible sur " +
      days.length +
      " jours. Un curseur accessible se trouve sous le graphique.",
  );
  const values = days.map((d) => d.safe_cents),
    low = Math.min(...values),
    high = Math.max(...values),
    span = high - low || 1;
  const points = values.map((v, i) => [
    64 + (i * 324) / Math.max(1, values.length - 1),
    12 + ((high - v) * 82) / span,
  ]);
  const add = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
    return el;
  };
  add("path", {
    d: "M" + points.map((p) => p.join(",")).join(" L") + " L388,108 L64,108 Z",
    class: "graph-fill",
  });
  add("path", {
    d: "M" + points.map((p) => p.join(",")).join(" L"),
    class: "graph-line",
  });
  for (const [y, value] of [
    [16, high],
    [96, low],
  ])
    add("text", { x: 56, y, "text-anchor": "end" }).textContent = money(value);
  add("text", { x: 64, y: 134 }).textContent = shortDate(days[0].date);
  add("text", { x: 388, y: 134, "text-anchor": "end" }).textContent = shortDate(
    days.at(-1).date,
  );
  const minIndex = values.indexOf(low),
    minPoint = points[minIndex];
  const minimum = add("circle", {
    cx: minPoint[0],
    cy: minPoint[1],
    r: 5,
    fill: "var(--gold)",
    class: "forecast-minimum-point",
  });
  const title = document.createElementNS(ns, "title");
  title.textContent =
    "Minimum : " + money(low) + " · " + longDate(days[minIndex].date);
  minimum.append(title);
  const line = add("line", {
      x1: 64,
      x2: 64,
      y1: 5,
      y2: 108,
      class: "forecast-selection-line",
    }),
    dot = add("circle", {
      cx: 64,
      cy: points[0][1],
      r: 3.5,
      fill: "var(--accent)",
      class: "forecast-selected-point",
    });
  svg.selectDay = (index) => {
    const p = points[index];
    line.setAttribute("x1", p[0]);
    line.setAttribute("x2", p[0]);
    dot.setAttribute("cx", p[0]);
    dot.setAttribute("cy", p[1]);
    svg.dataset.selectedDate = days[index].date;
  };
  if (onSelect) {
    let dragging = false;
    const select = (e) => {
      const p = svg.createSVGPoint();
      p.x = e.clientX;
      p.y = e.clientY;
      const local = p.matrixTransform(svg.getScreenCTM().inverse());
      onSelect(
        Math.max(
          0,
          Math.min(
            days.length - 1,
            Math.round(((local.x - 64) / 324) * (days.length - 1)),
          ),
        ),
      );
    };
    svg.onpointerdown = (e) => {
      if (e.button !== 0) return;
      dragging = true;
      svg.setPointerCapture(e.pointerId);
      select(e);
    };
    svg.onpointermove = (e) => {
      if (dragging) select(e);
    };
    svg.onpointerup = svg.onpointercancel = () => {
      dragging = false;
    };
  }
  return svg;
}
export function forecastExplorer(sim) {
  const days = sim.daily.slice(0, 30),
    root = node("section", null, "forecast-explorer");
  if (!days.length) return root;
  const heading = node("h4", "Les " + days.length + " prochains jours"),
    range = input("forecast_day", "range", "0"),
    details = node("div", null, "forecast-day-detail"),
    selected = node("div", null, "forecast-selected-summary");
  let index = Math.max(
    0,
    days.findIndex((d) => d.date === selectedForecastDate),
  );
  range.min = "0";
  range.max = String(days.length - 1);
  range.step = "1";
  const graph = chart(days, showDay),
    minIndex = days.reduce(
      (best, d, i) => (d.safe_cents < days[best].safe_cents ? i : best),
      0,
    ),
    jump = button(
      "Minimum : " +
        money(days[minIndex].safe_cents) +
        " · " +
        shortDate(days[minIndex].date),
      () => showDay(minIndex),
      "text-button forecast-minimum-button",
    );
  root.append(
    heading,
    graph,
    field("Choisir une date", range),
    jump,
    selected,
    details,
  );
  selected.setAttribute("aria-live", "polite");
  selected.setAttribute("aria-atomic", "true");
  function showDay(value) {
    index = Math.max(0, Math.min(days.length - 1, Number(value)));
    const d = days[index];
    selectedForecastDate = d.date;
    range.value = String(index);
    graph.selectDay(index);
    range.setAttribute(
      "aria-valuetext",
      longDate(d.date) + " · Disponible prévu " + money(d.safe_cents),
    );
    selected.dataset.date = d.date;
    selected.replaceChildren(
      node("h4", longDate(d.date)),
      node("span", "Disponible après limites et cartes", "muted"),
      node(
        "strong",
        money(d.safe_cents),
        "forecast-selected-amount" + (d.safe_cents < 0 ? " negative" : ""),
      ),
    );
    details.replaceChildren();
    for (const e of d.events) {
      const row = node("div", null, "forecast-event"),
        text = node("div");
      text.append(node("strong", e.name));
      if (e.overdue)
        text.append(node("small", "En retard · " + shortDate(e.date)));
      if (e.nominal_on && e.nominal_on !== e.date)
        text.append(
          node("small", shortDate(e.nominal_on) + " → " + shortDate(e.date)),
        );
      row.append(
        text,
        node(
          "strong",
          (e.kind === "income" ? "+" : e.kind === "transfer" ? "↔ " : "−") +
            money(e.amount_cents),
          e.kind === "income" ? "positive" : "",
        ),
      );
      details.append(row);
    }
    const renewals = sim.categories.flatMap((c) =>
      c.periods
        .filter((p) => p.date === d.date)
        .map((p) => ({ name: c.name, amount: p.remaining_cents })),
    );
    for (const renewal of renewals) {
      const row = node("div", null, "forecast-event forecast-renewal"),
        text = node("div");
      text.append(
        node("strong", "Renouvellement · " + renewal.name),
        node("small", "Protégé dans le disponible, sans débit bancaire."),
      );
      row.append(text, node("strong", money(renewal.amount)));
      details.append(row);
    }
    if (!d.events.length && !renewals.length)
      details.append(node("p", "Aucune opération prévue.", "muted"));
  }
  range.oninput = () => showDay(Number(range.value));
  showDay(index);
  return root;
}

export function todayView(
  sim,
  {
    openBalance,
    openCategory,
    act,
    openPurchase,
    openTutorial,
    shared = false,
  } = {},
) {
  const root = node("div"),
    heading = node("div", null, "page-heading"),
    title = node("div");
  title.append(node("h1", "Aujourd’hui"), node("p", longDate(sim.reference)));
  heading.append(title);
  if (openBalance)
    heading.append(button("Vérifier mon solde", openBalance, "text-button"));
  if (openTutorial)
    heading.append(button("Tutoriel", () => openTutorial(), "text-button"));
  if (openPurchase)
    heading.append(button("Puis-je faire cet achat ?", openPurchase));
  root.append(heading);
  for (const warning of sim.warnings || [])
    root.append(node("p", warning, "warning"));
  const grid = node("div", null, "today-grid"),
    left = node("div", null, "left-stack"),
    right = node("div", null, "right-stack");
  grid.append(left, right);
  root.append(grid);
  const hero = node("section", null, "panel hero");
  hero.append(
    node(
      "p",
      sim.provisional ? "Disponible à vérifier" : "Disponible à dépenser",
      "eyebrow",
    ),
    node("div", money(sim.available_cents), "hero-amount money"),
    node(
      "p",
      sim.next_pay && sim.next_pay <= sim.until
        ? "Prévision jusqu’au " + shortDate(sim.until)
        : sim.next_pay
          ? "Avant la paie du " +
            shortDate(sim.next_pay) +
            " · au plus 30 jours"
          : "Pour les 30 prochains jours",
      "hero-caption",
    ),
  );
  const breakdown = node("div", null, "breakdown");
  for (const [label, value] of [
    ["Solde du compte", sim.breakdown.bank_cents],
    ["Cartes à payer", -sim.breakdown.cards_cents],
    ["Factures et paiements prévus", -sim.breakdown.bills_cents],
    ["Limites protégées", -sim.breakdown.limits_cents],
  ]) {
    if (label === "Limites protégées" && sim.limits_details) {
      const detail = node("details", null, "limits-breakdown"),
        summary = node("summary");
      summary.append(
        node("span", "Limites protégées ⌄"),
        node("strong", money(value)),
      );
      detail.append(summary);
      const content = node("div", null, "limits-explanation");
      content.append(
        node(
          "p",
          "Montants retenus au " +
            shortDate(sim.limits_details.through) +
            ", le jour qui détermine votre disponible avant la paie.",
        ),
      );
      for (const c of sim.limits_details.categories) {
        content.append(node("h4", c.name));
        for (const period of c.periods) {
          const line = node("div", null, "limits-detail-row");
          line.append(
            node(
              "span",
              (period.kind === "current"
                ? "Restant actuel · "
                : "Renouvellement · ") + shortDate(period.date),
            ),
            node("strong", money(period.remaining_cents)),
          );
          content.append(line);
          if (period.kind === "renewal" && period.spent_cents > 0)
            content.append(
              node(
                "p",
                money(period.spent_cents) + " déjà imputés à cette période.",
              ),
            );
        }
      }
      const total = node("div", null, "limits-detail-row limits-total");
      total.append(
        node("span", "Total protégé"),
        node("strong", money(sim.limits_details.total_cents)),
      );
      content.append(total);
      detail.append(content);
      breakdown.append(detail);
      continue;
    }
    const row = node("div");
    row.append(node("span", label), node("strong", money(value)));
    breakdown.append(row);
  }
  hero.append(breakdown);
  left.append(hero);
  const minimum = node("section", null, "panel minimum"),
    minlabel = node("div");
  const horizon = sim.minimum_horizon_days || 90;
  minlabel.append(
    node("h3", "À surveiller"),
    node("small", "Prévision sur " + horizon + " jours"),
  );
  const message = node("p", null, "forecast-message");
  if (sim.risk?.below_available) {
    const bills = sim.risk.bills.map((e) => e.name),
      renewals = sim.risk.renewals.map((c) => c.name);
    const reason = [
      ...(bills.length
        ? ["facture ou paiement " + bills.slice(0, 2).join(", ")]
        : []),
      ...(renewals.length
        ? ["renouvellement " + renewals.slice(0, 2).join(", ")]
        : []),
    ].join(" et ");
    message.append(
      node(
        "span",
        "Le " +
          shortDate(sim.minimum_on) +
          (reason ? " : " + reason + ". " : ". "),
      ),
      node(
        "strong",
        "Disponible prévu : " + money(sim.minimum_cents),
        sim.minimum_cents < 0 ? "negative" : "",
      ),
    );
  } else
    message.textContent =
      "Aucun creux supplémentaire prévu sous votre disponible avant la paie.";
  minimum.append(minlabel, message, forecastExplorer(sim));
  left.append(minimum);
  const limits = panel(
    "Vos limites",
    openCategory ? button("Gérer", openCategory, "text-button") : null,
  );
  limits.classList.add("limits-overview");
  for (const c of sim.categories) {
    const current = c.current,
      row = node("div", null, "category-row limit-overview-row"),
      title = node("div", null, "limit-title"),
      spent = current?.spent_cents || 0;
    title.append(
      node("h3", c.name),
      node("small", c.period === "weekly" ? "Par semaine" : "Par mois"),
    );
    row.append(title);
    for (const [label, amount, kind] of [
      ["Limite", c.limit_cents, "limit"],
      ["Dépensé", spent, "spent"],
      ["Restant", current?.remaining_cents || 0, "remaining"],
    ]) {
      const cell = node("div", null, "limit-figure " + kind);
      cell.append(
        node("small", label),
        node(
          "strong",
          money(amount),
          kind === "spent" && spent > c.limit_cents ? "negative" : "",
        ),
      );
      row.append(cell);
    }
    const next = node("div", null, "limit-next");
    next.append(
      node("small", current?.date > sim.reference ? "Début" : "Renouvelle"),
      node(
        "strong",
        shortDate(current?.date > sim.reference ? current.date : c.next),
      ),
    );
    row.append(next);
    if (spent > c.limit_cents)
      row.append(
        node(
          "small",
          "Dépassement : " + money(spent - c.limit_cents),
          "negative limit-excess",
        ),
      );
    limits.append(row);
  }
  if (!sim.categories.length)
    limits.append(node("p", "Ajoutez vos limites dans Plan.", "empty"));
  right.append(limits);
  const coming = panel("Les 14 jours à venir");
  for (const e of sim.upcoming) {
    const row = node("div", null, "event"),
      date = node("div", new Date(e.date + "T12:00:00").getDate(), "date-tile");
    date.append(
      node(
        "small",
        new Date(e.date + "T12:00:00").toLocaleDateString("fr-CA", {
          month: "short",
        }),
      ),
    );
    const text = node("div");
    text.append(
      node("div", e.name, "event-title"),
      node(
        "small",
        e.overdue
          ? "En retard · toujours à couvrir"
          : e.kind === "income"
            ? "Paie prévue"
            : e.kind === "transfer"
              ? "Paiement ou virement"
              : "Facture prévue",
      ),
    );
    if (e.nominal_on && e.nominal_on !== e.date)
      text.append(
        node(
          "small",
          shortDate(e.nominal_on) + " → " + shortDate(e.date),
          "calendar-preview-date",
        ),
      );
    row.append(
      date,
      text,
      node(
        "div",
        (e.kind === "income" ? "+" : "−") + money(e.amount_cents),
        "event-right" + (e.kind === "income" ? " positive" : ""),
      ),
    );
    if (act && !shared) {
      const actions = node("div", null, "actions");
      actions.append(
        button(
          e.kind === "income"
            ? "Reçue"
            : e.kind === "transfer"
              ? "Effectué"
              : "Payée",
          () => act(e, "pay"),
          "text-button",
        ),
        button("Montant…", () => act(e, "amount"), "text-button"),
        button("Reporter", () => act(e, "postpone"), "text-button"),
      );
      row.append(actions);
    }
    coming.append(row);
  }
  if (!sim.upcoming.length)
    coming.append(
      node("p", "Aucune échéance dans les 14 prochains jours.", "empty"),
    );
  right.append(coming);
  const daily = node("details", null, "panel daily");
  daily.append(node("summary", "Voir le disponible jour par jour"));
  const list = node("div", null, "daily-list");
  for (const d of sim.daily) {
    const row = node("div", null, "daily-row");
    row.append(
      node("span", longDate(d.date)),
      node(
        "strong",
        money(d.safe_cents),
        "money" + (d.safe_cents < 0 ? " negative" : ""),
      ),
    );
    list.append(row);
  }
  daily.append(list);
  left.append(daily);
  return root;
}
