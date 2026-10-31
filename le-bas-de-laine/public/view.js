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
export function chart(days) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 400 94");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Évolution du disponible sur 30 jours");
  const values = days.map((d) => d.safe_cents),
    low = Math.min(...values),
    high = Math.max(...values),
    span = high - low || 1;
  const points = values.map((v, i) => [
    12 + (i * 376) / Math.max(1, values.length - 1),
    9 + ((high - v) * 55) / span,
  ]);
  const add = (tag, attrs) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    svg.append(e);
    return e;
  };
  add("path", {
    d: "M" + points.map((p) => p.join(",")).join(" L") + " L388,72 L12,72 Z",
    class: "graph-fill",
  });
  add("path", {
    d: "M" + points.map((p) => p.join(",")).join(" L"),
    class: "graph-line",
  });
  const i = values.indexOf(low);
  add("circle", {
    cx: points[i]?.[0] || 12,
    cy: points[i]?.[1] || 9,
    r: 3,
    fill: "var(--accent)",
  });
  add("text", { x: 12, y: 90 }).textContent = shortDate(days[0].date);
  const end = add("text", { x: 388, y: 90, "text-anchor": "end" });
  end.textContent = shortDate(days.at(-1).date);
  return svg;
}
export function todayView(
  sim,
  { openBalance, openCategory, act, shared = false } = {},
) {
  const root = node("div"),
    heading = node("div", null, "page-heading"),
    title = node("div");
  title.append(node("h1", "Aujourd’hui"), node("p", longDate(sim.reference)));
  heading.append(title);
  if (openBalance)
    heading.append(button("Vérifier mon solde", openBalance, "text-button"));
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
    const row = node("div");
    row.append(node("span", label), node("strong", money(value)));
    breakdown.append(row);
  }
  hero.append(breakdown);
  left.append(hero);
  const minimum = node("section", null, "panel minimum"),
    minlabel = node("div");
  minlabel.append(
    node("h3", "Le point le plus bas"),
    node("small", "Sur 30 jours · " + shortDate(sim.minimum_on)),
  );
  minimum.append(
    minlabel,
    node(
      "div",
      money(sim.minimum_cents),
      "money" + (sim.minimum_cents < 0 ? " negative" : ""),
    ),
    chart(sim.daily),
  );
  left.append(minimum);
  const limits = panel(
    "Vos limites",
    openCategory ? button("Gérer", openCategory, "text-button") : null,
  );
  for (const c of sim.categories) {
    const row = node("div", null, "category-row"),
      top = node("div", null, "category-top"),
      sub = node("div", null, "category-sub"),
      current = c.current;
    top.append(
      node("h3", c.name),
      node(
        "span",
        money(current?.remaining_cents || 0),
        "money" +
          ((current?.spent_cents || 0) > c.limit_cents ? " negative" : ""),
      ),
    );
    sub.append(
      node("span", "restant sur " + money(c.limit_cents)),
      node(
        "span",
        current?.date > sim.reference
          ? "Début " + shortDate(current.date)
          : "Renouvelle " + shortDate(c.next),
      ),
    );
    const bar = node("div", null, "bar"),
      fill = node("i");
    fill.style.width =
      Math.min(
        100,
        Math.max(
          0,
          ((current?.spent_cents || 0) / Math.max(1, c.limit_cents)) * 100,
        ),
      ) + "%";
    bar.append(fill);
    row.append(top, sub, bar);
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
