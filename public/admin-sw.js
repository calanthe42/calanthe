/*
 * Calanthe admin — the service worker that shows order notifications on a
 * phone or computer even when the admin is closed. The push it receives is
 * empty; it asks /admin/pulse (with the signed-in cookie) what arrived and
 * says so in the notification bar. Tapping it opens the order.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "New activity at Calanthe";
      let body = "Open the admin to see it.";
      let url = "/admin/orders";
      try {
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const res = await fetch(`/admin/pulse?since=${encodeURIComponent(since)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const pulse = await res.json();
          const item = (pulse.fresh && pulse.fresh[0]) || (pulse.recent && pulse.recent[0]);
          if (item) {
            const amount =
              item.amountFils != null ? ` · AED ${(item.amountFils / 100).toLocaleString("en-AE")}` : "";
            title =
              item.kind === "payment"
                ? `Paid: ${item.title}${amount}`
                : item.kind === "order"
                  ? `New order ${item.title}${amount}`
                  : `New enquiry from ${item.detail || item.title}`;
            body = item.kind === "enquiry" ? "Tap to read it." : "Tap to open the order.";
            url = item.href || url;
          }
        }
      } catch (e) {
        /* Signed out or offline: the generic notice still rings. */
      }
      await self.registration.showNotification(title, {
        body,
        icon: "/icon.png",
        badge: "/icon.png",
        tag: "calanthe-order",
        renotify: true,
        requireInteraction: true,
        vibrate: [400, 200, 400, 200, 400, 200, 800],
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/orders";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (w.url.includes("/admin") && "focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
