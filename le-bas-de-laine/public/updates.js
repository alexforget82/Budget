import { node, field, input, button } from "./view.js";
export async function updatesEditor({ request, modal, onStatus }) {
  const body = node("div", null, "updates-panel");
  let current;
  const show = () => {
    body.replaceChildren(
      node("p", "Version installée : " + current.current_version),
      node(
        "p",
        current.error || current.available
          ? ""
          : current.latest
            ? "Vous utilisez la dernière version connue."
            : "Aucune vérification effectuée.",
      ),
    );
    if (current.error) body.append(node("p", current.error, "warning"));
    if (current.last_checked_at)
      body.append(
        node(
          "small",
          "Dernière vérification : " +
            new Date(current.last_checked_at).toLocaleString("fr-CA"),
          "muted",
        ),
      );
    const automatic = input("automatic_updates", "checkbox");
    automatic.checked = current.automatic;
    const label = node("label", null, "check");
    label.append(
      automatic,
      node("span", "Vérifier automatiquement les versions une fois par jour"),
    );
    automatic.onchange = async () => {
      automatic.disabled = true;
      try {
        current = await request("/api/updates/preferences", {
          automatic: automatic.checked,
        });
        onStatus(current);
      } catch (e) {
        automatic.checked = !automatic.checked;
        error.textContent = e.message;
      } finally {
        automatic.disabled = false;
      }
    };
    const error = node("p", "", "error");
    body.append(
      label,
      button("Vérifier maintenant", async () => {
        try {
          error.textContent = "Vérification…";
          current = await request("/api/updates/check", {});
          onStatus(current);
          show();
        } catch (e) {
          error.textContent = e.message;
        }
      }),
      error,
    );
    if (current.available) {
      const latest = current.latest,
        download = node("a", "Télécharger la " + latest.version, "button-link");
      download.href = latest.url;
      download.rel = "noreferrer";
      const command =
          "cd ~/Le-bas-de-laine-" +
          latest.version +
          ' && bash "Installer Le bas de laine.sh"',
        code = node("code", command),
        steps = node("ol");
      for (const text of [
        "Sur le Chromebook, téléchargez et extrayez l’archive dans Fichiers Linux.",
        "Dans le Terminal Linux, lancez la commande ci-dessous. L’installateur sauvegarde les données avant la mise à jour.",
        "Actualisez ensuite vos appareils. Les liens iPhone restent valables.",
      ])
        steps.append(node("li", text));
      body.append(
        node("strong", "Nouvelle version : " + latest.version),
        node("p", latest.notes),
        download,
        steps,
        code,
        button("Copier la commande", async () => {
          try {
            await navigator.clipboard.writeText(command);
            error.textContent = "Commande copiée.";
          } catch {
            error.textContent = "Sélectionnez et copiez la commande affichée.";
          }
        }),
        node(
          "p",
          "L’installation se fait sur le Chromebook, sans lancer de commande depuis l’iPhone.",
          "muted",
        ),
      );
      const integrity = node("details");
      integrity.append(
        node("summary", "Vérifier l’archive"),
        node("code", "SHA-256 : " + latest.sha256),
      );
      body.append(integrity);
    }
    body.append(
      node(
        "p",
        "Seules des informations publiques de version sont téléchargées depuis GitHub. Aucune donnée du budget n’est envoyée et aucune installation n’est lancée automatiquement.",
        "muted",
      ),
    );
  };
  modal("Mises à jour", body);
  try {
    current = await request("/api/updates/status");
    onStatus(current);
    show();
  } catch (e) {
    body.append(node("p", e.message, "error"));
  }
}
