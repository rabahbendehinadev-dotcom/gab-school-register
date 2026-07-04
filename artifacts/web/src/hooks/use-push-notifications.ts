import { useState, useEffect, useCallback } from "react";

const SW_URL = "/sw.js";

async function getVapidKey(): Promise<string> {
  const res = await fetch("/api/push/vapid-public-key");
  const { key } = await res.json() as { key: string };
  return key;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) throw new Error("SW not supported");
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

async function subscribe(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const key  = await getVapidKey();
  const sub  = await reg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  return sub;
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await fetch("/api/push/subscribe", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body:        JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
}

async function deleteSubscription(sub: PushSubscription): Promise<void> {
  await fetch("/api/push/subscribe", {
    method:      "DELETE",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body:        JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

export type PushStatus = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("loading");

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported"); return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied"); return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      if (!reg) { setStatus("unsubscribed"); return; }
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : "unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    setStatus("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return; }
      const reg = await registerSW();
      await navigator.serviceWorker.ready;
      const sub = await subscribe(reg);
      await saveSubscription(sub);
      setStatus("subscribed");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setStatus("unsubscribed");
    }
  }, []);

  const disable = useCallback(async () => {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await deleteSubscription(sub);
      }
      setStatus("unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }, []);

  return { status, enable, disable };
}
