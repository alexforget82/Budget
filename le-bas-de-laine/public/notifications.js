import { node, field, input, button } from "./view.js";
const bytes = (value) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
const encoded = (value) =>
  btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export async function notificationsEditor({ request, modal }) {
  const pane = node("div", null, "notifications-settings"),
    error = node("p", "", "error");
  error.setAttribute("role", "alert");
  let subscription = null,
    current = null;
  const ios =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    standalone =
      matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true,
    supported =
      window.isSecureContext &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
  const explain =
    "Chaque matin vers 7 h, heure du Québec : revenus et paiements prévus, renouvellements automatiques et limites utilisées à 80 % ou plus.";
  async function load() {
    pane.replaceChildren(node("p", "Chargement…"));
    modal("Notifications du matin", pane);
    try {
      let reg;
      if (supported) {
        reg = await navigator.serviceWorker.getRegistration("/");
        subscription = (await reg?.pushManager.getSubscription()) || null;
      }
      current = await request(
        "/api/notifications/status",
        subscription ? { endpoint: subscription.endpoint } : undefined,
      );
      render();
    } catch (e) {
      pane.replaceChildren(node("p", e.message, "error"));
    }
  }
  function render() {
    error.textContent = "";
    error.className = "error";
    const details = input("notification_details", "checkbox");
    details.checked = current.device?.details === true;
    const privacy = node("label", null, "check");
    privacy.append(
      details,
      node("span", "Afficher les montants et les noms sur l’écran verrouillé"),
    );
    pane.replaceChildren(
      node("p", explain),
      node(
        "strong",
        current.device?.enabled
          ? "Actif sur cet appareil"
          : "Pas activé sur cet appareil",
      ),
      privacy,
      node(
        "p",
        "Sans cette option, le rappel indique seulement que votre résumé est prêt. Les paiements et revenus restent prévus, sans confirmation bancaire.",
        "muted",
      ),
    );
    const actions = node("div", null, "notification-actions");
    function action(text, fn, cls = "secondary") {
      const b = button(
        text,
        async () => {
          error.textContent = "";
          error.className = "error";
          b.disabled = true;
          try {
            await fn();
          } catch (e) {
            error.textContent = e.message;
          } finally {
            b.disabled = false;
          }
        },
        cls,
      );
      actions.append(b);
      return b;
    }
    if (!current.can_activate)
      pane.append(
        node(
          "p",
          current.error ||
            "Configurez d’abord l’accès privé iPhone (voir le Guide d’utilisation).",
          "warning",
        ),
      );
    else if (ios && !standalone)
      pane.append(
        node(
          "p",
          "Sur iPhone : ouvrez la version complète dans Safari, puis Partager → Sur l’écran d’accueil. Ouvrez cette icône pour activer les notifications.",
          "warning",
        ),
      );
    else if (!supported)
      pane.append(
        node(
          "p",
          "Les notifications nécessitent une connexion sécurisée et, sur iPhone, iOS 16.4 ou plus récent avec l’application sur l’écran d’accueil.",
          "warning",
        ),
      );
    else if (Notification.permission === "denied")
      pane.append(
        node(
          "p",
          "Les notifications sont bloquées. Autorisez Le bas de laine dans les réglages de notifications de votre appareil, puis revenez ici.",
          "warning",
        ),
      );
    else if (!current.device?.enabled)
      action(
        "Activer sur cet appareil",
        async () => {
          // Permission is requested directly from the tap, before any server round trip.
          const permission =
            Notification.permission === "granted"
              ? "granted"
              : await Notification.requestPermission();
          if (permission !== "granted")
            throw Error(
              "Autorisation refusée. Vous pourrez la changer dans les réglages de l’appareil.",
            );
          const wanted = details.checked,
            key = await request("/api/notifications/key", {}),
            registration = await navigator.serviceWorker.register(
              "/sw.js?v=1.3.0",
              { scope: "/", updateViaCache: "none" },
            );
          await navigator.serviceWorker.ready;
          let sub = await registration.pushManager.getSubscription();
          if (sub && current.device?.last_status === "expired") {
            await sub.unsubscribe();
            sub = null;
          }
          if (
            sub?.options?.applicationServerKey &&
            encoded(sub.options.applicationServerKey) !== key.public_key
          ) {
            await sub.unsubscribe();
            sub = null;
          }
          sub =
            sub ||
            (await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: bytes(key.public_key),
            }));
          await request("/api/notifications/subscribe", {
            subscription: sub.toJSON(),
            details: wanted,
          });
          await load();
        },
        "primary",
      );
    if (subscription && current.device?.enabled) {
      action("Envoyer un test", async () => {
        current = await request("/api/notifications/test", {
          endpoint: subscription.endpoint,
        });
        render();
        error.className = "muted";
        error.textContent =
          "Test accepté par le service de notifications. Vérifiez votre iPhone.";
      });
      if (current.device.last_test_sent_at) {
        if (current.device.last_test_confirmed_at)
          pane.append(
            node(
              "p",
              "Réception du dernier test confirmée par vous.",
              "notification-confirmed",
            ),
          );
        else
          action("J’ai reçu le test", async () => {
            current = await request("/api/notifications/confirm", {
              endpoint: subscription.endpoint,
              kind: "test",
            });
            render();
          });
      }
      if (current.device.last_sent_at) {
        if (current.device.last_morning_confirmed_at)
          pane.append(
            node(
              "p",
              "Réception du dernier résumé confirmée par vous.",
              "notification-confirmed",
            ),
          );
        else
          action("J’ai reçu le résumé", async () => {
            current = await request("/api/notifications/confirm", {
              endpoint: subscription.endpoint,
              kind: "morning",
            });
            render();
          });
      }
      action("Désactiver sur cet appareil", async () => {
        await request("/api/notifications/unsubscribe", {
          endpoint: subscription.endpoint,
        });
        try {
          await subscription.unsubscribe();
        } catch {}
        subscription = null;
        await load();
      });
    }
    details.onchange = async () => {
      if (!subscription || !current.device?.enabled) return;
      details.disabled = true;
      try {
        current = await request("/api/notifications/preferences", {
          endpoint: subscription.endpoint,
          details: details.checked,
        });
      } catch (e) {
        details.checked = !details.checked;
        error.textContent = e.message;
      } finally {
        details.disabled = false;
      }
    };
    if (current.device?.last_sent_at)
      pane.append(
        node(
          "p",
          "Dernier résumé accepté : " +
            new Intl.DateTimeFormat("fr-CA", {
              timeZone: "America/Toronto",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(current.device.last_sent_at)) +
            ".",
          "muted",
        ),
      );
    if (current.device?.last_status === "sending")
      pane.append(
        node(
          "p",
          "Un envoi est en cours ou n’a pas été confirmé. Utilisez le test pour vérifier cet appareil.",
          "muted",
        ),
      );
    if (current.device?.last_error)
      pane.append(
        node(
          "p",
          current.device.last_error +
            " Réactivez les notifications si l’abonnement a expiré.",
          "warning",
        ),
      );
    pane.append(
      actions,
      error,
      node(
        "p",
        "Le Chromebook, Linux et le serveur doivent rester éveillés. Si le serveur reprend avant 8 h, le résumé peut encore partir; aucun résumé du matin n’est envoyé plus tard. La livraison dépend aussi des réglages de concentration de l’iPhone.",
        "muted",
      ),
    );
    const help = node("details"),
      checks = node("ol");
    for (const text of [
      "Ouvrez l’icône de la version complète sur l’écran d’accueil (iOS 16.4 ou plus récent).",
      "Vérifiez les autorisations iOS et le mode Concentration. Un envoi accepté n’est pas une preuve de réception.",
      "Pour 7 h, gardez le Chromebook, Linux et le serveur éveillés et connectés. Tailscale est nécessaire pour ouvrir le budget.",
    ]) {
      checks.append(node("li", text));
    }
    help.append(node("summary", "Si rien n’arrive"), checks);
    pane.append(help);
    if (current.devices_count) {
      const other = node("details"),
        pause = button("Suspendre tous les rappels", () =>
          modal(
            "Suspendre tous les rappels ?",
            [
              node(
                "p",
                "Les rappels seront désactivés sur les " +
                  current.devices_count +
                  " appareil(s) activé(s). Vous pourrez les réactiver sur chacun.",
              ),
            ],
            async () => {
              await request("/api/notifications/pause", {});
              await load();
              return false;
            },
            "Suspendre",
          ),
        );
      other.append(
        node("summary", "Autres appareils"),
        node("p", current.devices_count + " appareil(s) activé(s)."),
        pause,
      );
      pane.append(other);
    }
  }
  await load();
}
