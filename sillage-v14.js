// Presentation only. Reuse every existing control; never compute or persist finances here.
export function initialize(runtime) {
  document.body.classList.add("sillage-v14");
  const equation = document.getElementById("v13-equation");
  if (equation && !document.getElementById("v14-calculation")) {
    const detail = document.createElement("details");
    detail.id = "v14-calculation";
    detail.className = "v14-calculation";
    const summary = document.createElement("summary");
    summary.textContent = "Détail du disponible";
    equation.before(detail);
    detail.append(summary, equation);
  }
  const scope = document.querySelector(".v70-scope-note");
  const lead = document.querySelector(
    "#v80-hero .v80-hero-body > div:first-child",
  );
  if (scope && lead) lead.append(scope);
  // Short labels describe the content instead of adding a second marketing headline.
  for (const [selector, text] of [
    [
      "#v80-hero .v80-hero-body > div:first-child > h2",
      "Disponible maintenant",
    ],
    [".v13-chart .v13-panel-head h2", "Évolution du disponible"],
    [".v13-next .v13-panel-head h2", "À venir"],
    [".v13-envelope-preview .v13-panel-head h2", "Enveloppes"],
    [".v13-recent .v13-panel-head h2", "Dernières dépenses"],
    ["#v4-forecast .v4-chart-heading h3", "Solde et disponible"],
    [
      "#v4-forecast .v4-lower-grid .v4-card:first-child h3",
      "Prochaines opérations",
    ],
    ["#v4-forecast .v4-lower-grid .v4-card:nth-child(2) h3", "Prévu et réel"],
  ]) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  }
}

// Dashboard controls and chart annotations. Values come exclusively from the canonical state.
export function initializeDashboard(runtime) {
  const $ = (id) => document.getElementById(id),
    home = $("app-dashboard"),
    hero = $("v80-hero"),
    nav = document.querySelector(".app-shell-nav"),
    header = document.querySelector(".workspace-header"),
    toolbar = document.querySelector(".v47-toolbar-actions"),
    head = hero.querySelector(".v80-panel-head"),
    tools = document.querySelector(".v41-header-tools"),
    settings = document.createElement("div"),
    more = document.createElement("details"),
    summary = document.createElement("summary"),
    body = document.createElement("div"),
    homeActions = document.createElement("div"),
    daily = $("home-daily-open"),
    compact = matchMedia("(max-width:760px)");
  settings.id = "v141-settings";
  document.querySelector("#s26-tools > div").append(settings);
  const comments = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_COMMENT,
  );
  while (comments.nextNode())
    if (comments.currentNode.data === "desktop appearance") {
      settings.append(comments.currentNode);
      break;
    }
  const appearance = document.querySelector(".life-appearance");
  if (appearance) settings.append(appearance);
  const health = document.querySelector(".sillage-health");
  if (health) {
    health.dataset.dashboardManaged = "true";
    settings.append(health);
  }
  tools.dataset.dashboardManaged = "true";
  more.id = "dashboard-more";
  more.className = "dashboard-more";
  summary.textContent = "Plus";
  body.className = "dashboard-more-body";
  homeActions.className = "dashboard-more-home";
  more.append(summary, body);
  body.append(tools, homeActions);
  for (const button of [...toolbar.children])
    if (button !== daily) homeActions.append(button);
  const heroActions = hero.querySelector(".v81-hero-actions");
  if (heroActions) homeActions.append(heroActions);
  let configure;
  const help = document.querySelector(".budget-note");
  if (help) body.append(help);
  daily.classList.add("v4-primary");
  function positionMenu() {
    body.style.transform = "";
    body.style.maxHeight = "";
    if (!more.open || summary.hidden) return;
    const rect = body.getBoundingClientRect();
    const shift = Math.max(
      16 - rect.left,
      Math.min(0, innerWidth - 16 - rect.right),
    );
    body.style.transform = `translateX(${shift}px)`;
    body.style.maxHeight = `${Math.min(innerHeight * 0.65, Math.max(100, innerHeight - rect.top - (compact.matches ? 96 : 20)))}px`;
  }
  more.addEventListener("toggle", positionMenu);
  function place() {
    const scopeAction = hero.querySelector(".v70-scope-note button");
    if (scopeAction) {
      configure?.remove();
      configure = scopeAction;
      configure.textContent = "Configurer le compte du disponible";
      homeActions.append(configure);
    }
    const dashboard = nav
      .querySelector("[data-view=dashboard]")
      ?.classList.contains("active");
    const essential =
      dashboard &&
      home.classList.contains("home-essential") &&
      !home.classList.contains("v47-editing");
    const target = dashboard
      ? essential
        ? head
        : toolbar
      : compact.matches
        ? settings
        : header;
    homeActions.hidden = !dashboard;
    const inline = !dashboard && compact.matches;
    summary.hidden = inline;
    if (more.parentElement !== target) {
      target.append(more);
      more.open = inline;
    }
    if (daily.parentElement !== (essential ? head : toolbar))
      (essential ? head : toolbar).append(daily);
    // Keep the action before the overflow menu without repeatedly moving nodes.
    if (dashboard && daily.nextElementSibling !== more) more.before(daily);
    positionMenu();
  }
  more.addEventListener("click", (event) => {
    if (event.target.closest("button") && !summary.hidden) more.open = false;
  });
  document.addEventListener("pointerdown", (event) => {
    if (!summary.hidden && more.open && !more.contains(event.target))
      more.open = false;
  });
  more.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !summary.hidden) {
      more.open = false;
      summary.focus();
    }
  });
  new MutationObserver(place).observe(nav, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  new MutationObserver(place).observe(home, {
    attributes: true,
    attributeFilter: ["class"],
  });
  compact.addEventListener("change", place);
  place();

  const svg = document.querySelector(".v80-spark"),
    ns = "http://www.w3.org/2000/svg";
  let current;
  function element(tag, attributes, text) {
    const e = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attributes))
      e.setAttribute(name, value);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const money = (n) =>
    new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
    }).format(n / 100);
  function chart() {
    if (!current?.forecast?.length) return;
    const horizon = Number(
      head.querySelector("[data-horizon][aria-pressed=true]")?.dataset
        .horizon || 30,
    );
    const days = [
      { date: current.forecast[0].date, safe_cents: current.safe_cents },
      ...current.forecast.slice(0, horizon),
    ];
    const values = days.map((d) => d.safe_cents),
      low = Math.min(...values),
      high = Math.max(...values);
    const minimum = values.indexOf(low),
      maximum = values.indexOf(high),
      pad =
        low === high
          ? Math.max(100, Math.abs(low) * 0.05)
          : (high - low) * 0.08,
      bottom = low - pad,
      top = high + pad,
      range = top - bottom,
      width = compact.matches ? 400 : 680,
      rightEdge = width - 18,
      x = (i) => 94 + (i * (rightEdge - 94)) / Math.max(1, days.length - 1),
      y = (v) => 174 - ((v - bottom) * 146) / range;
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${width} 204`);
    svg.classList.add("dashboard-chart");
    svg.setAttribute(
      "aria-label",
      `Disponible sur ${horizon} jours : minimum ${money(low)}, maximum ${money(high)}.`,
    );
    svg.append(
      element(
        "title",
        {},
        `Minimum ${money(low)} le ${days[minimum].date}; maximum ${money(high)} le ${days[maximum].date}.`,
      ),
    );
    for (const v of [top, (top + bottom) / 2, bottom]) {
      svg.append(
        element("line", {
          x1: 94,
          x2: rightEdge,
          y1: y(v),
          y2: y(v),
          class: "dashboard-chart-grid",
        }),
      );
      svg.append(
        element(
          "text",
          {
            x: 84,
            y: y(v) + 4,
            "text-anchor": "end",
            class: "dashboard-chart-axis",
          },
          money(Math.round(v)),
        ),
      );
    }
    svg.append(
      element("polyline", {
        points: values.map((v, i) => `${x(i)},${y(v)}`).join(" "),
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 2,
        "vector-effect": "non-scaling-stroke",
      }),
    );
    const points =
      minimum === maximum
        ? [{ index: minimum, kind: "both", label: "Min. = max." }]
        : [
            { index: minimum, kind: "low", label: "Min." },
            { index: maximum, kind: "high", label: "Max." },
          ];
    for (const p of points) {
      const circle = element("circle", {
        cx: x(p.index),
        cy: y(values[p.index]),
        r: 4,
        class: "dashboard-chart-point",
        "data-extreme": p.kind,
        "data-value": values[p.index],
      });
      circle.append(
        element(
          "title",
          {},
          `${p.label} ${money(values[p.index])} · ${days[p.index].date}`,
        ),
      );
      svg.append(circle);
      const right = p.index > days.length * 0.8;
      svg.append(
        element(
          "text",
          {
            x: x(p.index) + (right ? -9 : 9),
            y: y(values[p.index]) + (p.kind === "high" ? -10 : 18),
            "text-anchor": right ? "end" : "start",
            class: "dashboard-chart-label",
          },
          p.label,
        ),
      );
    }
    const fact = hero.querySelector(".v80-hero-facts>div:nth-child(2)");
    fact?.classList.toggle(
      "dashboard-equal-minimum",
      low === current.safe_cents,
    );
  }
  const render = runtime.render;
  runtime.render = function (state) {
    const out = render(state);
    current = state;
    chart();
    place();
    return out;
  };
  head.addEventListener("click", (event) => {
    if (event.target.closest("[data-horizon]")) chart();
  });
  let resizeFrame;
  addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      chart();
      positionMenu();
    });
  });
  if (runtime.state) {
    current = runtime.state;
    chart();
  }
}
