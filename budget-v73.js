// Domain initializer. Shared state and rendering hooks are explicit dependencies.
export function initialize(runtime) {
  (() => {
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Vue iPhone simplifiée";
    open.className = "secondary";
    open.id = "sharing73-open";
    const dialog = document.createElement("dialog");
    dialog.style.cssText =
      "max-width:540px;width:calc(100% - 32px);padding:26px;border-radius:20px";
    dialog.innerHTML =
      '<h2>Partager le disponible</h2><p>Un lien en lecture seule affiche le Safe-to-Spend sur 30, 60 ou 90 jours et les soldes maximal et minimal sur 30 jours. Le suivi de l’enveloppe Épicerie et ses achats associés sont également visibles, sans les autres enveloppes, comptes ni réglages.</p><p>Sur son iPhone : utilisez son propre compte Tailscale et partagez-lui l’accès au Mac dans Tailscale, ouvrez le lien dans Safari, puis utilisez Partager → Sur l’écran d’accueil.</p><p>Ce lien donne accès aux indicateurs et au suivi d’épicerie à toute personne qui le possède et peut joindre votre Mac. Gardez-le privé.</p><label>Lien de consultation<input id="sharing73-url" readonly style="width:100%;margin:12px 0" aria-label="Lien de consultation"></label><p id="sharing73-status" role="status"></p><div style="display:flex;flex-wrap:wrap;gap:10px"><button id="sharing73-create">Créer un nouveau lien</button><button id="sharing73-copy" class="secondary">Copier</button><button id="sharing73-revoke" class="danger">Révoquer le lien</button><button id="sharing73-close" class="secondary">Fermer</button></div>';
    document.body.append(dialog);
    const host =
      document.querySelector("#section-sauvegardes") ||
      document.querySelector("main");
    host.append(open);
    const field = dialog.querySelector("input"),
      status = dialog.querySelector("[role=status]");
    async function request(action) {
      const r = await fetch(
        "/api/sharing",
        action
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            }
          : {},
      );
      const s = await r.json();
      if (!r.ok) throw Error(s.error);
      field.value = s.path ? (s.origin || location.origin) + s.path : "";
      dialog.querySelector("#sharing73-copy").disabled = !s.path;
      dialog.querySelector("#sharing73-revoke").disabled = !s.path;
      status.textContent = s.path
        ? s.origin
          ? "Lien actif. Le Mac doit rester allumé et connecté."
          : "Accès local seulement : configurez l’accès privé Tailscale pour l’iPhone."
        : "Aucun lien actif.";
    }
    open.onclick = async () => {
      dialog.showModal();
      try {
        await request();
      } catch (e) {
        status.textContent = e.message;
      }
    };
    for (const [id, action] of [
      ["create", "create"],
      ["revoke", "revoke"],
    ])
      dialog.querySelector("#sharing73-" + id).onclick = async () => {
        try {
          await request(action);
        } catch (e) {
          status.textContent = e.message;
        }
      };
    dialog.querySelector("#sharing73-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(field.value);
        status.textContent = "Lien copié.";
      } catch {
        field.select();
        status.textContent = "Sélectionnez et copiez le lien.";
      }
    };
    dialog.querySelector("#sharing73-close").onclick = () => dialog.close();
    const hint = document.getElementById("envelope-reserve-help");
    if (hint)
      hint.append(
        document.createTextNode(
          " Une alimentation anticipée est une avance sur la prochaine échéance : seul le montant restant sera protégé à cette date.",
        ),
      );
  })();
}
