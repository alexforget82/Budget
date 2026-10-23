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
    const help = document.createElement("button");
    help.type = "button";
    help.className = "s26-chatgpt-button";
    help.textContent = "Poser une question à ChatGPT";
    const dialog = document.createElement("dialog");
    dialog.id = "s26-chatgpt-dialog";
    dialog.className = "editor-dialog";
    const heading = document.createElement("h2");
    heading.id = "s26-chatgpt-title";
    heading.textContent = "Votre budget dans ChatGPT";
    dialog.setAttribute("aria-labelledby", heading.id);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "secondary";
    close.textContent = "Fermer";
    close.onclick = () => dialog.close();
    const header = document.createElement("div");
    header.className = "section-head";
    header.append(heading, close);
    const intro = document.createElement("p");
    intro.textContent =
      "Téléchargez le fichier, ouvrez ChatGPT, puis joignez-le à votre question. Il contient vos montants et libellés, sans lien d’accès privé. Rien n’est envoyé automatiquement à ChatGPT.";
    const label = document.createElement("label");
    label.textContent = "Historique des transactions";
    const period = document.createElement("select");
    period.id = "s26-chatgpt-history";
    for (const [value, text] of [
      ["90", "90 derniers jours"],
      ["365", "Dernière année"],
      ["all", "Tout l’historique"],
    ])
      period.add(new Option(text, value));
    label.append(period);
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const actions = document.createElement("div");
    actions.className = "s26-chatgpt-actions";
    const download = document.createElement("a");
    download.textContent = "Télécharger mon fichier";
    download.download = "Sillage-pour-ChatGPT.json";
    download.hidden = true;
    const chat = document.createElement("a");
    chat.textContent = "Ouvrir ChatGPT ↗";
    chat.href = "https://chatgpt.com/";
    chat.target = "_blank";
    chat.rel = "noopener noreferrer";
    actions.append(download, chat);
    const preview = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Vérifier le contenu avant de le partager";
    const content = document.createElement("textarea");
    content.readOnly = true;
    content.setAttribute("aria-label", "Contenu du fichier pour ChatGPT");
    preview.append(summary, content);
    const note = document.createElement("p");
    note.className = "sub";
    note.textContent =
      "Le fichier comprend les prévisions sur 90 jours et les budgets des trois mois précédents aux trois mois suivants. C’est un instantané : préparez un nouveau fichier après vos changements. Sans clé API ni frais API supplémentaires. Ce fichier ne remplace pas une sauvegarde.";
    dialog.append(header, intro, label, status, actions, preview, note);
    document.body.append(dialog);
    body.append(help);
    let fileURL = null,
      request = null;
    async function prepare() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      if (fileURL) URL.revokeObjectURL(fileURL);
      fileURL = null;
      download.hidden = true;
      download.removeAttribute("href");
      content.value = "";
      status.textContent = "Préparation du fichier…";
      try {
        const response = await fetch(
          "/api/chatgpt/export?history=" + period.value,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok)
          throw Error("Le fichier n’a pas pu être préparé. Réessayez.");
        const text = await response.text();
        if (controller.signal.aborted) return;
        content.value = text;
        fileURL = URL.createObjectURL(
          new Blob([text], { type: "application/json;charset=utf-8" }),
        );
        download.href = fileURL;
        download.hidden = false;
        status.textContent =
          "Fichier prêt. Vérifiez son contenu, puis téléchargez-le pour le joindre dans ChatGPT.";
      } catch (error) {
        if (!controller.signal.aborted && error.name !== "AbortError")
          status.textContent = error.message;
      }
    }
    help.onclick = () => {
      dialog.showModal();
      prepare();
    };
    period.onchange = prepare;
    dialog.addEventListener("close", () => {
      request?.abort();
      if (fileURL) URL.revokeObjectURL(fileURL);
      fileURL = null;
      download.removeAttribute("href");
      download.hidden = true;
      content.value = "";
    });
    const budgetToolbar = document.querySelector(
      "#monthly-budget-workspace>.v60-toolbar",
    );
    if (budgetToolbar) {
      const buttons = [...budgetToolbar.children].filter(
          (n) => n.tagName === "BUTTON",
        ),
        actions = document.createElement("div");
      actions.className = "s26-budget-actions";
      for (const b of buttons.slice(2)) {
        if (b.textContent === "Reprendre le mois précédent") continue;
        actions.append(b);
      }
      const tools = document.querySelector(".budget-register-tools");
      (tools || budgetToolbar).append(actions);
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
      for (const { node, marker } of slots) {
        if (node.dataset.dashboardManaged === "true") continue;
        if (compact.matches) mobileActions.append(node);
        else marker.after(node);
      }
    }
    compact.addEventListener("change", placeActions);
    placeActions();
  })();
}
