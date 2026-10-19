"use client";

import { useEffect, useState, useTransition } from "react";
import el from "@/messages/el.json";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./push-actions";

type State = "loading" | "unsupported" | "ios-install" | "off" | "on" | "denied";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function Notifications() {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (ios && !isStandalone()) return setState("ios-install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) return setMessage(`${el.notifications.error} (λείπει το VAPID key)`);
        // iOS: η άδεια πρέπει να ζητηθεί αμέσως μέσα στο κλικ, πριν από οποιοδήποτε await
        const permission = await Notification.requestPermission();
        if (permission === "denied") return setState("denied");
        if (permission !== "granted") return;
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
        const res = await savePushSubscription(sub.toJSON());
        if (!res.ok) {
          await sub.unsubscribe();
          return setMessage(el.notifications.error);
        }
        setState("on");
      } catch (err) {
        // τεχνική αιτία (όνομα σφάλματος του browser): ασφαλές να εμφανιστεί και βοηθά στο debugging
        setMessage(`${el.notifications.error} (${err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 120) : "άγνωστο σφάλμα"})`);
      }
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  function test() {
    setMessage(null);
    startTransition(async () => {
      const res = await sendTestPush();
      setMessage(res.sent > 0 ? el.notifications.testSent : el.notifications.testFailed);
    });
  }

  if (state === "loading" || state === "unsupported") return null;

  return (
    <section className="card flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="min-w-0 flex-1 basis-60">
        <h2 className="font-semibold">🔔 {el.notifications.title}</h2>
        <p className="text-sm text-slate-500">
          {state === "ios-install" && el.notifications.iosInstall}
          {state === "denied" && el.notifications.denied}
          {state === "off" && el.notifications.hint}
          {state === "on" && el.notifications.on}
        </p>
        {message && <p className="mt-1 text-sm text-slate-700">{message}</p>}
      </div>
      <div className="flex gap-2">
        {state === "off" && (
          <button type="button" disabled={pending} onClick={enable} className="btn-primary">
            {el.notifications.enable}
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" disabled={pending} onClick={test} className="btn-secondary">
              {el.notifications.test}
            </button>
            <button type="button" disabled={pending} onClick={disable} className="btn-secondary">
              {el.notifications.disable}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
