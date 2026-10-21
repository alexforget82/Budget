// Presentation only: reuse the existing controls and financial handlers.
export function initialize(runtime) {
  const compact = matchMedia("(max-width:760px)"),
    nav = document.querySelector(".app-shell-nav");
  const groups = [];
  function options(id, title, anchor, nodes) {
    if (!anchor || !nodes.length) return;
    const details = document.createElement("details");
    details.id = id;
    details.className = "mobile-options";
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.append(summary);
    const body = document.createElement("div");
    body.className = "mobile-options-body";
    details.append(body);
    anchor.after(details);
    const slots = nodes.filter(Boolean).map((node) => {
      const marker = document.createComment("desktop control position");
      node.before(marker);
      return { node, marker };
    });
    groups.push({ details, body, slots });
  }
  const budget = document.querySelector(
    "#monthly-budget-workspace>.v60-toolbar",
  );
  options(
    "mobile-budget-options",
    "Filtres et options",
    budget?.querySelector("input[type=search]"),
    [
      budget?.querySelector("select"),
      budget?.querySelector(".s26-budget-actions"),
      document.querySelector("#section-budget>.page-intro"),
    ].filter(Boolean),
  );
  // The options belong to the toolbar grid, immediately after the search field.
  const tx = document.querySelector(".register-search-row");
  options(
    "mobile-transaction-options",
    "Filtres et options",
    tx,
    [
      ...(tx?.querySelectorAll(":scope>label:not(.register-search)") || []),
      document.querySelector(".register-advanced"),
      document.querySelector(".transaction-workspace .page-actions"),
      document.querySelector("#v10-workbench"),
    ].filter(Boolean),
  );
  const forecast = document.querySelector("#v4-forecast"),
    top = forecast?.querySelector(".v4-topbar");
  options(
    "mobile-forecast-options",
    "Compte et scénarios",
    top,
    [
      top?.querySelector("label"),
      ...[...(top?.querySelectorAll("button") || [])].filter(
        (b) => b.textContent === "Comparer mes scénarios",
      ),
      forecast?.querySelector(":scope>.v41-saved-scenarios"),
      forecast?.querySelector(":scope>.v4-footnote"),
      document.querySelector("#section-prevision>.page-intro"),
    ].filter(Boolean),
  );
  const calendar = document.querySelector(".v4-calendar-toolbar");
  options(
    "mobile-calendar-options",
    "Options du calendrier",
    calendar,
    [
      ...(calendar?.querySelectorAll(":scope>label") || []),
      calendar?.querySelector("#v80-calendar-density"),
    ].filter(Boolean),
  );
  const appearance = document.querySelector(".life-appearance"),
    version = document.querySelector("#app-version");
  const appearanceMarker = document.createComment("desktop appearance"),
    versionMarker = document.createComment("desktop version");
  appearance?.before(appearanceMarker);
  version?.before(versionMarker);
  const bar = document.createElement("nav");
  bar.className = "mobile-tabbar";
  bar.setAttribute("aria-label", "Navigation rapide");
  const paths = {
    home: "M3 11 12 3l9 8v10h-6v-6H9v6H3z",
    budget: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h3 M8 18h3",
    forecast: "M3 3v18h18 M6 15l5-5 4 3 6-8",
    transactions: "M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4",
    more: "M4 6h16 M4 12h16 M4 18h16",
  };
  const buttons = [];
  for (const [view, label, icon] of [
    ["dashboard", "Accueil", "home"],
    ["budget", "Budget", "budget"],
    ["prevision", "Prévision", "forecast"],
    ["transactions", "Transactions", "transactions"],
    ["more", "Plus", "more"],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mobileView = view;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", paths[icon]);
    svg.append(path);
    const text = document.createElement("span");
    text.textContent = label;
    button.append(svg, text);
    bar.append(button);
    buttons.push(button);
    button.onclick = (event) => {
      event.stopPropagation();
      if (view === "more")
        nav.querySelector(".mobile-navigation-trigger").click();
      else nav.querySelector(`[data-view="${view}"]`).click();
      sync();
    };
  }
  document.body.append(bar);
  let moneyFrame = 0;
  function fitMoney() {
    cancelAnimationFrame(moneyFrame);
    moneyFrame = requestAnimationFrame(() => {
      for (const card of document.querySelectorAll(
        "#monthly-budget-workspace>.v60-metrics>div,#v4-metrics>.v4-metric",
      )) {
        card.classList.remove("mobile-money-wide");
        if (!compact.matches || !card.getClientRects().length) continue;
        const amount = card.querySelector("strong");
        if (
          amount &&
          (amount.scrollWidth > amount.clientWidth + 1 ||
            card.scrollWidth > card.clientWidth + 1)
        )
          card.classList.add("mobile-money-wide");
      }
    });
  }
  for (const host of document.querySelectorAll(
    "#monthly-budget-workspace>.v60-metrics,#v4-metrics",
  ))
    new MutationObserver(fitMoney).observe(host, {
      childList: true,
      subtree: true,
    });
  window.addEventListener("resize", fitMoney);
  function sync() {
    fitMoney();
    const active =
      nav.querySelector("[data-view].active")?.dataset.view || "dashboard";
    const planning = [
      "prevision",
      "calendrier",
      "enveloppes",
      "budgets-libres",
      "recurrences",
      "objectifs",
      "suivi",
    ].includes(active);
    for (const button of buttons) {
      const view = button.dataset.mobileView,
        selected =
          view === active ||
          (view === "prevision" && planning) ||
          (view === "more" &&
            !["dashboard", "budget", "transactions"].includes(active) &&
            !planning);
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
      if (view === "more")
        button.setAttribute(
          "aria-expanded",
          String(nav.classList.contains("mobile-menu-open")),
        );
    }
  }
  function layout() {
    for (const { details, body, slots } of groups) {
      details.hidden = !compact.matches;
      for (const { node, marker } of slots)
        if (compact.matches) body.append(node);
        else marker.after(node);
    }
    if (compact.matches) {
      if (appearance)
        document.querySelector(".s26-mobile-actions")?.append(appearance);
      if (version) bar.append(version);
    } else {
      if (appearance) appearanceMarker.after(appearance);
      if (version) versionMarker.after(version);
    }
    sync();
  }
  new MutationObserver(sync).observe(nav, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "aria-current"],
  });
  function viewport() {
    const visible = window.visualViewport,
      zoomed = visible && Math.abs(visible.scale - 1) > 0.01;
    document.body.classList.toggle(
      "sillage-keyboard-open",
      !!visible &&
        !zoomed &&
        innerHeight - visible.height > 120 &&
        !!document.activeElement?.matches("input,textarea,select"),
    );
    const height = !zoomed && visible ? visible.height : innerHeight;
    const offset =
      !zoomed && visible
        ? Math.max(0, innerHeight - visible.height - visible.offsetTop)
        : 0;
    document.documentElement.style.setProperty(
      "--mobile-visible-height",
      height + "px",
    );
    document.documentElement.style.setProperty(
      "--mobile-keyboard-offset",
      offset + "px",
    );
  }
  window.visualViewport?.addEventListener("resize", viewport);
  window.visualViewport?.addEventListener("scroll", viewport);
  window.addEventListener("resize", viewport);
  document.addEventListener("focusin", viewport);
  document.addEventListener("focusout", () => setTimeout(viewport, 0));
  viewport();
  compact.addEventListener("change", layout);
  layout();
  if (compact.matches)
    document.querySelector('#v4-calendar [data-calendar-view="week"]')?.click();
}
