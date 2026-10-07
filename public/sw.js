self.addEventListener("push", (event) => {
  let data = {
    title: "TableQ",
    body: "Your table is ready. Please return to the host.",
  };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "table-ready",
      requireInteraction: true,
      data: { ticketId: data.ticketId },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const current = windows.find((w) =>
        new URL(w.url).pathname.startsWith("/guest/"),
      );
      if (current) {
        await current.focus();
        return;
      }
      const routes = await caches.open("tableq-guest-route");
      const stored = await routes.match(
        `/guest-route/${event.notification.data.ticketId}`,
      );
      if (stored) {
        const route = await stored.text();
        if (/^\/guest\/[A-Za-z0-9_-]+$/.test(route)) {
          await clients.openWindow(route);
          return;
        }
      }
      await clients.openWindow("/check-in");
    })(),
  );
});
