// MeeQo: zeigt Web-Push-Mitteilungen und oeffnet beim Antippen die richtige Seite.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "MeeQo", {
      body: data.body || "",
      icon: "/favicon.svg",
      data: { href: data.href || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.href));
});
