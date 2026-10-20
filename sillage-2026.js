// Domain initializer. Shared state and rendering hooks are explicit dependencies.
export function initialize(runtime) {
  /* Branding and navigation only: original buttons and financial handlers are retained. */
  (() => {
    const nav = document.querySelector(".app-shell-nav"),
      tools = document.createElement("details"),
      title = document.createElement("summary"),
      body = document.createElement("div");
    tools.id = "s26-tools";
    tools.className = "s26-tools";
    title.textContent = "Outils et réglages";
    tools.append(title, body);
    for (const id of [
      "verification",
      "categories",
      "virements",
      "importer",
      "exceptions",
      "sauvegardes",
    ]) {
      const button = nav.querySelector(`[data-view="${id}"]`);
      if (!button) continue;
      body.append(button);
      button.addEventListener("click", () => (tools.open = true));
      if (button.classList.contains("active")) tools.open = true;
    }
    const budgetToolbar = document.querySelector(
      "#monthly-budget-workspace>.v60-toolbar",
    );
    if (budgetToolbar) {
      const buttons = [...budgetToolbar.children].filter(
          (n) => n.tagName === "BUTTON",
        ),
        actions = document.createElement("div");
      actions.className = "s26-budget-actions";
      for (const b of buttons.slice(2)) actions.append(b);
      budgetToolbar.append(actions);
    }
    const captions = [...nav.querySelectorAll(".nav-caption")];
    captions.find((c) => c.textContent === "OUTILS")?.remove();
    nav.querySelector(".quick-add").before(tools);
    // Keep mobile essentials visible; secondary header actions remain in the tools menu.
    const compact = matchMedia("(max-width:760px)"),
      secondary = [
        document.querySelector(".v41-header-tools"),
        document.querySelector(".sillage-health"),
      ].filter(Boolean),
      slots = secondary.map((node) => {
        const marker = document.createComment("desktop action position");
        node.before(marker);
        return { node, marker };
      });
    const mobileActions = document.createElement("div");
    mobileActions.className = "s26-mobile-actions";
    body.append(mobileActions);
    function placeActions() {
      for (const { node, marker } of slots)
        if (compact.matches) mobileActions.append(node);
        else marker.after(node);
    }
    compact.addEventListener("change", placeActions);
    placeActions();
  })();
}
