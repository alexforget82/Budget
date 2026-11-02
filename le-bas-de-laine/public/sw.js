// Notifications only: no page caching and no background financial-data requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {}
  const body =
      typeof payload.body === "string"
        ? payload.body.slice(0, 1000)
        : "Votre résumé du matin est prêt. Ouvrez Le bas de laine.",
    tag =
      typeof payload.tag === "string" &&
      /^bdl-[A-Za-z0-9-]{1,60}$/.test(payload.tag)
        ? payload.tag
        : "bdl-morning";
  event.waitUntil(
    self.registration.showNotification("Le bas de laine", {
      body,
      tag,
      icon: "/logo.png",
      badge: "/logo.png",
      renotify: false,
      data: { url: "/#today" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    "/?rappel=" + Date.now() + "#today",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const window of windows)
        if (
          new URL(window.url).origin === self.location.origin &&
          new URL(window.url).pathname === "/"
        ) {
          await window.navigate(target);
          await window.focus();
          return;
        }
      await self.clients.openWindow(target);
    })(),
  );
});
