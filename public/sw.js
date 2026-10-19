// Service worker: μόνο web push. Δεν κάνει cache σελίδων, ώστε να μη μένουν ευαίσθητα δεδομένα στη συσκευή.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Θύμισέ μου", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      renotify: !!data.tag, // με tag: η νέα ειδοποίηση ξαναχτυπά αντί να αντικαθιστά σιωπηλά την προηγούμενη
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.location.origin));
      if (open) return open.focus().then((c) => c.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
