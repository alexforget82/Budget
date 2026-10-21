// Presentation only. All amounts and periods come from the existing server state.
export function initialize(runtime) {
  const $ = (id) => document.getElementById(id);
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const money = (c) =>
    new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
    }).format((c || 0) / 100);
  const date = (d) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
      day: "numeric",
      month: "short",
    });
  const go = (view) =>
    document.querySelector(`.app-shell-nav [data-view="${view}"]`).click();
  const button = (text, fn) => {
    const b = node("button", text, "v13-link");
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  document.body.classList.add("sillage-v13");
  const home = $("app-dashboard"),
    hero = $("v80-hero");
  const equation = node("div", undefined, "v13-equation");
  equation.id = "v13-equation";
  hero.append(equation);
  $("home-alerts").before($("v116-bank-status"));
  const heading = $("section-enveloppes").querySelector(".section-head h2");
  if (heading) heading.textContent = "Enveloppes";
  const intro = $("section-enveloppes").querySelector(".page-intro");
  if (intro)
    intro.textContent = "Ce qui est protégé, dépensé et encore disponible.";
  const grid = node("div", undefined, "v13-home-grid");
  grid.id = "v13-home-grid";
  hero.after(grid);
  function panel(title, cls, action) {
    const p = node("section", undefined, "v13-panel " + cls),
      head = node("div", undefined, "v13-panel-head");
    head.append(node("h2", title));
    if (action) head.append(action);
    p.append(head);
    grid.append(p);
    return p;
  }
  const chart = panel(
    "Votre disponible à venir",
    "v13-chart",
    button("Jour par jour →", () => $("home-daily-open").click()),
  );
  // Move the original graph: retain its data, selected horizon and rendering code.
  const spark = hero.querySelector(".v80-spark"),
    marker = document.createComment("detailed dashboard chart");
  spark.before(marker);
  chart.append(
    node("p", "Après les enveloppes et les opérations prévues.", "v13-muted"),
  );
  const graphSlot = node("div", undefined, "v13-graph-slot");
  chart.append(graphSlot);
  const chartDates = node("div", undefined, "v13-chart-dates");
  chart.append(chartDates);
  const extremes = node("div", undefined, "v13-extremes");
  chart.append(extremes);
  const upcoming = panel(
    "Les prochains jours",
    "v13-next",
    button("Calendrier →", () => go("calendrier")),
  );
  const nextList = node("div");
  upcoming.append(nextList);
  const nextIncome = button("Prochaine rentrée d’argent →", () =>
    hero.querySelector(".v80-hero-facts>div:nth-child(3)")?.click(),
  );
  nextIncome.setAttribute("aria-label", "Voir la prochaine rentrée d’argent");
  upcoming.append(nextIncome);
  const envelopes = panel(
    "Vos enveloppes du quotidien",
    "v13-envelope-preview",
    button("Tout voir →", () => go("enveloppes")),
  );
  const envelopeList = node("div");
  envelopes.append(envelopeList);
  const recent = panel(
    "Derniers achats",
    "v13-recent",
    button("Transactions →", () => go("transactions")),
  );
  const recentList = node("div");
  recent.append(recentList);
  let state,
    search = "",
    frequency = "all";
  function mode() {
    const essential =
      home.classList.contains("home-essential") &&
      !home.classList.contains("v47-editing");
    grid.hidden = !essential;
    if (essential) graphSlot.append(spark);
    else marker.after(spark);
  }
  new MutationObserver(mode).observe(home, {
    attributes: true,
    attributeFilter: ["class"],
  });
  mode();
  const filter = node("div", undefined, "v13-envelope-toolbar");
  const input = node("input");
  input.type = "search";
  input.id = "v13-envelope-search";
  input.placeholder = "Chercher une enveloppe";
  input.setAttribute("aria-label", "Chercher une enveloppe");
  const segments = node("div", undefined, "v13-filters");
  segments.setAttribute("aria-label", "Fréquence des enveloppes");
  for (const [key, label] of [
    ["all", "Toutes"],
    ["weekly", "À la semaine"],
    ["monthly", "Au mois"],
    ["other", "Autres"],
  ]) {
    const b = button(label, () => {
      frequency = key;
      filterCards();
    });
    b.dataset.frequency = key;
    segments.append(b);
  }
  const count = node("span", undefined, "v13-muted");
  count.id = "v13-envelope-count";
  count.setAttribute("role", "status");
  input.oninput = () => {
    search = input.value;
    filterCards();
  };
  filter.append(input, segments, count);
  $("envelopes").before(filter);
  const options = node("details", undefined, "v13-envelope-options");
  options.id = "v13-envelope-options";
  options.append(node("summary", "Options des enveloppes"));
  for (const item of [
    $("v10-envelopes"),
    document.querySelector(".v44-selection"),
  ].filter(Boolean))
    options.append(item);
  filter.before(options);
  $("envelopes").addEventListener("change", (event) => {
    if (event.target.matches("input[type=checkbox]") && event.target.checked)
      options.open = true;
  });
  const empty = node(
    "p",
    "Aucune enveloppe ne correspond à votre recherche.",
    "v13-empty",
  );
  empty.hidden = true;
  $("envelopes").after(empty);
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-CA");
  function filterCards() {
    let total = 0,
      visible = 0;
    for (const card of $("envelopes").querySelectorAll("[data-envelope-id]")) {
      const e = state?.envelopes.find(
        (e) => e.id === Number(card.dataset.envelopeId),
      );
      if (!e) continue;
      total++;
      const match =
        normalize(e.name).includes(normalize(search)) &&
        (frequency === "all" ||
          e.frequency === frequency ||
          (frequency === "other" &&
            !["weekly", "monthly"].includes(e.frequency)));
      card.hidden = !match;
      if (match) visible++;
    }
    count.textContent = visible + " / " + total + " enveloppe(s)";
    empty.hidden = !total || visible > 0;
    for (const b of segments.children)
      b.setAttribute("aria-pressed", String(b.dataset.frequency === frequency));
  }
  function line(host, title, caption, amount, fn) {
    const row = node(fn ? "button" : "div", undefined, "v13-row");
    if (fn) {
      row.type = "button";
      row.onclick = fn;
    }
    const text = node("div");
    text.append(node("strong", title), node("small", caption));
    row.append(text, node("b", money(amount)));
    host.append(row);
  }
  function draw() {
    if (!state?.forecast?.length) return;
    const horizon = Number(
      hero.querySelector("[data-horizon][aria-pressed=true]")?.dataset
        .horizon || 30,
    );
    const days = state.forecast.slice(0, horizon),
      values = [{ date: days[0].date, safe_cents: state.safe_cents }, ...days];
    const low = values.reduce((a, b) => (b.safe_cents < a.safe_cents ? b : a)),
      high = values.reduce((a, b) => (b.safe_cents > a.safe_cents ? b : a));
    extremes.replaceChildren();
    for (const [label, d] of [
      ["Le plus bas", low],
      ["Le plus haut", high],
    ]) {
      const fact = node("div");
      fact.append(
        node("span", label + " · " + horizon + " jours"),
        node("strong", money(d.safe_cents)),
        node("small", date(d.date)),
      );
      extremes.append(fact);
    }
    chartDates.replaceChildren(
      node("span", date(days[0].date)),
      node("span", date(days[Math.floor((days.length - 1) / 2)].date)),
      node("span", date(days.at(-1).date)),
    );
    equation.replaceChildren();
    // Use the exact state totals, including legacy credit reserves when present.
    for (const [label, value] of [
      ["Fonds admissibles", state.cash_cents],
      ["Réserves d’enveloppes", -state.envelope_reserved_cents],
      [
        "Protections sur cartes",
        -(state.card_envelope_reserved_cents + state.credit_reserved_cents),
      ],
    ]) {
      const fact = node("div");
      fact.append(node("span", label), node("strong", money(value)));
      equation.append(fact);
    }
    equation.append(
      button("Voir le calcul →", () => $("v21-sts-detail").click()),
    );
    nextIncome.hidden = !days.some((d) =>
      d.events.some(
        (e) =>
          e.type === "income" &&
          e.cash_impact_cents !== 0 &&
          e.amount_cents > 0,
      ),
    );
    nextList.replaceChildren();
    const events = state.forecast
      .flatMap((d) => d.events.map((e) => ({ ...e, date: d.date })))
      .slice(0, 4);
    for (const e of events)
      line(
        nextList,
        e.description || "Renouvellement",
        date(e.date) +
          " · " +
          ({
            income: "Revenu prévu",
            expense: "Dépense prévue",
            transfer: "Virement prévu",
            reserve: "Réserve prévue",
          }[e.type] || "Prévu"),
        e.type === "expense" ? -Math.abs(e.amount_cents) : e.amount_cents,
        () => go("calendrier"),
      );
    if (!events.length)
      nextList.append(
        node("p", "Aucun mouvement prévu sur 90 jours.", "v13-muted"),
      );
    envelopeList.replaceChildren();
    const active = state.envelopes
      .filter((e) => e.active)
      .sort(
        (a, b) =>
          (a.frequency === "weekly" ? -1 : 0) -
            (b.frequency === "weekly" ? -1 : 0) ||
          a.name.localeCompare(b.name, "fr-CA"),
      )
      .slice(0, 3);
    for (const e of active) {
      const insight = state.envelope_insights?.items.find((i) => i.id === e.id);
      line(
        envelopeList,
        e.name,
        insight?.next_renewal
          ? "Renouvellement le " + date(insight.next_renewal)
          : "Sans renouvellement programmé",
        e.reserved_cents,
        () => go("enveloppes"),
      );
    }
    if (!active.length)
      envelopeList.append(
        button("Créer votre première enveloppe →", () => go("enveloppes")),
      );
    recentList.replaceChildren();
    const purchases = state.transactions
      .filter((t) => t.amount_cents < 0)
      .sort((a, b) => b.happened_on.localeCompare(a.happened_on) || b.id - a.id)
      .slice(0, 3);
    for (const t of purchases)
      line(
        recentList,
        t.description,
        date(t.happened_on) +
          " · " +
          (state.accounts.find((a) => a.id === t.account_id)?.name || "Compte"),
        t.amount_cents,
        () => go("transactions"),
      );
    if (!purchases.length)
      recentList.append(
        node("p", "Vos achats enregistrés apparaîtront ici.", "v13-muted"),
      );
    decorateEnvelopes();
    filterCards();
  }
  function decorateEnvelopes() {
    for (const card of $("envelopes").querySelectorAll("[data-envelope-id]")) {
      const e = state.envelopes.find(
          (e) => e.id === Number(card.dataset.envelopeId),
        ),
        i = state.envelope_insights?.items.find((i) => i.id === e?.id);
      if (!e || !i) continue;
      let details = card.querySelector(".v13-envelope-detail");
      if (!details) {
        details = node("details", undefined, "v13-envelope-detail");
        details.append(node("summary", "Détails du budget"));
      }
      // Keep the original editing, deletion and selection buttons and their handlers.
      for (const item of card.querySelectorAll(
        ":scope>.envelope-facts,:scope>.envelope-mode-note,:scope>.card-caption:not(.balance-caption),:scope>.v81-envelope-facts,:scope>.bank-card-footer",
      ))
        details.append(item);
      // Management has one entry point: the sheet. Keep only read-only facts here.
      details.querySelector('.bank-card-footer')?.remove();
      card.querySelector(".v44-card-tools")?.before(details);
      const manage = card.querySelector('.v44-sheet-button');
      if (manage) manage.textContent = 'Gérer';
      card.querySelector(".v13-envelope-period")?.remove();
      const compact = node("div", undefined, "v13-envelope-period");
      compact.append(
        node(
          "span",
          i.period_start
            ? "Achats de la période : " + money(i.spent_period_cents)
            : "Pas de période en cours",
        ),
        node(
          "span",
          i.next_renewal
            ? "Renouvelle le " + date(i.next_renewal)
            : "Sans renouvellement",
        ),
      );
      const balance = card.querySelector(".bank-balance");
      if (i.mode === 'reserved' && e.frequency !== 'none') {
        const remaining = i.period_start
          ? i.period_budget_cents - i.spent_period_cents
          : i.next_period_remaining_cents;
        balance.textContent = money(remaining);
        compact.firstChild.textContent = i.period_start
          ? 'Restant du budget de la période'
          : 'Restant du prochain budget';
      }
      balance.after(compact);
      const balanceProgress = card.querySelector("progress");
      const isBudget = i.mode === 'reserved' && e.frequency !== 'none';
      const remaining = i.period_start ? i.period_budget_cents - i.spent_period_cents : i.next_period_remaining_cents;
      if (balanceProgress && isBudget) {
        balanceProgress.max = Math.max(1, i.period_start ? i.period_budget_cents : remaining + i.next_period_spent_cents);
        balanceProgress.value = Math.max(0, remaining);
      }
      balanceProgress?.setAttribute(
        "aria-label",
        e.name + " : " + money(isBudget ? remaining : e.reserved_cents) + (isBudget ? " restant du budget" : " de réserve inutilisée"),
      );
      const caption = card.querySelector(".balance-caption");
      if (caption) caption.textContent = i.mode === "reserved" && e.frequency !== "none" ? "Restant à dépenser" : "Réserve inutilisée";
      const label = card.querySelector(".bank-card-top .card-caption");
      if (label)
        label.textContent =
          ({
            weekly: "Chaque semaine",
            biweekly: "Aux 2 semaines",
            monthly: "Chaque mois",
            quarterly: "Aux 3 mois",
            semiannual: "Aux 6 mois",
            yearly: "Chaque année",
            none: "Sans renouvellement",
          }[e.frequency] || "") + (e.active ? "" : " · En pause");
    }
  }
  hero.addEventListener("click", (event) => {
    if (event.target.closest("[data-horizon]")) draw();
  });
  const prior = runtime.render;
  runtime.render = function (s) {
    const out = prior(s);
    state = s;
    draw();
    return out;
  };
  if (runtime.state) {
    state = runtime.state;
    draw();
  }
}
