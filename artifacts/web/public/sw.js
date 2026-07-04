/* GAB SCHOOL — Service Worker (Web Push) */

self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "GAB SCHOOL", body: "إشعار جديد", url: "/gab-c7x2p/students", tag: "gab-push" };
  try { if (event.data) Object.assign(data, event.data.json()); } catch {}

  const options = {
    body:               data.body,
    icon:               "/gab-favicon.png",
    badge:              "/gab-favicon.png",
    tag:                data.tag ?? "gab-push",   // same tag → replaces banner but re-rings sound
    renotify:           true,                      // re-plays sound & vibration on each update
    data:               { url: data.url },
    vibrate:            [300, 100, 300, 100, 300, 100, 300, 100, 300, 100, 300],
    silent:             false,
    requireInteraction: true,
    dir:                "rtl",
    lang:               "ar",
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/gab-c7x2p/students";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes("/gab-c7x2p"));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
